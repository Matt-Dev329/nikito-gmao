/* Notifications push ALBA — importé par le service worker (vite-plugin-pwa, workbox.importScripts). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { titre: 'ALBA', corps: event.data ? event.data.text() : '' };
  }
  const titre = data.titre || 'ALBA by Nikito';
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: data.corps || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      tag: data.url || undefined,
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.startsWith(self.location.origin) && 'focus' in f) {
          f.navigate(url);
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
