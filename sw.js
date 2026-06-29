/* Nexo Hub Service Worker
   - Precaches the app shell so the site opens (and basic nav works) offline.
   - Static assets (css/js/images): stale-while-revalidate.
   - HTML pages: network-first, falling back to cache, then to /offline.html.
   - Cross-origin requests (Supabase API, Google favicons, fonts) are left
     completely untouched so live data, visit counts, and approvals never
     go stale because of the service worker.
*/

const SW_VERSION   = 'v1';
const CACHE_NAME   = `nexohub-${SW_VERSION}`;
const OFFLINE_URL  = '/offline.html';

const CORE_ASSETS = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/offline.html',
  '/assets/logo.png',
  '/assets/logo-192.png',
  '/assets/logo-512.png',
  '/assets/favicon-32.png',
  '/assets/favicon-64.png',
  '/pages/tools/',
  '/pages/about/',
  '/pages/new/',
  '/pages/leaderboard/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('nexohub-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match(OFFLINE_URL);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch cross-origin requests (Supabase, fonts, favicon CDN, ads, etc.)
  if (url.origin !== self.location.origin) return;

  // Never cache the JSON data snapshots or the admin panel.
  if (url.pathname.startsWith('/json/') || url.pathname.startsWith('/pages/admin/')) return;

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
