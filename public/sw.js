// Service Worker for Shotcaller Nak Muay PWA

// Bump this to evict every cache below. The `activate` handler deletes any
// cache whose name is not one of the three current ones, so changing the
// version is the thing that forces returning visitors onto fresh files.
//
// It sat at v1 from the day the PWA shipped, and that was the bug. Technique
// sheets, icons and manifest.json all live at stable paths under /assets/ and
// were served cache-first with no revalidation, so whichever copy a browser
// downloaded first was pinned to that URL forever - the retouched sprites
// never reached anyone who had already visited the site. The strategies below
// stop that recurring; this bump is what repairs the browsers already holding
// a stale copy.
const SW_VERSION = 'v3';
const CACHE_NAME = `nak-muay-${SW_VERSION}`;
const STATIC_CACHE = `nak-muay-static-${SW_VERSION}`;
const AUDIO_CACHE = `nak-muay-audio-${SW_VERSION}`;

// Core files that should always be cached
// `/` is the marketing page now, not the app, so it is deliberately absent -
// precaching it would put a document this worker has no business serving into
// the app's own cache. `/index.html` is the app on Netlify AND inside the
// Capacitor shells, which is why it is named directly rather than as `/app`:
// the native WebView has no rewrite rules and would 404 on that, failing the
// whole `addAll` and leaving the worker uninstalled.
const CORE_ASSETS = [
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

/**
 * Whether a URL carries a content hash, and so can be cached forever.
 *
 * Matches Vite's own build output and nothing else - `<name>-<hash>.js|css`,
 * as in /assets/index-BRV1O1Ig.js. A fingerprinted URL cannot change meaning:
 * new contents get a new name. Nothing copied out of public/ is fingerprinted,
 * which is precisely why everything else has to revalidate.
 */
const isFingerprinted = (url) =>
  /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(url.pathname);

/** Immutable by construction, so the network is never worth asking. */
const cacheFirst = (request, cacheName) =>
  caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200) cache.put(request, response.clone());
        return response;
      });
    })
  );

/**
 * Serve the cached copy at once, and refresh it behind the request.
 *
 * The revalidation is handed to waitUntil rather than left dangling. A browser
 * is free to kill an idle worker the moment respondWith settles, and a fetch
 * nobody is waiting on is exactly the thing that gets killed - so without it
 * the cache would frequently never update, which is this same bug wearing a
 * different hat.
 */
const staleWhileRevalidate = (event, request, cacheName) =>
  caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.status === 200) cache.put(request, response.clone());
          return response;
        })
        .catch((err) => {
          // Offline with a copy in hand is fine. Offline with nothing is a
          // real miss, and rejecting lets the browser show its own error
          // rather than handing the page a fabricated empty response.
          if (cached) return cached;
          throw err;
        });
      event.waitUntil(network.catch(() => {}));
      return cached || network;
    })
  );

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip analytics and external tracking requests
  if (url.hostname.includes('google-analytics.com') ||
      url.hostname.includes('googletagmanager.com') ||
      url.hostname.includes('doubleclick.net')) {
    return; // Let browser handle these normally
  }

  // Handle same-origin requests
  if (url.origin === self.location.origin) {
    // Audio files - cache first, and deliberately still cache-first. These
    // are large, numerous and almost never re-cut, so revalidating every one
    // on every load would cost megabytes to catch a change that rarely comes.
    // When one IS re-cut, bump SW_VERSION; that is what the knob is for.
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

    // Static assets. Two strategies, and which one applies turns on whether
    // the URL is capable of changing meaning.
    //
    // Vite fingerprints its own bundles, so /assets/index-BRV1O1Ig.js is
    // immutable and cache-first is both free and correct. Everything else
    // under /assets/ is copied out of public/ verbatim and keeps a stable
    // name: /assets/technique/jab.webp is a different picture after a retouch
    // but the same URL, and cache-first can never find that out. Those get
    // stale-while-revalidate - instant from cache, refreshed behind the
    // request - so an updated asset heals itself in one visit instead of
    // never.
    if (request.url.includes('/assets/') ||
        request.destination === 'image' ||
        request.destination === 'font') {
      event.respondWith(
        isFingerprinted(url)
          ? cacheFirst(request, STATIC_CACHE)
          : staleWhileRevalidate(event, request, STATIC_CACHE)
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

  // For all other requests, try network with cache fallback
  event.respondWith(
    fetch(request).catch(() => {
      // If fetch fails, try to serve from cache
      return caches.match(request);
    })
  );
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