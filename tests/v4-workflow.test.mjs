import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fitSimilarity, intersectSelectedPlane } from '../v4-alignment.mjs';
import { persistSnapshot } from '../v4-save.mjs';

const points = [
    { x: -0.3, y: -0.2 },
    { x: 0.4, y: -0.1 },
    { x: -0.1, y: 0.35 },
];
test('three-point alignment recovers translation, rotation and uniform scale', () => {
    const angle = 0.37,
        scale = 5.2;
    const target = points.map((p) => ({
        x: 2 + scale * (Math.cos(angle) * p.x - Math.sin(angle) * p.y),
        y: 1 + scale * (Math.sin(angle) * p.x + Math.cos(angle) * p.y),
    }));
    const result = fitSimilarity(points, target);
    for (const [key, value] of Object.entries({ x: 2, y: 1, scale, angle }))
        assert.ok(Math.abs(result[key] - value) < 1e-10);
    assert.ok(result.maxError < 1e-10);
});
test('alignment rejects repeated, collinear, incomplete and non-finite points', () => {
    for (const invalid of [
        [points[0], points[0], points[0]],
        [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
        ],
        points.slice(0, 2),
        [{ x: NaN, y: 0 }, ...points.slice(1)],
    ]) {
        assert.throws(() => fitSimilarity(invalid, points));
        assert.throws(() => fitSimilarity(points, invalid));
    }
});
test('alignment reports physical residual instead of silently distorting the image', () => {
    const target = points.map((p) => ({ x: p.x * 3, y: p.y * 3 }));
    target[2].x += 0.03;
    const fit = fitSimilarity(points, target);
    assert.ok(fit.maxError > 0.003);
    assert.equal(fit.errors.length, 3);
});
test('selected plane remains the target outside the original polygon and beside a nearer column', () => {
    const plane = { position: { x: 0, y: 0, z: -3 }, normal: { x: 0, y: 0, z: 1 } };
    assert.deepEqual(intersectSelectedPlane({ x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, plane), {
        x: 2,
        y: 1,
        z: -3,
    });
    assert.equal(intersectSelectedPlane({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, plane), null);
    assert.equal(intersectSelectedPlane({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, plane), null);
});

function saveHarness() {
    const log = [],
        events = new Map();
    const anchor = {
        delete: () => log.push('delete-new'),
        requestPersistentHandle: async () => 'new-handle',
    };
    const frame = { createAnchor: async () => anchor };
    const session = {
        restorePersistentAnchor() {},
        addEventListener: (name, fn) => events.set(name, fn),
        removeEventListener: (name) => events.delete(name),
        requestAnimationFrame: (fn) => fn(0, frame),
        deletePersistentAnchor: async (id) => log.push('delete-' + id),
    };
    const snapshot = { version: 2, image: new Blob(['image'], { type: 'image/png' }), scale: 2 };
    let stored = { anchorId: 'previous' };
    return {
        session,
        frame,
        anchor,
        events,
        log,
        snapshot,
        get stored() {
            return stored;
        },
        run: (options) =>
            persistSnapshot({
                session,
                referenceSpace: {},
                transform: {},
                snapshot,
                write: async (value) => {
                    log.push('commit');
                    stored = value;
                },
                ...options,
            }),
    };
}
test('successful saves commit cached image before returning the new anchor', async () => {
    const h = saveHarness();
    const result = await h.run();
    assert.equal(result.handle, 'new-handle');
    assert.equal(h.stored.image, h.snapshot.image);
    assert.deepEqual(h.log, ['commit']);
    assert.equal(h.events.size, 0);
});
test('storage failure leaves previous work intact and cleans the new anchor', async () => {
    const h = saveHarness();
    await assert.rejects(
        h.run({
            write: async () => {
                throw Error('quota');
            },
        }),
        /quota/,
    );
    assert.equal(h.stored.anchorId, 'previous');
    assert.ok(h.log.includes('delete-new-handle'));
    assert.ok(h.log.includes('delete-new'));
});
test('missing persistence or anchors saves image and settings without claiming position', async () => {
    for (const feature of ['restore', 'handle', 'create']) {
        const h = saveHarness();
        if (feature === 'restore') delete h.session.restorePersistentAnchor;
        if (feature === 'handle') delete h.anchor.requestPersistentHandle;
        if (feature === 'create') delete h.frame.createAnchor;
        const result = await h.run();
        assert.equal(result.handle, null);
        assert.equal(result.anchor, null);
        assert.equal(h.stored.anchorId, null);
        assert.equal(h.stored.image, h.snapshot.image);
    }
});
test('synchronous anchor creation failure leaves the previous record intact', async () => {
    const h = saveHarness();
    h.frame.createAnchor = () => {
        throw Error('tracking');
    };
    await assert.rejects(h.run(), /tracking/);
    assert.equal(h.stored.anchorId, 'previous');
});

test('anchors not enabled or explicitly unsupported save portable settings', async () => {
    for (const disabled of [true, false]) {
        const h = saveHarness();
        if (disabled) h.session.enabledFeatures = ['plane-detection'];
        else
            h.frame.createAnchor = () => {
                const error = Error('Unavailable');
                error.name = 'NotSupportedError';
                throw error;
            };
        const result = await h.run();
        assert.equal(result.handle, null);
        assert.equal(h.stored.anchorId, null);
        assert.equal(h.stored.image, h.snapshot.image);
    }
});
test('anchor arriving after timeout is deleted and cannot replace previous work', async () => {
    const h = saveHarness();
    let resolve;
    h.frame.createAnchor = () => new Promise((r) => (resolve = r));
    await assert.rejects(h.run({ timeout: 5 }), /Tiempo/);
    resolve(h.anchor);
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(h.log.includes('delete-new'));
    assert.equal(h.stored.anchorId, 'previous');
});
test('persistent handle arriving after timeout is deleted', async () => {
    const h = saveHarness();
    let resolve;
    h.anchor.requestPersistentHandle = () => new Promise((r) => (resolve = r));
    await assert.rejects(h.run({ timeout: 5 }), /Tiempo/);
    resolve('late');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(h.log.includes('delete-late'));
    assert.equal(h.stored.anchorId, 'previous');
});
test('ending AR during anchor creation cleans result and leaves previous work intact', async () => {
    const h = saveHarness();
    h.frame.createAnchor = async () => {
        h.events.get('end')();
        return h.anchor;
    };
    await assert.rejects(h.run(), /cancelada/);
    assert.equal(h.stored.anchorId, 'previous');
    assert.ok(h.log.includes('delete-new'));
});

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('restoration failure exposes retry and refit while preserving saved image', () => {
    const fn = html.slice(
        html.indexOf('        function failRecovery('),
        html.indexOf('        async function retryRecovery('),
    );
    const saved = { image: 'cached', anchorId: 'old' };
    const context = vm.createContext({
        recoveryGeneration: 1,
        restoringAnchor: true,
        recoveryFailed: false,
        stage: 'recover',
        locked: false,
        activeAnchor: null,
        imagePlane: { visible: true },
        savedWork: saved,
        setStatus() {},
        refreshWorkflow() {},
    });
    vm.runInContext(fn, context);
    context.failRecovery('failed');
    assert.equal(context.restoringAnchor, false);
    assert.equal(context.recoveryFailed, true);
    assert.equal(context.imagePlane.visible, false);
    assert.equal(context.savedWork, saved);
});
test('saved anchor cannot overwrite visible pose halfway through saving', () => {
    const fn = html.slice(
        html.indexOf('        function updateAnchor('),
        html.indexOf('        function failRecovery('),
    );
    let copies = 0;
    const context = vm.createContext({
        restoringAnchor: false,
        activeAnchor: { anchorSpace: {} },
        renderer: { xr: { getReferenceSpace: () => ({}) } },
        saving: true,
        basePosition: {
            copy() {
                copies++;
            },
        },
        baseQuaternion: {
            copy() {
                copies++;
            },
        },
    });
    vm.runInContext(fn, context);
    context.updateAnchor({ getPose: () => ({ transform: { position: {}, orientation: {} } }) });
    assert.equal(copies, 0);
});
test('retry result from an expired recovery is deleted', async () => {
    const fn = html.slice(
        html.indexOf('        async function retryRecovery('),
        html.indexOf('        function createWorkflowUI('),
    );
    let resolve,
        deleted = false;
    const session = { restorePersistentAnchor: () => new Promise((r) => (resolve = r)) };
    const context = vm.createContext({
        renderer: { xr: { getSession: () => session } },
        recoveryGeneration: 0,
        savedWork: { anchorId: 'old' },
        restoringAnchor: false,
        recoveryFailed: false,
        stage: '',
        locked: false,
        restoreStartedAt: 0,
        imagePlane: { visible: true },
        refreshWorkflow() {},
        setStatus() {},
        performance,
        console,
        resetOffset() {},
    });
    vm.runInContext(fn, context);
    const promise = context.retryRecovery();
    context.recoveryGeneration++;
    resolve({
        delete() {
            deleted = true;
        },
    });
    await promise;
    assert.equal(deleted, true);
});
