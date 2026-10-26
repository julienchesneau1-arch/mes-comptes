// Régénère catalogue.json depuis le « Livre de cuisine » de Wikilivres (licence CC BY-SA 4.0), par l'API officielle MediaWiki.
// Lancer depuis foyer/ avec un accès réseau : node scripts/catalogue.mjs (la CI le fait : .github/workflows/catalogue.yml).
// Une recette n'entre que si parseWikiRecipe la juge exploitable ; les raisons d'écart sont comptées et affichées.
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { parseWikiRecipe } from '../src/core/wikibook.ts';
import { photoFrom } from '../src/core/photos.ts';

const API = 'https://fr.wikibooks.org/w/api.php';
const UA = 'FoyerCatalogue/1.0 (https://github.com/julienchesneau1-arch/mes-comptes)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (r.ok) {
      const j = await r.json();
      if (!j.error) return j;
      if (j.error.code !== 'maxlag') throw new Error(`API : ${j.error.info}`);
    }
    await sleep(3000 * attempt); // serveur chargé : on attend, poliment
  }
  throw new Error('API Wikilivres indisponible');
}

// 1. Toutes les pages de la catégorie du livre.
const titles = [];
for (let cont = {}; cont;) {
  const j = await call({ action: 'query', list: 'categorymembers', cmtitle: 'Catégorie:Livre de cuisine (livre)', cmnamespace: '0', cmlimit: '500', ...cont });
  titles.push(...j.query.categorymembers.map(m => m.title));
  cont = j.continue ?? null;
}

// 2. Contenu et catégories, par paquets de 50 (suite de réponse fusionnée page par page).
const pages = new Map();
for (let i = 0; i < titles.length; i += 50) {
  for (let cont = {}; cont;) {
    const j = await call({ action: 'query', prop: 'revisions|categories', rvprop: 'content|ids', rvslots: 'main', cllimit: 'max', titles: titles.slice(i, i + 50).join('|'), ...cont });
    for (const p of j.query?.pages ?? []) {
      const cur = pages.get(p.pageid) ?? { pageid: p.pageid, title: p.title, revid: 0, content: '', categories: [] };
      const rev = p.revisions?.[0];
      if (rev) { cur.revid = rev.revid; cur.content = rev.slots?.main?.content ?? ''; }
      for (const c of p.categories ?? []) cur.categories.push(c.title);
      pages.set(p.pageid, cur);
    }
    cont = j.continue ?? null;
  }
  await sleep(300);
}

// 3. Lecture, tri, écriture.
const recipes = [], why = new Map();
for (const p of pages.values()) {
  const r = parseWikiRecipe(p);
  if (r.ok) recipes.push(r.recipe); else why.set(r.why, (why.get(r.why) ?? 0) + 1);
}
recipes.sort((a, b) => a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id));

