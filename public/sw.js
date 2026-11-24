// Service worker mínimo: permite instalar la app (Chrome exige un manejador de fetch).
// A propósito NO guarda caché de páginas: así nunca se mezclan versiones viejas y nuevas
// en la cocina o la caja. Los datos siempre vienen en vivo de Supabase.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.map((c) => caches.delete(c)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', () => {});

// Notificaciones (pedido listo, llamada de mesa) mostradas por la propia app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/panel';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
