import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { planarStep, controllerForHand, composePosition } from '../v3-controls.mjs';
import { fitSimilarity, intersectSelectedPlane } from '../v4-alignment.mjs';
import { intersectWall } from '../v2-wall.mjs';
import { persistSnapshot, withTimeout } from '../v4-save.mjs';
import { createARButton } from '../v3-session.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*;$/gm, '');
const image = new Blob([readFileSync(new URL('../Images/mural.png', import.meta.url))], {
    type: 'image/png',
});
const png = readFileSync(new URL('../Images/mural.png', import.meta.url));
const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);

async function appHarness({ search = '', stored = null, legacy = null, fetchFail = false } = {}) {
    const elements = new Map(),
        actions = new Map(),
        requests = [];
    let written;
    const element = () => ({
        style: {},
        hidden: false,
        disabled: false,
        checked: false,
        value: '',
        textContent: '',
        appendChild(child) {
            if (child.id) elements.set(child.id, child);
        },
        getContext: () => ({
            fillRect() {},
            fillText() {},
            beginPath() {},
            arc() {},
            fill() {},
            measureText: (text) => ({ width: text.length * 12 }),
        }),
    });
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(id, element());
    const popup = element();
    const document = {
        getElementById: (id) => elements.get(id),
        createElement: element,
        body: element(),
        querySelector: (selector) =>
            selector === '.popupWindow'
                ? popup
                : actions.get(selector) || actions.set(selector, element()).get(selector),
        querySelectorAll: () => [],
    };
    const controllers = [new THREE.Group(), new THREE.Group()];
    let session = null;
    const xr = {
        enabled: false,
        setFoveation() {},
        getController: (i) => controllers[i],
        addEventListener() {},
        getSession: () => session,
        getReferenceSpace: () => ({}),
    };
    const renderer = {
        xr,
        domElement: element(),
        setPixelRatio() {},
        setSize() {},
        setAnimationLoop(fn) {
            this.loop = fn;
        },
        render() {},
    };
    const location = new URL('https://example.test/pastracing2/' + search);
    const context = vm.createContext({
        THREE: {
            ...THREE,
            WebGLRenderer: class {
                constructor() {
                    return renderer;
                }
            },
            TextureLoader: class {
                async loadAsync() {
                    const t = new THREE.Texture({ width, height });
                    return t;
                }
            },
        },
        OrbitControls: class {},
        createARButton,
        planarStep,
        controllerForHand,
        composePosition,
        fitSimilarity,
        intersectSelectedPlane,
        intersectWall,
        persistSnapshot,
        withTimeout,
        openWorkDatabase: async () => ({}),
        readLastWork: async () => stored,
        readLegacyWork: async () => legacy,
        writeLastWork: async (_, work) => {
            written = work;
        },
        fetch: async (url) => {
            requests.push(url);
            if (fetchFail) throw Error('offline');
            return { ok: true, blob: async () => image };
        },
        document,
        window: { innerWidth: 1200, innerHeight: 900, devicePixelRatio: 1, location, addEventListener() {} },
        location,
        navigator: {},
        URL,
        Blob,
        performance,
        console: { error() {}, warn() {} },
        XRRigidTransform: class {
            constructor(position, orientation) {
                this.position = position;
                this.orientation = orientation;
            }
        },
    });
    vm.runInContext('const createARButton = ' + createARButton.toString() + ';', context);
    vm.runInContext(script, context);
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
    return {
        context,
        document,
        elements,
        requests,
        renderer,
        controllers,
        get written() {
            return written;
        },
        evaluate: (code) => vm.runInContext(code, context),
        setSession: (value) => {
            session = value;
        },
        close: () => vm.runInContext('if(imageObjectUrl)URL.revokeObjectURL(imageObjectUrl);', context),
    };
}

