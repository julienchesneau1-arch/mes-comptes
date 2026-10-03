// Hors-ligne : réseau d'abord, sans cache HTTP intermédiaire (une mise à jour est vue tout de suite), cache si pas de connexion.
// Android : reçoit aussi les fichiers « partagés » vers l'app (relevés depuis l'app de la banque, journal…).
const C = 'mescomptes-v33', SHARE = 'mescomptes-partage', ETAT = 'mescomptes-etat';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'core.js', 'manifest.json', 'icon.svg', 'icon.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'vendor/pdfjs/polyfill-safari.mjs', 'vendor/pdfjs/worker-safari.mjs']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== SHARE && k !== ETAT).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.searchParams.has('partage')) {
    // Fichiers partagés : rangés le temps que la page les importe, puis effacés par elle.
    e.respondWith((async () => {
      const fd = await e.request.formData(), c = await caches.open(SHARE);
      let i = 0;
      for (const f of fd.getAll('fichiers')) if (f && f.size) await c.put(`partage/${Date.now()}-${i++}`, new Response(f, { headers: { 'X-Nom': encodeURIComponent(f.name || 'Document'), 'Content-Type': f.type || 'application/octet-stream' } }));
      return Response.redirect('./?partage=recu', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Réseau d'abord ; une page d'erreur du site (404 pendant une mise à jour) ne remplace jamais la copie qui marche.
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' })
    .then(r => { if (!r.ok) return caches.match(e.request).then(c => c || r); const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});

// Android (app installée) : notifications qui connaissent vos chiffres, calculées sur le téléphone à partir d'un petit résumé.
// Le soir si la journée n'est pas notée, le dimanche pour la semaine, dès le 5 pour les relevés du mois. Une fois par jour et par sujet.
const localDay = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
async function ritual() {
  const c = await caches.open(ETAT), r = await c.match('etat.json');
  if (!r) return;
  const e = await r.json(), now = new Date(), d = localDay(now), seen = await (await c.match('vu.json'))?.json().catch(() => ({})) || {};
  const monday = localDay(new Date(now - ((now.getDay() + 6) % 7) * 864e5));
  let n = null;
  if (now.getDate() >= 5 && e.month !== d.slice(0, 7) && seen.month !== d.slice(0, 7)) n = { k: 'month', title: '📥 Le rendez-vous du mois', body: `Les relevés de ${e.prev} sont disponibles : importez-les, puis le bilan. 5 minutes.` };
  else if (now.getDay() === 0 && now.getHours() >= 17 && e.week !== monday && seen.week !== d) n = { k: 'week', title: '📊 Notre semaine', body: `Un coup d'œil d'une minute${e.todo ? ` · ${e.todo} chose${e.todo > 1 ? 's' : ''} à voir` : ''}.` };
  else if (now.getHours() >= 19 && e.lastCheck !== d && seen.day !== d) n = { k: 'day', title: '💸 Ma journée en 10 secondes', body: e.streak ? `🔥 ${e.streak} jour${e.streak > 1 ? 's' : ''} d'affilée : notez aujourd'hui pour garder la série.` : 'Un favori, une dépense, ou « rien dépensé ».' };
  if (!n) return;
  await self.registration.showNotification(n.title, { body: n.body, icon: 'icon.png', badge: 'icon.png', tag: n.k });
  seen[n.k] = n.k === 'month' ? d.slice(0, 7) : d;
  await c.put('vu.json', new Response(JSON.stringify(seen)));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'rituel') e.waitUntil(ritual()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => ws.length ? ws[0].focus() : clients.openWindow('./')));
});
