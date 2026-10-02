import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function workerHarness() {
    const events = new Map(),
        entries = new Map(),
        deleted = [];
    const key = (request) => (typeof request === 'string' ? request : request.url || request.href);
    const cache = {
        put: async (request, response) => entries.set(key(request), response),
        match: async (request) => entries.get(key(request)),
    };
    let online = true;
    const context = vm.createContext({
        URL,
        Request,
        Response,
        self: {
            registration: { scope: 'https://example.test/pastracing2/' },
            addEventListener: (name, fn) => events.set(name, fn),
            skipWaiting: async () => {},
            clients: { claim: async () => {} },
        },
        caches: {
            open: async () => cache,
            keys: async () => ['other-project', 'pastracing2-v4-old', 'pastracing2-v4-20261002-1'],
            delete: async (name) => deleted.push(name),
        },
        fetch: async (request) => {
            if (!online) throw Error('offline');
            return new Response('cached ' + key(request), { status: 200 });
        },
    });
    vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
    return {
        events,
        entries,
        deleted,
        offline: () => (online = false),
        run: async (name) => {
            let promise;
            events.get(name)({ waitUntil: (p) => (promise = p) });
            await promise;
        },
        fetch: async (request) => {
            let response;
            events.get('fetch')({ request, respondWith: (p) => (response = p) });
            return await response;
        },
    };
}
test('offline cache includes the default image and pinned library without deleting other projects', async () => {
    const h = workerHarness();
    await h.run('install');
    await h.run('activate');
    assert.ok(h.entries.has('https://example.test/pastracing2/Images/mural.png'));
    assert.ok(h.entries.has('https://unpkg.com/three@0.147.0/build/three.module.js'));
    assert.deepEqual(h.deleted, ['pastracing2-v4-old']);
});
test('offline navigation with image query falls back to the app shell and cached modules', async () => {
    const h = workerHarness();
    await h.run('install');
    h.offline();
    const response = await h.fetch({
        url: 'https://example.test/pastracing2/?image=https://external.test/example.png',
        method: 'GET',
        mode: 'navigate',
    });
    assert.match(await response.text(), /index.html/);
    const module = await h.fetch(new Request('https://example.test/pastracing2/v4-save.mjs'));
    assert.match(await module.text(), /v4-save.mjs/);
});
