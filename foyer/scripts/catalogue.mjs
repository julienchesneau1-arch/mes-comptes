// Régénère catalogue.json depuis le « Livre de cuisine » de Wikilivres (licence CC BY-SA 4.0), par l'API officielle MediaWiki.
// Lancer depuis foyer/ avec un accès réseau : node scripts/catalogue.mjs (la CI le fait : .github/workflows/catalogue.yml).
// Une recette n'entre que si parseWikiRecipe la juge exploitable ; les raisons d'écart sont comptées et affichées.
import { writeFileSync } from 'node:fs';
import { parseWikiRecipe } from '../src/core/wikibook.ts';

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
writeFileSync(new URL('../catalogue.json', import.meta.url), `${JSON.stringify({
  source: 'Wikilivres, « Livre de cuisine »', sourceUrl: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine',
  license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
  note: 'Recettes adaptées par Foyer (mise en forme des ingrédients et des étapes). Auteurs : historique de chaque page source.',
  generated: new Date().toISOString().slice(0, 10), count: recipes.length, recipes,
})}\n`);
console.log(`pages lues : ${pages.size} · recettes retenues : ${recipes.length}`);
for (const [w, c] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  écartées (${w}) : ${c}`);
const fam = {}; for (const r of recipes) fam[r.main ?? (r.tags.includes('végétarien') ? 'végétarien' : 'autre')] = (fam[r.main ?? (r.tags.includes('végétarien') ? 'végétarien' : 'autre')] ?? 0) + 1;
console.log('  familles :', JSON.stringify(fam), '· rapides :', recipes.filter(r => r.tags.includes('rapide')).length);