test('app initializes with the bundled mural, caches its blob and preserves aspect ratio', async () => {
    const app = await appHarness();
    assert.deepEqual(app.requests, ['https://example.test/pastracing2/Images/mural.png']);
    assert.equal(app.evaluate('imageBlob'), image);
    assert.ok(
        Math.abs(
            app.evaluate('imagePlane.geometry.parameters.width/imagePlane.geometry.parameters.height') -
                width / height,
        ) < 1e-10,
    );
    assert.ok(app.elements.get('ARButton'));
    app.close();
});
test('explicit image URL takes priority over the bundled default', async () => {
    const app = await appHarness({ search: '?image=https%3A%2F%2Fexample.test%2Fcustom.png' });
    assert.deepEqual(app.requests, ['https://example.test/custom.png']);
    app.close();
});
test('continuing saved work uses its own cached image even without a connection', async () => {
    const stored = {
        version: 2,
        image,
        anchorId: 'saved',
        imageUrl: 'https://external.test/old.png',
        length: 0.5,
        scale: 4,
        opacity: 0.4,
        sourcePoints: [{ x: 0.1, y: 0.2 }],
    };
    const app = await appHarness({ stored, fetchFail: true });
    await app.elements.get('continueWork').onclick();
    assert.equal(app.evaluate('imageBlob'), image);
    assert.equal(app.evaluate('currentScale'), 4);
    assert.equal(app.evaluate('restoringAnchor'), true);
    assert.equal(app.requests.length, 1);
    app.close();
});
test('legacy import copies work into the new store before resuming', async () => {
    const legacy = { version: 1, image, anchorId: 'legacy', length: 0.5, scale: 2, opacity: 0.6 };
    const app = await appHarness({ legacy });
    assert.equal(app.elements.get('importWork').hidden, false);
    await app.elements.get('importWork').onclick();
    assert.equal(app.written, legacy);
    assert.equal(app.evaluate('imageBlob'), image);
    app.close();
});
test('real Three.js geometry aligns a mural on a rotated wall and allows millimetre adjustment', async () => {
    const app = await appHarness();
    app.evaluate(`
        selectedWall={position:new THREE.Vector3(1,2,-3),normal:new THREE.Vector3(1,0,0),quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2)};
        sourcePoints=[{x:0.1,y:0.1},{x:0.9,y:0.2},{x:0.3,y:0.9}];
        stage='target';trackingAvailable=true;
        for(const p of sourcePoints){
            const world=new THREE.Vector3((p.x-0.5)*imagePlane.geometry.parameters.width*4+0.1,(p.y-0.5)*imagePlane.geometry.parameters.height*4+0.2,0).applyQuaternion(selectedWall.quaternion).add(selectedWall.position);
            captureWallPoint(world);
        }
        applyImagePose();
    `);
    assert.ok(Math.abs(app.evaluate('currentScale') - 4) < 1e-10);
    assert.equal(app.evaluate('stage'), 'adjust');
    assert.ok(app.evaluate('alignment.maxError') < 1e-10);
    const before = app.evaluate('group.position.clone()');
    app.evaluate("fineAdjust('x+');");
    const after = app.evaluate('group.position.clone()');
    assert.ok(Math.abs(before.distanceTo(after) - 0.001) < 1e-10);
    app.evaluate("workflowAction('lock');fineAdjust('x+');");
    assert.ok(app.evaluate('group.position.clone()').distanceTo(after) < 1e-10);
    assert.equal(app.evaluate('locked'), true);
    app.close();
});
test('choosing another wall is explicit and preserves source references for recalibration', async () => {
    const app = await appHarness();
    app.evaluate(
        "sourcePoints=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];locked=true;stage='draw';placementPoint=new THREE.Vector3();workflowAction('wall');",
    );
    assert.equal(app.evaluate('selectedWall'), null);
    assert.equal(app.evaluate('stage'), 'place');
    assert.equal(app.evaluate('locked'), false);
    assert.equal(app.evaluate('sourcePoints.length'), 3);
    app.close();
});

