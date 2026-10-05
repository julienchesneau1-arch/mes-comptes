// Foyer hors ligne : réseau d'abord (une mise à jour est vue tout de suite), copie locale si pas de connexion.
// Ne touche qu'aux caches « foyer-* » : Mes Comptes, hébergé à côté, garde les siens.
const CACHE = 'foyer-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'fonts/nunito.woff2',
  'manifest.webmanifest',
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'catalogue.json',
  'js/core/agenda.js',
  'js/core/catalog.js',
  'js/core/classics.js',
  'js/core/commands.js',
  'js/core/dates.js',
  'js/core/describe.js',
  'js/core/diag.js',
  'js/core/drive.js',
  'js/core/feries.js',
  'js/core/ical.js',
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
  'js/core/reminders.js',
  'js/core/shopping.js',
  'js/core/status.js',
  'js/core/sync.js',
  'js/core/text.js',
  'js/core/today.js',
  'js/core/units.js',
  'js/core/visual.js',
  'js/core/watch.js',
  'js/core/wikibook.js',
  'js/ui/agenda.js',
  'js/ui/autosync.js',
  'js/ui/catalog.js',
  'js/ui/config.js',
  'js/ui/demo.js',
  'js/ui/dom.js',
  'js/ui/drag.js',
  'js/ui/main.js',
  'js/ui/onboarding.js',
  'js/ui/push.js',
  'js/ui/registry.js',
  'js/ui/sheets/agenda.js',
  'js/ui/sheets/deck.js',
  'js/ui/sheets/discover.js',
  'js/ui/sheets/drive.js',
  'js/ui/sheets/help.js',
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

// Rappels : la notification arrive VIDE ; on relit les rappels chiffrés du foyer, on les déchiffre ici et on les affiche.
// Configuration (adresse du relais, étiquette, clé non exportable) rangée par l'app dans IndexedDB « foyer-push ».
function pushStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const o = indexedDB.open('foyer-push', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onerror = () => reject(o.error);
    o.onsuccess = () => { const tx = o.result.transaction('kv', mode); const r = fn(tx.objectStore('kv')); tx.oncomplete = () => resolve(r && r.result); tx.onerror = () => reject(tx.error); };
  });
}
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function openNote(key, blob) {
  try {
    const raw = unb64u(blob);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: new TextEncoder().encode('foyer-rappel-v1') }, key, raw.slice(12));
    const m = JSON.parse(new TextDecoder().decode(pt));
    return typeof m.title === 'string' && typeof m.body === 'string' ? m : null;
  } catch { return null; }
}
self.foyerOpenNote = openNote; // lu par les tests (même format que relay.ts)
async function showReminders() {
  let shown = 0;
  try {
    const c = await pushStore('readonly', s => s.get('conf'));
    if (c) {
      const since = new Date(Date.now() - 3 * 3600e3).toISOString(), until = new Date(Date.now() + 5 * 60e3).toISOString();
      const r = await fetch(`${c.url}/rest/v1/foyer_rappel?select=rid,at,blob&sent_at=not.is.null&at=gt.${encodeURIComponent(since)}&at=lte.${encodeURIComponent(until)}&order=at.asc`,
        { headers: { apikey: c.apikey, 'x-foyer': c.tag } });
      const rows = r.ok ? await r.json() : [];
      const seen = new Set((await pushStore('readonly', s => s.get('seen'))) || []);
      for (const row of rows) {
        if (seen.has(row.rid)) continue;
        const m = await openNote(c.key, row.blob);
        if (!m) continue;
        await self.registration.showNotification(m.title, { body: m.body, tag: row.rid, data: { url: './#aujourdhui' } });
        seen.add(row.rid); shown++;
      }
      await pushStore('readwrite', s => s.put([...seen].slice(-200), 'seen'));
    }
  } catch { /* hors ligne ou relais indisponible : message générique ci-dessous */ }
  // iOS exige une notification visible à chaque envoi.
  if (!shown) await self.registration.showNotification('Foyer', { body: 'Un rappel pour vos repas : ouvrez Foyer.', tag: 'foyer-rappel', data: { url: './#aujourdhui' } });
}
self.addEventListener('push', e => e.waitUntil(showReminders()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(ws => (ws.length ? ws[0].focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'))));
});