// 4. Photos : image principale libre de chaque page retenue (Wikimedia Commons), vignette de 500 px enregistrée dans img/plats
// et servie par Foyer. Licence non libre, dessin, petite image ou auteur inconnu : pas de photo (jamais une image inventée).
const DIR = new URL('../img/plats/', import.meta.url);
mkdirSync(DIR, { recursive: true });
const lead = new Map(); // wb<pageid> → nom du fichier
const fileName = f => { const t = f.replace(/_/g, ' ').replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
for (let i = 0; i < recipes.length; i += 50) {
  const ids = recipes.slice(i, i + 50).map(r => r.id.slice(2));
  const j = await call({ action: 'query', prop: 'pageimages', piprop: 'name', pilicense: 'free', pageids: ids.join('|') });
  for (const p of j.query?.pages ?? []) if (p.pageimage) lead.set(`wb${p.pageid}`, fileName(p.pageimage));
  await sleep(300);
}
// Sans image principale désignée : la première photo de la page (lien [[Fichier:…]] ou galerie) ; sa licence est vérifiée ensuite.
const FIRST_IMG = /(?:\[\[|^|\n)\s*(?:Fichier|Image|File)\s*:\s*([^|\]\n{}]+?\.(?:jpe?g|png|webp))\s*(?:[|\]\n]|$)/i;
let fromText = 0;
for (const r of recipes) {
  if (lead.has(r.id)) continue;
  const m = FIRST_IMG.exec(pages.get(Number(r.id.slice(2)))?.content ?? '');
  if (m) { lead.set(r.id, fileName(m[1])); fromText++; }
}
const infos = new Map(); // nom du fichier → réponse imageinfo (titre normalisé et redirection suivis, comme l'API les renvoie)
const files = [...new Set(lead.values())];
for (let i = 0; i < files.length; i += 50) {
  const batch = files.slice(i, i + 50);
  const j = await call({ action: 'query', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '500', iiextmetadatafilter: 'Artist|Credit|LicenseShortName',
    redirects: '1', titles: batch.map(f => `File:${f}`).join('|') });
  const norm = new Map((j.query?.normalized ?? []).map(n => [n.from, n.to])), redir = new Map((j.query?.redirects ?? []).map(n => [n.from, n.to]));
  const byTitle = new Map((j.query?.pages ?? []).map(p => [p.title, p]));
  for (const f of batch) { const t = norm.get(`File:${f}`) ?? `File:${f}`; infos.set(f, byTitle.get(redir.get(t) ?? t)); }
  await sleep(300);
}
const kept = new Set(), dropped = new Map(), samples = [];
const drop = (why, file) => {
  dropped.set(why, (dropped.get(why) ?? 0) + 1);
  // Diagnostic : ce que l'API a renvoyé pour les premiers écarts (format, taille, licence, auteur), pour régler le filtre sans deviner.
  const i = infos.get(file)?.imageinfo?.[0], m = i?.extmetadata ?? {};
  if (samples.length < 12) samples.push(`  ${why} ← ${file} · ${i ? `${i.mime} ${i.width}×${i.height} · vignette ${String(i.thumburl ?? '').slice(0, 40)} · licence « ${m.LicenseShortName?.value ?? ''} » · auteur « ${String(m.Artist?.value ?? m.Credit?.value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 40)} » · ${String(i.descriptionurl ?? '').slice(0, 60)}` : `réponse : ${JSON.stringify(infos.get(file) ?? null).slice(0, 160)}`}`);
};
for (const r of recipes) {
  const file = lead.get(r.id);
  if (!file) continue;
  const got = photoFrom(r.id, infos.get(file));
  if (!got.ok) { drop(got.why, file); continue; }
  const res = await fetch(got.thumb, { headers: { 'User-Agent': UA } });
  const type = res.headers.get('content-type') ?? '', body = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  if (!body || !type.startsWith('image/') || body.length > 400_000) { drop(`téléchargement ${res.status} ${type}`, file); continue; }
  writeFileSync(new URL(got.photo.src.replace(/^img\/plats\//, ''), DIR), body);
  r.photo = got.photo; kept.add(got.photo.src.replace(/^img\/plats\//, ''));
  await sleep(150);
}
for (const f of readdirSync(DIR)) if (!kept.has(f)) unlinkSync(new URL(f, DIR)); // photos d'anciennes recettes : retirées
console.log(`photos : ${kept.size} sur ${recipes.length} recettes (image trouvée : ${lead.size}, dont ${fromText} prise dans le texte ; fiches lues : ${[...infos.values()].filter(Boolean).length}) · écartées : ${JSON.stringify(Object.fromEntries(dropped))}`);
for (const l of samples) console.log(l);
writeFileSync(new URL('../catalogue.json', import.meta.url), `${JSON.stringify({
  source: 'Wikilivres, « Livre de cuisine »', sourceUrl: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine',
  license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
  note: 'Recettes adaptées par Foyer (mise en forme des ingrédients et des étapes). Auteurs : historique de chaque page source.',
  generated: new Date().toISOString().slice(0, 10), count: recipes.length, recipes,
})}\n`);
console.log(`pages lues : ${pages.size} · recettes retenues : ${recipes.length} · avec nombre de personnes : ${recipes.filter(r => r.yield).length} · avec durée : ${recipes.filter(r => r.minutes !== null).length}`);
// Diagnostic : comment les pages retenues sans nombre de personnes l'écrivent (s'il y est) — pour améliorer la lecture, jamais deviner.
const noYield = recipes.filter(r => !r.yield).slice(0, 400), byId = new Map([...pages.values()].map(p => [`wb${p.pageid}`, p]));
const hints = [];
for (const r of noYield) {
  const raw = byId.get(r.id)?.content ?? '';
  const line = raw.split('\n').find(l => /personne|portion|convive|couvert|\bparts?\b|\bpers\b|quantit/i.test(l));
  if (line) hints.push(`  ${r.title} ← ${line.trim().slice(0, 140)}`);
  else if (/\{\{\s*recette/i.test(raw)) hints.push(`  ${r.title} ← modèle : ${(/\{\{\s*recette[^}]{0,140}/i.exec(raw)?.[0] ?? '').replace(/\n/g, ' ')}`);
}
console.log(`  sans nombre de personnes : ${noYield.length} ; indices trouvés : ${hints.length}`);
for (const h of hints.slice(0, 40)) console.log(h);
// Diagnostic : comment s'écrit la liste des ingrédients des pages écartées pour « pas de section ingrédients ».
const noIng = [...pages.values()].filter(p => { const r = parseWikiRecipe(p); return !r.ok && r.why === 'pas de section ingrédients'; });
console.log(`  pas de section ingrédients : ${noIng.length}`);
for (const p of noIng.slice(0, 30)) {
  const l = p.content.split('\n').find(x => /ingr[ée]dient/i.test(x)) ?? p.content.split('\n').find(x => /^\*/.test(x)) ?? '';
  console.log(`  ${p.title.replace(/^Livre de cuisine\//, '')} ← ${l.trim().slice(0, 120) || '(aucune ligne)'}`);
}
for (const [w, c] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  écartées (${w}) : ${c}`);
const fam = {}; for (const r of recipes) fam[r.main ?? (r.tags.includes('végétarien') ? 'végétarien' : 'autre')] = (fam[r.main ?? (r.tags.includes('végétarien') ? 'végétarien' : 'autre')] ?? 0) + 1;
console.log('  familles :', JSON.stringify(fam), '· rapides :', recipes.filter(r => r.tags.includes('rapide')).length);
