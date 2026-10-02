import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { planarStep, controllerForHand, composePosition } from '../v3-controls.mjs';
import { chooseReferenceSpace } from '../v3-session.mjs';
import { persistSnapshot } from '../v4-save.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('left stick directions, deadzone and diagonal speed', () => {
    assert.deepEqual(planarStep(0.1, -0.1, 0.1), { x: 0, y: 0 });
    near(planarStep(1, 0, 0.1).x, 0.01);
    near(planarStep(-1, 0, 0.1).x, -0.01);
    near(planarStep(0, -1, 0.1).y, 0.01);
    near(planarStep(0, 1, 0.1).y, -0.01);
    const diagonal = planarStep(1, -1, 0.1);
    near(Math.hypot(diagonal.x, diagonal.y), 0.01);
    near(planarStep(0.6, 0, 0.1).x, 0.005);
    assert.deepEqual(planarStep(NaN, 0, 0.1), { x: 0, y: 0 });
});

test('one second gives the same distance at 72, 90 and 120 Hz; resume is capped', () => {
    for (const fps of [72, 90, 120]) {
        let distance = 0;
        for (let i = 0; i < fps; i++) distance += planarStep(1, 0, 1 / fps).x;
        near(distance, 0.1);
    }
    near(planarStep(1, 0, 30).x, 0.01);
});

test('offset follows a rotated plane, is recomposed without drift and can be baked once', () => {
    const q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    const base = { x: 1, y: 2, z: 3 };
    const offset = { x: 0.1, y: 0.2 };
    const position = composePosition(base, q, offset);
    near(position.x, 1);
    near(position.y, 2.2);
    near(position.z, 2.9);
    for (let frame = 0; frame < 100; frame++) assert.deepEqual(composePosition(base, q, offset), position);
    assert.deepEqual(composePosition(position, q, { x: 0, y: 0 }), position);
});

test('controller lookup survives reversed order and reconnection', () => {
    const left = { handedness: 'left' },
        right = { handedness: 'right' };
    const bindings = new Map([
        [right, 'right-controller'],
        [left, 'left-controller'],
    ]);
    assert.equal(controllerForHand(bindings, 'left'), 'left-controller');
    bindings.delete(left);
    assert.equal(controllerForHand(bindings, 'left'), null);
    bindings.set({ handedness: 'left' }, 'reconnected-controller');
    assert.equal(controllerForHand(bindings, 'left'), 'reconnected-controller');
    assert.equal(controllerForHand(bindings, 'right'), 'right-controller');
});

test('expanded reference space is optional and falls back before initialization', async () => {
    const requests = [];
    const supported = {
        requestReferenceSpace: async (type) => {
            requests.push(type);
            return {};
        },
    };
    assert.equal(await chooseReferenceSpace(supported, true), 'unbounded');
    assert.deepEqual(requests, ['unbounded']);
    requests.length = 0;
    const unsupported = {
        requestReferenceSpace: async (type) => {
            requests.push(type);
            if (type === 'unbounded') throw new Error('Unsupported');
            return {};
        },
    };
    assert.equal(await chooseReferenceSpace(unsupported, true), 'local-floor');
    assert.deepEqual(requests, ['unbounded', 'local-floor']);
    requests.length = 0;
    assert.equal(await chooseReferenceSpace(supported, false), 'local-floor');
    assert.deepEqual(requests, ['local-floor']);
    await assert.rejects(
        chooseReferenceSpace(
            {
                requestReferenceSpace: async () => {
                    throw Error('No tracking');
                },
            },
            true,
        ),
    );
});

// Exercise the application's actual input handler, not a duplicate of its routing.
function inputHarness() {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const handler = html.slice(
        html.indexOf('        function updateInput(frame)'),
        html.indexOf('\n        </script>', html.indexOf('        function updateInput(frame)')),
    );
    const source = (hand, x, y) => ({
        handedness: hand,
        targetRaySpace: {},
        gamepad: {
            mapping: 'xr-standard',
            axes: [0, 0, x, y],
            buttons: Array.from({ length: 6 }, () => ({ pressed: false })),
        },
    });
    const left = source('left', 1, -1),
        right = source('right', 0, 0);
    const session = { inputSources: [right, left] };
    const context = vm.createContext({
        renderer: { xr: { getSession: () => session, getReferenceSpace: () => ({}) } },
        clock: { getDelta: () => 0.1 },
        saving: false,
        trackingAvailable: true,
        manualMode: true,
        restoringAnchor: false,
        placingController: null,
        locked: false,
        stage: 'adjust',
        hiddenByUser: false,
        activeAnchor: null,
        pointerLine: { parent: null },
        workflowHit: () => null,
        panelOpen: true,
        setPanelOpen() {},
        controllerBindings: new Map([
            [left, { add() {} }],
            [right, { add() {} }],
        ]),
        localOffset: { x: 0, y: 0 },
        planarStep,
        controllerForHand,
        resetOffset() {
            this.localOffset.x = 0;
            this.localOffset.y = 0;
        },
        previousTrigger: false,
        previousSaveButton: false,
        previousRoomButton: false,
        previousDidPressHideImage: false,
        previousDidPressHideInstructions: false,
        imagePlane: { visible: true },
        instructionsPlane: { visible: true },
        scale: 1,
        opacity: 0.75,
        imageOffsetZ: 0.045,
        depthAdjustSpeed: 0.1,
        incrementScale: (delta) => {
            context.scale += delta;
        },
        incrementOpacity: (delta) => {
            context.opacity += delta;
        },
    });
    vm.runInContext(handler, context);
    return { context, left, right, session, run: () => context.updateInput({ getPose: () => ({}) }) };
}

