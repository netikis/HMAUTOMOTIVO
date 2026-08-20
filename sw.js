/* HM Centro Automotivo — PWA com atualização automática (PC + celular) */
var CACHE = 'hm-auto-v9';
var ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/config.js',
  './js/storage.js',
  './js/ui.js',
  './js/nuvem.js',
  './js/auth.js',
  './js/clientes.js',
  './js/os.js',
  './js/produtos.js',
  './js/orcamento.js',
  './js/interno.js',
  './js/caixa.js',
  './js/app.js',
  './manifest.webmanifest?v=9',
  './logo-hm.png?v=9',
  './icon-192.png?v=9',
  './icon-512.png?v=9',
  './apple-touch-icon.png?v=9',
  './assinar-hm.html',
  './firebase-config.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isDocumento(request, url) {
  if (request.mode === 'navigate') return true;
  var path = url.pathname || '';
  return path.endsWith('/') ||
    path.endsWith('.html') ||
    path.endsWith('sw.js') ||
    path.endsWith('manifest.webmanifest') ||
    path.indexOf('/js/') >= 0 ||
    path.indexOf('/css/') >= 0;
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  /* HTML / CSS / JS / navegação: rede primeiro → celular e PC pegam a versão nova */
  if (isDocumento(event.request, url)) {
    event.respondWith(
      fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* Ícones/imagens: cache + atualiza em segundo plano */
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () {
        return cached;
      });
      return cached || network;
    })
  );
});
