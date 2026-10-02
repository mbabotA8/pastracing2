const CACHE = 'pastracing2-v4-20261002-1';
const assets = [
    './',
    './index.html',
    './v2-storage.mjs',
    './v2-wall.mjs',
    './v3-controls.mjs',
    './v3-session.mjs',
    './v4-alignment.mjs',
    './v4-save.mjs',
    './Images/mural.png',
    './Images/calibration.svg',
    'https://unpkg.com/three@0.147.0/build/three.module.js',
    'https://unpkg.com/three@0.147.0/examples/jsm/controls/OrbitControls.js',
];
self.addEventListener('install', (event) =>
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE);
            for (const asset of assets) {
                const request = new Request(new URL(asset, self.registration.scope), {
                    mode: 'cors',
                    cache: 'reload',
                });
                const response = await fetch(request);
                if (!response.ok) throw Error('No se pudo preparar el modo sin conexión.');
                await cache.put(request, response);
            }
            await self.skipWaiting();
        })(),
    ),
);
self.addEventListener('activate', (event) =>
    event.waitUntil(
        (async () => {
            for (const key of await caches.keys())
                if (key.startsWith('pastracing2-v4-') && key !== CACHE) await caches.delete(key);
            await self.clients.claim();
        })(),
    ),
);
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    // Only the app shell and pinned library are cached; user-provided URLs are not.
    if (
        !url.href.startsWith(self.registration.scope) &&
        !url.href.startsWith('https://unpkg.com/three@0.147.0/')
    )
        return;
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE);
            try {
                const response = await fetch(event.request);
                if (response.ok) await cache.put(event.request, response.clone());
                return response;
            } catch (error) {
                const cached = await cache.match(event.request);
                if (cached) return cached;
                if (event.request.mode === 'navigate')
                    return await cache.match(new URL('./index.html', self.registration.scope));
                throw error;
            }
        })(),
    );
});
