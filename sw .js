// Guarda o app no celular para ele abrir mesmo sem internet.
var CACHE = 'viagem-v2';
var EXTRAS = 'viagem-extras-v1';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== EXTRAS; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function cacheFirst(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (r) {
      return r || fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
    });
  });
}

// Usa o que está guardado na hora e atualiza por trás (linhas e estações do metrô).
function staleWhileRevalidate(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (r) {
      var net = fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      if (r) { net.catch(function () {}); return r; }
      return net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (url.origin === self.location.origin) {
    // Página: tenta a versão nova primeiro; sem internet, usa a guardada.
    if (e.request.mode === 'navigate') {
      e.respondWith(
        fetch(e.request).then(function (res) {
          // Se o site der erro (ex.: arquivo com nome errado), usa a versão guardada.
          if (!res.ok) return caches.match('./index.html').then(function (r) { return r || res; });
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

  // Fontes do Google e a biblioteca do mapa: guarda depois da primeira vez.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(cacheFirst(e.request, CACHE));
    return;
  }

  // Metrô (dados abertos do estado de NY).
  if (url.hostname === 'data.ny.gov') {
    e.respondWith(staleWhileRevalidate(e.request, EXTRAS));
  }
});
