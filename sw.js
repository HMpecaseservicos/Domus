/**
 * DOMUS Service Worker
 * Offline support and caching
 */

const CACHE_VERSION = 'domus-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/vitamind.css',
  '/modules/utils.js',
  '/modules/app.js',
  '/modules/auth.js',
  '/modules/finances.js',
  '/modules/tasks.js',
  '/modules/thoughts.js',
  '/modules/gratitude.js',
  '/modules/purpose.js',
  '/modules/patterns.js',
  '/modules/habits.js',
  '/manifest.json'
];

const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll([...STATIC_ASSETS, ...EXTERNAL_ASSETS]);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - Network First for app assets, Cache First for external
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // API requests - Network only, no cache
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Você está offline' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Same-origin assets (HTML, CSS, JS) — Network First
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              if (request.headers.get('accept')?.includes('text/html')) {
                return caches.match('/index.html');
              }
              return new Response('Offline', { status: 503 });
            });
        })
    );
    return;
  }

  // External assets (CDN fonts, libraries) — Cache First
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_VERSION)
                .then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          });
      })
  );
});

// Background sync for pending data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    // Future: Implement background sync for offline data
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'DOMUS', {
      body: data.body || 'Nova notificação',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: data.tag || 'domus-notification',
      data: data.url || '/'
    })
  );
});

// Listen for SKIP_WAITING message from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING, activating immediately');
    self.skipWaiting();
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data || '/');
        }
      })
  );
});

console.log('[SW] Service Worker loaded');
