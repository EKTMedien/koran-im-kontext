// Service Worker: hält die App-Dateien offline bereit. Die Rezitationen verwaltet audio.js selbst.
const VERSION = "kik-shell-5436a3ec968b";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png", "audio.js", "brennpunkte.js", "data-suren.js", "duas.js", "gebetszeiten.js", "glossar.js", "lektionen1.js", "lektionen10.js", "lektionen11.js", "lektionen12.js", "lektionen13.js", "lektionen2.js", "lektionen3.js", "lektionen4.js", "lektionen5.js", "lektionen6.js", "lektionen7.js", "lektionen8.js", "lektionen9.js", "qibla.js", "suratext.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("kik-shell-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(resp => {
        if (resp.ok) { const copy = resp.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return resp;
      }).catch(() => req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open("kik-fonts").then(c => c.match(req).then(hit => hit || fetch(req).then(resp => {
        c.put(req, resp.clone()); return resp;
      }).catch(() => Response.error())))
    );
  }
});