test('actual wall input cannot jump to a column or clear adjustments on another trigger press', async () => {
    const app = await appHarness();
    const right = {
        handedness: 'right',
        targetRaySpace: {},
        gamepad: {
            mapping: 'xr-standard',
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 6 }, () => ({ pressed: false })),
        },
    };
    const session = { inputSources: [right] };
    app.context.rightSource = right;
    app.setSession(session);
    app.evaluate(`
        controllerBindings.set(rightSource,controller1);trackingAvailable=true;manualMode=false;stage='place';
        currentWalls=[{orientation:'vertical',semanticLabel:'wall',position:new THREE.Vector3(0,0,-3),normal:new THREE.Vector3(0,0,1),polygon:[{x:-5,z:-5},{x:5,z:-5},{x:5,z:5},{x:-5,z:5}],worldToLocal:p=>new THREE.Vector3(p.x,p.z,p.y)}];
    `);
    const frame = { getPose: () => ({}) };
    right.gamepad.buttons[0].pressed = true;
    app.context.testFrame = frame;
    app.evaluate('updateInput(testFrame);applyImagePose();');
    assert.equal(app.evaluate('selectedWall.position.z'), -3);
    assert.equal(app.evaluate('stage'), 'adjust');
    right.gamepad.buttons[0].pressed = false;
    app.evaluate(
        'updateInput(testFrame);localOffset.x=0.15;applyImagePose();currentWalls.unshift({...currentWalls[0],position:new THREE.Vector3(0,0,-1)});',
    );
    const before = app.evaluate('group.position.clone()');
    right.gamepad.buttons[0].pressed = true;
    app.evaluate('updateInput(testFrame);applyImagePose();');
    assert.ok(before.distanceTo(app.evaluate('group.position.clone()')) < 1e-10);
    assert.equal(app.evaluate('selectedWall.position.z'), -3);
    app.close();
});
test('saving twice uses the loaded image and retires the previous persistent handle after commit', async () => {
    const app = await appHarness();
    const deleted = [];
    let counter = 0;
    const session = {
        inputSources: [],
        restorePersistentAnchor() {},
        addEventListener() {},
        removeEventListener() {},
        deletePersistentAnchor: async (id) => deleted.push(id),
        requestAnimationFrame: (fn) =>
            fn(0, {
                createAnchor: async () => ({
                    delete() {},
                    requestPersistentHandle: async () => 'anchor-' + ++counter,
                }),
            }),
    };
    app.setSession(session);
    app.evaluate(
        "placementPoint=new THREE.Vector3();placementQuaternion=new THREE.Quaternion();trackingAvailable=true;stage='adjust';",
    );
    await app.evaluate('saveWork({})');
    await app.evaluate('saveWork({})');
    assert.equal(app.requests.length, 1);
    assert.equal(app.written.anchorId, 'anchor-2');
    assert.deepEqual(deleted, ['anchor-1']);
    assert.equal(app.written.image, image);
    app.close();
});

test('large opaque menu fits a central viewing cone and stays put when the head turns', async () => {
    const app = await appHarness();
    app.setSession({});
    app.evaluate("stage='adjust';uiPage='fine';refreshWorkflow();setPanelOpen(true);placeWorkflowPanel();");
    const panel = app.evaluate('workflowPanel');
    const eye = app.evaluate('camera.position.clone()');
    assert.equal(panel.parent, app.evaluate('scene'));
    assert.equal(panel.position.x, eye.x);
    const material = app.evaluate('uiTargets[0].material');
    assert.equal(material.depthTest, false);
    assert.equal(material.depthWrite, false);
    assert.equal(material.transparent, true);
    assert.equal(material.opacity, 1);
    assert.ok(app.evaluate('uiTargets[0].renderOrder') >= 1000);
    for (const mesh of app.evaluate('[workflowStatus,...uiTargets]')) {
        const { width, height } = mesh.geometry.parameters;
        for (const x of [-width / 2, width / 2])
            for (const y of [-height / 2, height / 2]) {
                const corner = new THREE.Vector3(x, y, 0)
                    .applyMatrix4(mesh.matrix.clone().compose(mesh.position, mesh.quaternion, mesh.scale))
                    .add(panel.position)
                    .sub(eye);
                assert.ok(Math.abs(Math.atan2(corner.x, -corner.z)) < Math.PI / 6);
                assert.ok(Math.abs(Math.atan2(corner.y, -corner.z)) < Math.PI / 6);
            }
    }
    const fixedPosition = panel.position.clone(),
        fixedRotation = panel.quaternion.clone();
    app.evaluate('camera.rotation.y=0.6;placeWorkflowPanel();');
    assert.ok(panel.position.distanceTo(fixedPosition) < 1e-10);
    assert.ok(panel.quaternion.angleTo(fixedRotation) < 1e-10);
    app.evaluate('setPanelOpen(false);setPanelOpen(true);placeWorkflowPanel();');
    assert.ok(panel.position.distanceTo(fixedPosition) > 0.1);
    app.close();
});

