// Remplace l'ancien service worker d'ALBA sur l'adresse Bolt : il vide les
// caches, se désinstalle et renvoie les pages ouvertes vers nikito.tech.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var cles = await caches.keys();
    await Promise.all(cles.map(function (c) { return caches.delete(c); }));
    await self.registration.unregister();
    var fenetres = await self.clients.matchAll({ type: 'window' });
    fenetres.forEach(function (f) { f.navigate('https://nikito.tech'); });
  })());
});
