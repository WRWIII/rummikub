/**
 * Hand-written service worker.
 *
 * A precache-manifest generator (Serwist/Workbox) earns its keep on a site
 * with dozens of hashed build files. This app's entire cache surface is three
 * documents, one JS bundle, one stylesheet and a few icons — and everything
 * under /_next/static is ALREADY content-hashed and immutable, so a runtime
 * cache-on-fetch rule replaces the whole precache manifest for free.
 *
 * Versioning without a build plugin: the page registers this script as
 * /sw.js?v=<build id>. A different URL is a different script to the browser,
 * so every deploy is guaranteed to trigger an update, and the worker reads its
 * own version straight out of its own URL.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `rkt-${VERSION}`;

const SHELL = [
  "/",
  "/score/",
  "/settings/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Individually, so one missing entry can't fail the whole install.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  // Deliberately no unconditional skipWaiting(): swapping the bundle under a
  // page with a running timer is user-hostile. The page offers the reload.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations go network-first, so nobody is ever stranded on a stale build
  // while online, but the app still opens on a plane.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          return (
            (await caches.match(request)) ??
            (await caches.match("/")) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Everything else cache-first: /_next/static filenames are content-hashed,
  // so a cache hit can never be stale.
  event.respondWith(
    (async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
