/* sw.js - the service worker that lets Hepozy install as an app.
   Network first: the page and scripts always come fresh from the server when you are online, so updates show
   immediately. The saved copy is only used when the connection is gone. Chat, files, login and every API call
   are never saved or touched. */
var VERSION = "hepozy-v1";
var NEVER = /\/(chat|files|file-info|file-thumb|attachment-thumb|auth|search|health|robots\.txt)(\/|\?|$)/;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname)) return;
  if (req.headers.has("range") || req.headers.has("authorization")) return;
  var d = req.destination;
  if (req.mode !== "navigate" && ["script", "style", "image", "font", "manifest"].indexOf(d) < 0) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req.mode === "navigate" ? "/" : req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req.mode === "navigate" ? "/" : req).then(function (hit) {
        return hit || new Response("You are offline. Reconnect to use Hepozy.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
    })
  );
});