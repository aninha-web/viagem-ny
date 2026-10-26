// Guarda o app no celular para ele abrir mesmo sem internet.
var CACHE = 'viagem-v1';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (url.origin === self.location.origin) {
    // Página: tenta a versão nova primeiro; sem internet, usa a guardada.
    if (e.request.mode === 'navigate') {
      e.respondWith(
        fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        }).catch(function () { return caches.match('./index.html'); })
      );
      return;
    }
    e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
    return;
  }

  // Fontes do Google: guarda depois da primeira vez.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(e.request).then(function (r) {
          return r || fetch(e.request).then(function (res) { c.put(e.request, res.clone()); return res; });
        });
      })
    );
  }
});
