/*! MediaShrink Offline-First Service Worker with COOP/COEP support */
const CACHE_NAME = 'mediashrink-v2';

let coepCredentialless = false;

if (typeof window === 'undefined') {
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      }).then(() => self.clients.claim())
    );
  });

  self.addEventListener('message', (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'deregister') {
      self.registration.unregister().then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET') return;

    // Handle caching and COOP/COEP header injection
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Fetch from network with fallback to cache
        const networkFetch = fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Clone response and store in cache
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          // Inject COOP and COEP headers for SharedArrayBuffer support
          const newHeaders = new Headers(networkResponse.headers);
          newHeaders.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(networkResponse.body, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: newHeaders,
          });
        }).catch(() => {
          // If offline and request fails, return cached response if available
          if (cachedResponse) {
            const newHeaders = new Headers(cachedResponse.headers);
            newHeaders.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
            newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: newHeaders,
            });
          }
          return new Response('Offline: MediaShrink cache unavailable', { status: 503, statusText: 'Offline' });
        });

        // Return cached response immediately if available and we are offline, or let network fetch resolve
        return cachedResponse ? (navigator.onLine === false ? cachedResponse : networkFetch) : networkFetch;
      })
    );
  });
} else {
  (() => {
    const n = window.navigator;
    const isSecureContext = window.isSecureContext;
    const isCrossOrigin = window.crossOriginIsolated;

    if (!isCrossOrigin && isSecureContext) {
      if ('serviceWorker' in n) {
        n.serviceWorker.register(window.document.currentScript.src).then(
          (registration) => {
            registration.addEventListener('updatefound', () => {
              window.location.reload();
            });
            if (registration.active && !n.serviceWorker.controller) {
              window.location.reload();
            }
          },
          (err) => {
            console.warn('MediaShrink Service Worker registration failed: ', err);
          }
        );
      }
    }
  })();
}
