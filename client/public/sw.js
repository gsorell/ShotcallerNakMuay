// Service Worker for Shotcaller Nak Muay PWA
const CACHE_NAME = 'nak-muay-v1';
const STATIC_CACHE = 'nak-muay-static-v1';
const AUDIO_CACHE = 'nak-muay-audio-v1';

// Core files that should always be cached
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/hero_mobile.png',
  '/assets/hero_tablet.png', 
  '/assets/hero_desktop.png',
  '/assets/logo_icon.png',
  '/assets/Logo_Header_Banner_Smooth.png'
];

// Audio files for offline functionality
const AUDIO_ASSETS = [
  '/big-bell-330719.mp3',
  '/interval.mp3'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache core static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(CORE_ASSETS);
      }),
      // Cache audio assets separately
      caches.open(AUDIO_CACHE).then((cache) => {
        return cache.addAll(AUDIO_ASSETS);
      })
    ]).then(() => {
      // Force the waiting service worker to become active
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== STATIC_CACHE && 
              cacheName !== AUDIO_CACHE && 
              cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Ensure the new service worker takes control immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle same-origin requests
  if (url.origin === self.location.origin) {
    // Audio files - cache first, then network
    if (request.url.includes('.mp3') || request.url.includes('.wav')) {
      event.respondWith(
        caches.open(AUDIO_CACHE).then((cache) => {
          return cache.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return fetch(request).then((networkResponse) => {
              // Cache the audio file for future use - clone first
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                cache.put(request, responseClone);
              }
              return networkResponse;
            });
          });
        })
      );
      return;
    }

    // Static assets - cache first, then network
    if (request.url.includes('/assets/') || 
        request.destination === 'image' ||
        request.destination === 'font') {
      event.respondWith(
        caches.open(STATIC_CACHE).then((cache) => {
          return cache.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return fetch(request).then((networkResponse) => {
              // Only cache successful responses - clone first
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                cache.put(request, responseClone);
              }
              return networkResponse;
            });
          });
        })
      );
      return;
    }

    // HTML/JS/CSS - network first, then cache
    if (request.destination === 'document' || 
        request.destination === 'script' ||
        request.destination === 'style') {
      event.respondWith(
        fetch(request).then((networkResponse) => {
          // Cache successful responses - clone first to avoid "body already used" error
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fallback to cache if network fails
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
      );
      return;
    }
  }

  // For all other requests, just use network
  event.respondWith(fetch(request));
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for workout logging (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'workout-sync') {
    event.waitUntil(syncWorkoutData());
  }
});

async function syncWorkoutData() {
  // Future: sync workout logs when back online
  console.log('Background sync triggered for workout data');
}