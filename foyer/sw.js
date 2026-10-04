// Foyer hors ligne : réseau d'abord (une mise à jour est vue tout de suite), copie locale si pas de connexion.
// Ne touche qu'aux caches « foyer-* » : Mes Comptes, hébergé à côté, garde les siens.
const CACHE = 'foyer-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'js/core/commands.js',
  'js/core/dates.js',
  'js/core/describe.js',
  'js/core/diag.js',
  'js/core/drive.js',
  'js/core/ics.js',
  'js/core/ingredients.js',
  'js/core/model.js',
  'js/core/plan.js',
  'js/core/preview.js',
  'js/core/propose.js',
  'js/core/rational.js',
  'js/core/recipe-text.js',
  'js/core/recipe-web.js',
  'js/core/reduce.js',
  'js/core/relay.js',
  'js/core/shopping.js',
  'js/core/status.js',
  'js/core/sync.js',
  'js/core/text.js',
  'js/core/today.js',
  'js/core/units.js',
  'js/core/watch.js',
  'js/ui/autosync.js',
  'js/ui/config.js',
  'js/ui/demo.js',
  'js/ui/dom.js',
  'js/ui/drag.js',
  'js/ui/main.js',
  'js/ui/onboarding.js',
  'js/ui/registry.js',
  'js/ui/sheets/drive.js',
  'js/ui/sheets/plan.js',
  'js/ui/sheets/preview.js',
  'js/ui/sheets/recipe.js',
  'js/ui/sheets/settings.js',
  'js/ui/sheets/shop.js',
  'js/ui/sheets/slot.js',
  'js/ui/state.js',
  'js/ui/store.js',
  'js/ui/views.js',
];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('foyer-') && k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.registration.scope)) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' })
    .then(r => { if (!r.ok) return caches.match(e.request, { ignoreSearch: true }).then(c => c || r); const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(c => c || caches.match('index.html'))));
});
