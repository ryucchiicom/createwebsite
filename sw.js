// sw.js
const CACHE_NAME = 'site-shell-v1';
const INDEX_URL = new URL('./', self.location.href).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve();
      })
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // ページ本体はネットワーク優先。失敗したらキャッシュ。
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request, { cache: 'no-store' });

        const cache = await caches.open(CACHE_NAME);
        cache.put(INDEX_URL, networkResponse.clone());

        return networkResponse;
      } catch (error) {
        const cachedResponse = await caches.match(INDEX_URL);
        if (cachedResponse) {
          return cachedResponse;
        }

        throw error;
      }
    })());

    return;
  }

  // 同じサイト内の他ファイルはキャッシュ優先＋裏で更新
  if (requestUrl.origin === self.location.origin) {
    event.respondWith((async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        return cachedResponse || Response.error();
      }
    })());
  }
});
