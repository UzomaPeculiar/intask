/* InTask service worker — cache versioning, app-shell precache, offline fallback.
 * Bump CACHE_VERSION on every deploy to force a clean cache refresh. */
const CACHE_VERSION = "v1";
const PRECACHE = `intask-precache-${CACHE_VERSION}`;
const RUNTIME = `intask-runtime-${CACHE_VERSION}`;

// The app shell: enough to render the app and a branded offline page.
// The root document is rendered by the server per-request, so it is precached
// defensively (see precacheShell) and always refreshed via network-first.
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
  // No skipWaiting() here on purpose: when an older SW already controls the
  // page, the new one stays in "waiting" state until the page confirms the
  // update (see the message handler below), so we can prompt the user first.
  // A first-ever install still activates immediately (nothing to wait for).
});

// The page sends this after the user accepts the update prompt.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache cross-origin requests (Supabase data/auth, Paystack, Google
  // Fonts) — they contain user-specific data and must always hit the network.
  if (url.origin !== self.location.origin) return;

  // HTML navigations: fresh from the network when online, cached/offline page
  // when not.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Content-hashed static assets: serve from cache instantly, refresh in the
  // background so a deploy's new hashes are picked up on the next load.
  if (/\.(?:js|mjs|css|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function precacheShell() {
  const cache = await caches.open(PRECACHE);
  // allSettled so one flaky request (e.g. a slow SSR root) can't fail install.
  await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    // Server error — fall back to a cached copy of this page if we have one.
    const cached = await cache.match(request);
    if (cached) return cached;
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline and never visited this URL: serve the app shell (client router
    // handles the route) or the branded offline page.
    return (await caches.match("/")) || (await caches.match("/offline.html"));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}
