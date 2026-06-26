// Dummy service worker to stop 404 errors in development
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      // Unregisters the SW and tells clients
    });
});