test('actual handler keeps left translation independent from right scale and opacity', () => {
    const { context, right, run } = inputHarness();
    right.gamepad.axes = [0, 0, 1, -1];
    run();
    near(Math.hypot(context.localOffset.x, context.localOffset.y), 0.01);
    near(context.scale, 1.1);
    near(context.opacity, 0.85);
    right.gamepad.axes = [0, 0, 0, 0];
    run();
    near(context.scale, 1.1);
    near(context.opacity, 0.85);
});

test('actual handler stops translation on release, tracking loss, recovery and save', () => {
    const { context, left, run } = inputHarness();
    for (const flag of ['saving', 'restoringAnchor']) {
        context[flag] = true;
        run();
        near(context.localOffset.x, 0);
        context[flag] = false;
    }
    context.trackingAvailable = false;
    run();
    near(context.localOffset.x, 0);
    context.trackingAvailable = true;
    left.gamepad.axes = [0, 0, 0, 0];
    run();
    near(context.localOffset.x, 0);
    left.gamepad.axes = [0, 0, 1, 0];
    run();
    near(context.localOffset.x, 0.01);
    context.controllerBindings.delete(left);
    run();
    near(context.localOffset.x, 0.01);
});

test('manual X/Y still toggle on release', () => {
    const { context, left, run } = inputHarness();
    left.gamepad.buttons[4].pressed = left.gamepad.buttons[5].pressed = true;
    run();
    assert.equal(context.imagePlane.visible, true);
    left.gamepad.buttons[4].pressed = left.gamepad.buttons[5].pressed = false;
    run();
    assert.equal(context.imagePlane.visible, false);
    assert.equal(context.instructionsPlane.visible, false);
});

test('drawing lock stops translation and resizing while retaining opacity control', () => {
    const { context, right, run } = inputHarness();
    context.locked = true;
    right.gamepad.axes = [0, 0, 1, -1];
    run();
    near(context.localOffset.x, 0);
    near(context.localOffset.y, 0);
    near(context.scale, 1);
    near(context.opacity, 0.85);
});

test('actual save handler stores the translated pose and clears the offset only on success', async () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const handler = html.slice(
        html.indexOf('        async function saveWork(frame)'),
        html.indexOf('        function updateInput(frame)'),
    );
    const vector = (x, y, z, w) => ({
        x,
        y,
        z,
        ...(w === undefined ? {} : { w }),
        copy(v) {
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
            if (v.w !== undefined) this.w = v.w;
            return this;
        },
        clone() {
            return vector(this.x, this.y, this.z, this.w);
        },
    });
    for (const fail of [false, true]) {
        let captured,
            stored,
            oldDeleted = false,
            newDeleted = false;
        const anchor = {
            requestPersistentHandle: async () => 'v3-anchor',
            delete: () => {
                newDeleted = true;
            },
        };
        const frame = {
            createAnchor: async (transform) => {
                captured = transform;
                return anchor;
            },
        };
        const session = {
            restorePersistentAnchor() {},
            addEventListener() {},
            removeEventListener() {},
            requestAnimationFrame: (callback) => callback(0, frame),
            deletePersistentAnchor: async () => {},
        };
        const offset = { x: 0.1, y: 0.2 };
        const context = vm.createContext({
            placementPoint: vector(1, 2, 3),
            placementQuaternion: vector(0, 0, 0, 1),
            workDatabase: {},
            renderer: { xr: { getSession: () => session, getReferenceSpace: () => ({}) } },
            group: { position: vector(1.1, 2.2, 3), quaternion: vector(0, 0, 0, 1) },
            basePosition: vector(1, 2, 3),
            baseQuaternion: vector(0, 0, 0, 1),
            currentScale: 2,
            currentOpacity: 0.5,
            imageSourceUrl: 'https://example.test/image.png',
            imagePlane: { geometry: { parameters: { width: 0.5, height: 0.3 } } },
            activeAnchor: {
                delete: () => {
                    oldDeleted = true;
                },
            },
            savedWork: { anchorId: 'old-v3-anchor' },
            saving: false,
            stage: 'adjust',
            trackingAvailable: true,
            restoringAnchor: false,
            locked: false,
            sourcePoints: [],
            alignment: null,
            imageBlob: { type: 'image/png' },
            setPanelOpen() {},
            persistSnapshot,
            fetch: async () => ({ blob: async () => ({ type: 'image/png' }) }),
            XRRigidTransform: class {
                constructor(position, quaternion) {
                    this.position = position;
                    this.orientation = quaternion;
                }
            },
            writeLastWork: async (_, work) => {
                if (fail) throw Error('Storage failed');
                stored = work;
            },
            resetOffset: () => {
                offset.x = offset.y = 0;
            },
            applyImagePose() {},
            setStatus: (message) => {
                context.message = message;
            },
            console: { error() {}, warn() {} },
        });
        vm.runInContext(handler, context);
        await context.saveWork(frame);
        near(captured.position.x, 1.1);
        near(captured.position.y, 2.2);
        assert.equal(context.saving, false);
        if (fail) {
            assert.equal(oldDeleted, false);
            assert.equal(newDeleted, true);
            near(offset.x, 0.1);
            assert.match(context.message, /No se guardó/);
        } else {
            assert.equal(oldDeleted, true);
            assert.equal(newDeleted, false);
            assert.equal(stored.anchorId, 'v3-anchor');
            assert.equal(stored.scale, 2);
            near(context.basePosition.x, 1.1);
            near(offset.x, 0);
        }
    }
});