test('right joystick click toggles the panel once per press without changing mural placement', async () => {
    const app = await appHarness();
    const right = {
        handedness: 'right',
        targetRaySpace: {},
        gamepad: {
            mapping: 'xr-standard',
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 6 }, () => ({ pressed: false })),
        },
    };
    app.context.rightSource = right;
    app.context.testFrame = { getPose: () => ({}) };
    app.setSession({ inputSources: [right] });
    app.evaluate(
        "controllerBindings.set(rightSource,controller1);trackingAvailable=true;stage='adjust';locked=true;setPanelOpen(true);",
    );
    const initial = app.evaluate('basePosition.clone()');
    right.gamepad.buttons[3].pressed = true;
    app.evaluate('updateInput(testFrame);');
    assert.equal(app.evaluate('panelOpen'), false);
    assert.equal(app.evaluate('workflowPanel.visible'), false);
    app.evaluate('updateInput(testFrame);');
    assert.equal(app.evaluate('panelOpen'), false);
    right.gamepad.buttons[3].pressed = false;
    app.evaluate('updateInput(testFrame);');
    right.gamepad.buttons[3].pressed = true;
    app.evaluate('updateInput(testFrame);');
    assert.equal(app.evaluate('panelOpen'), true);
    assert.equal(app.evaluate('locked'), true);
    assert.ok(initial.distanceTo(app.evaluate('basePosition.clone()')) < 1e-10);
    app.close();
});

test('menu uses the current viewer pose when opening, including the first XR frame', async () => {
    const app = await appHarness();
    app.setSession({});
    app.context.panelFrame = {
        getViewerPose: () => ({
            transform: { position: { x: 2, y: 1.6, z: -4 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        }),
    };
    app.evaluate('setPanelOpen(true);placeWorkflowPanel(panelFrame);');
    const panel = app.evaluate('workflowPanel.position');
    assert.equal(panel.x, 2);
    assert.ok(Math.abs(panel.y - 1.58) < 1e-10);
    assert.ok(Math.abs(panel.z + 5.15) < 1e-10);
    app.close();
});

test('a save committed while AR ends remains recoverable on the next session', async () => {
    const app = await appHarness();
    const session = {
        inputSources: [],
        restorePersistentAnchor() {},
        addEventListener() {},
        removeEventListener() {},
        requestAnimationFrame: (fn) =>
            fn(0, {
                createAnchor: async () => ({
                    delete() {},
                    requestPersistentHandle: async () => 'committed-after-exit',
                }),
            }),
    };
    app.setSession(session);
    app.context.writeLastWork = async () => {
        app.setSession(null);
        app.evaluate('onSessionEnd();');
    };
    app.evaluate(
        "placementPoint=new THREE.Vector3();placementQuaternion=new THREE.Quaternion();trackingAvailable=true;stage='adjust';",
    );
    await app.evaluate('saveWork({})');
    assert.equal(app.evaluate('savedWork.anchorId'), 'committed-after-exit');
    assert.equal(app.evaluate('restoringAnchor'), true);
    assert.equal(app.evaluate('saving'), false);
    app.close();
});
