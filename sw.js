// Service worker: guarda los archivos de la app para que abra sin internet.
// Si cambias algún archivo de la app, sube el número de VERSION para que los móviles se actualicen.
const VERSION = 'volumen-v5';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'vendor/chart.umd.js', 'vendor/supabase.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Primero la copia guardada; si no está, internet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // lo de Supabase va siempre a internet
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
