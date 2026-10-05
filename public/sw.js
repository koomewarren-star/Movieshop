/*
 * MovieShop service worker.
 *
 * Design constraints, in priority order:
 *
 *   1. Never break live data. `/api/*` (TMDB search and details) is always
 *      network-only. Caching it would serve stale catalogues and stale cast
 *      lists, which is worse than a spinner.
 *   2. Never cache third-party playback. YouTube trailers and the stream embeds
 *      are opaque to us — hands off entirely, and don't touch their responses.
 *   3. Never cache the dev server. Registration is gated to production in
 *      `components/InstallPrompt.tsx`; this file also refuses non-HTTP origins
 *      so a stray registration can't wedge local development.
 *
 * Bump CACHE_VERSION to invalidate everything on the next activate.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `movieshop-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `movieshop-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `movieshop-images-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline', '/manifest.webmanifest'];

const IMAGE_CACHE_LIMIT = 120;

/** Hosts the worker never touches. */
const OPAQUE_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'i.ytimg.com',
  'api.codespecters.com',
  'embedmaster.link',
  'vidsrc.cc',
  'autoembed.co',
];

/* ------------------------------------------------------------------ *
 * Install
 * ------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 cannot fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

/* ------------------------------------------------------------------ *
 * Activate — drop caches from older versions
 * ------------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

/** Network-first, falling back to cache, then the offline page. */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="background:#000;color:#fff;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
        '<div style="text-align:center"><h1 style="color:#EF4444">You are offline</h1>' +
        '<p style="color:#888">Reconnect to keep watching.</p></div>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/** Cache-first: for content-hashed build output, the URL changes when it does. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/** Stale-while-revalidate: TMDB posters are immutable per poster path. */
async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(cacheName, limit));
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

/* ------------------------------------------------------------------ *
 * Fetch router
 * ------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 1. Live API — never cached, never intercepted.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Third-party playback and trailers — hands off.
  if (url.origin !== self.location.origin && OPAQUE_HOSTS.includes(url.hostname)) {
    return;
  }

  // 3. Navigations — network first so content updates are picked up.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 4. Hashed build output — safe to serve from cache indefinitely.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname))
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // 5. TMDB artwork — immutable paths, revalidate in the background.
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
  }
});

/* ------------------------------------------------------------------ *
 * Messages from the page
 * ------------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
