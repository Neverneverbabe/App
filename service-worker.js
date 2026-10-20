// service-worker.js
//
// Strategy (changed from the old cache-first-for-everything worker):
//  - App shell (HTML, JS, CSS, icons): stale-while-revalidate. Users get the
//    cached copy instantly, and the fresh copy in the background — the old
//    worker served the first cached version *forever* until CACHE_NAME was
//    manually bumped, so bug fixes never reached installed users.
//  - TMDB API + Firebase/Firestore: network only, never cached here.
//    Caching auth/firestore responses can leak one user's library to the
//    next user on a shared device and breaks real-time updates.
//  - On fetch failure, respondWith() always resolves to a Response
//    (the old worker could resolve to `undefined`, which throws).
//
// Bump CACHE_VERSION whenever the shell file list changes.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `watch-tv-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './config.js',
  './api.js',
  './ui.js',
  './main.js',
  './ratingUtils.js',
  './firebase-config.js',
  './SignIn/firebase.js',
  './SignIn/firebase_api.js',
  './SignIn/auth.js',
  './modules/contentManager.js',
  './modules/search.js',
  './modules/seenItems.js',
  './modules/libraryManager.js',
  './modules/netflixModal.js',
  './modules/track.js',
  './modules/escape.js',
  './modules/player.js',
  './modules/episodes.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache files individually: one 404 in addAll() used to reject the
      // whole install and leave the app with no offline shell at all.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

const NEVER_CACHE = [
  'api.themoviedb.org',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase',
];

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (NEVER_CACHE.some((host) => request.url.includes(host))) return; // network only

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && new URL(request.url).origin === self.location.origin) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);
      // Stale-while-revalidate: cached copy wins instantly if we have one.
      return cached || (await network) || new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    })(),
  );
});
