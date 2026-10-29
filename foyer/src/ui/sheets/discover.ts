// « Recettes prêtes » (comme chez Jow) : le catalogue Wikilivres, filtré et cherché. Une recette se prévoit d'un toucher sur un repas
// libre ou s'ajoute à « Nos plats » ; « Modifier avant d'ajouter » garde la relecture. Rien n'entre sans un geste du foyer.
import { type Filter, FILTERS, search, toParsed, attribution, historyUrl, planCatalog, addCatalog, ownedFor } from '../../core/catalog.ts';
import type { CatalogRecipe } from '../../core/wikibook.ts';
import { type SlotKey, addDays, slotKey, SLOTS, fmtSlot } from '../../core/dates.ts';
import { isUpcoming } from '../../core/propose.ts';
import { servings } from '../../core/plan.ts';
import { dishBlocked } from '../../core/allergens.ts';
import { dishLook } from '../../core/visual.ts';
import { parseIngredient } from '../../core/ingredients.ts';
import { capital } from '../../core/status.ts';
import { S, clock, dispatch } from '../state.ts';
import { openSheet, sheetHead, closeSheet, esc, toast, refreshSheet } from '../dom.ts';
import { CLICK, INPUT } from '../registry.ts';
import { loadCatalog, photoImg, photoHero } from '../catalog.ts';
import { showParsed, allergenHtml } from './recipe.ts';
import { coverNote, lunchNote } from '../cover.ts';
import { withLunch } from '../../core/commands.ts';

const LABEL: Record<Filter, string> = { 'tout': 'Tout', 'rapide': 'Rapide', 'volaille': 'Volaille', 'viande': 'Viande', 'poisson': 'Poisson', 'végétarien': 'Végétarien', 'soupe': 'Soupe', 'pâtes': 'Pâtes' };
let q = '', f: Filter = 'tout', shown = 30;

const meta = (r: CatalogRecipe): string => [r.yield ? `pour ${r.yield}` : 'nombre de personnes à préciser', r.minutes !== null ? `${r.minutes} min` : '', ...r.tags.filter(t => t !== 'rapide')].filter(Boolean).join(' · ');

async function openList(): Promise<void> {
  const cat = await loadCatalog();
  if (!cat) { toast('Catalogue indisponible : il faut avoir ouvert Foyer une fois avec du réseau'); return; }
  openSheet({ id: 'discover', render: () => {
    const all = search(S(), cat, q, f);
    return `${sheetHead('Recettes prêtes', `${cat.count} plats du Livre de cuisine de Wikilivres, licence ${esc(cat.license)}.`)}
    <label class="field">Chercher un plat ou un ingrédient<input type="search" data-i="discoverQ" data-focus="discoverQ" value="${esc(q)}" placeholder="poulet, lentilles, gratin…" autocomplete="off"></label>
    <div class="chips" role="group" aria-label="Filtrer">${FILTERS.map(x => `<button class="tag" data-a="discoverF" data-v="${x}" aria-pressed="${x === f}">${LABEL[x]}</button>`).join('')}</div>
    <p class="small muted">${all.length} plat${all.length > 1 ? 's' : ''}${all.length > shown ? ` · ${shown} affichés` : ''}. Déjà dans vos plats : masqués.</p>
    <ul class="list">${all.slice(0, shown).map(r => `<li><button class="item-btn" data-a="discoverOpen" data-id="${r.id}">${readyTile(r)}<span class="grow"><span class="title">${esc(r.title)}</span><br><span class="sub">${esc(meta(r))}</span></span></button></li>`).join('')}</ul>
    ${all.length > shown ? '<button class="btn ghost block" data-a="discoverMore">Voir plus</button>' : ''}
    <p class="small muted">Recettes écrites par les contributeurs de Wikilivres, reprises sans modification de fond ; Foyer met seulement les ingrédients en forme. <a href="${esc(cat.licenseUrl)}" target="_blank" rel="noopener noreferrer">Licence</a> · <a href="${esc(cat.sourceUrl)}" target="_blank" rel="noopener noreferrer">Livre de cuisine</a>${cat.recipes.some(r => r.photo) ? ' · <button class="btn quiet small-btn" data-a="photoCredits">Crédits des photos</button>' : ''}</p>`;
  } });
}

// Prochains repas libres où quelqu'un mange (7 jours) : là où une recette prête peut être prévue d'un toucher.
export function freeMeals(n = 6): SlotKey[] {
  const s = S(), c = clock(), out: SlotKey[] = [];
  for (let i = 0; i <= 7 && out.length < n; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(c.date, i), sl);
    if (out.length < n && isUpcoming(k, c.date, c.hour) && !s.slots[k]?.dish && servings(s, k) > 0) out.push(k);
  }
  return out;
}
export const readyTile = (r: CatalogRecipe): string => { const l = { ...dishLook(r.title, r.ingredients.map(x => parseIngredient(x).line.name)), ...(r.photo ? { photo: r.photo.src } : {}) }; return `<span class="look t-${l.theme}" aria-hidden="true">${l.emoji}${photoImg(l)}</span>`; };
const chosen = new Map<string, number>(); // nombre de personnes dit par le foyer pour une page qui ne le dit pas

// `from` : le repas d'où la fiche est ouverte (« Choisir un plat »), proposé en premier s'il est encore libre.
async function openOne(id: string, from = ''): Promise<void> {
  const cat = await loadCatalog();
  const r = cat?.recipes.find(x => x.id === id);
  if (!r) return;
  openSheet({ id: `discover:${id}`, render: () => {
    const s = S(), c = clock(), owned = ownedFor(s, r), y = r.yield ?? chosen.get(r.id) ?? null;
    const no = dishBlocked(s.settings.exclude, r.ingredients.map(l => parseIngredient(l).line.name));
    const free = freeMeals(), here = !!from && !s.slots[from]?.dish && servings(s, from) > 0;
    const meals = !y ? [] : here ? [from, ...free.filter(k => k !== from)].slice(0, 6) : free;
    const ask = r.yield ? '' : `<section class="card stack"><h3 class="section-title">Ces quantités sont pour combien de personnes ?</h3>
      <p class="small muted">La page ne le dit pas : sans ce nombre, les courses ne peuvent pas être calculées.</p>
      <div class="chips" role="group" aria-label="Nombre de personnes">${[1, 2, 3, 4, 5, 6, 8].map(n => `<button class="tag" data-a="readyYield" data-id="${r.id}" data-n="${n}" aria-pressed="${y === n}">${n}</button>`).join('')}</div></section>`;
    return `${sheetHead(esc(r.title), esc(meta(r)))}
    ${photoHero(r.photo)}
    ${no ? `<p class="banner partial">⚠️ ${esc(capital(no.why))} (${esc(no.name.toLowerCase())}) : exclu chez vous.</p>` : ''}
    ${ask}
    ${y ? `<section class="card stack"><h3 class="section-title">${owned ? 'Déjà dans vos plats · prévoir' : 'Prévoir'}</h3>
      ${meals.length ? `<div class="chips">${meals.map(k => `<button class="tag" data-a="pickCatalog" data-k="${k}" data-id="${r.id}">${esc(capital(fmtSlot(k, c.date)))}</button>`).join('')}</div>`
        : '<p class="small muted">Aucun repas libre dans les 7 prochains jours : ajoutez-la à vos plats, elle sera proposée ensuite.</p>'}
      ${owned ? '' : `<div class="actions"><button class="btn soft" data-a="catalogAdd" data-id="${r.id}">Ajouter à nos plats</button><button class="btn quiet" data-a="discoverAdd" data-id="${r.id}">Modifier avant d'ajouter</button></div>`}</section>` : ''}
    <section class="card"><h3 class="section-title">Ingrédients${y ? ` pour ${y}` : ''}</h3>${allergenHtml(r.ingredients.map(l => parseIngredient(l).line.name))}<ul class="parsed">${r.ingredients.map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>
    <section class="card"><h3 class="section-title">Étapes</h3><ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>
    <button class="btn ghost block" data-a="discover">Toutes les recettes prêtes</button>
    <p class="small muted">Source : <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">« ${esc(r.title)} » sur Wikilivres</a> · <a href="${esc(historyUrl(r))}" target="_blank" rel="noopener noreferrer">auteurs</a> · licence CC BY-SA 4.0.</p>`;
  } });
}

CLICK['discover'] = () => { void openList(); };
CLICK['discoverF'] = d => { f = (FILTERS as readonly string[]).includes(d['v'] ?? '') ? d['v'] as Filter : 'tout'; shown = 30; void openList(); };
CLICK['discoverMore'] = () => { shown += 30; void openList(); };
INPUT['discoverQ'] = (_d, el) => { q = (el as HTMLInputElement).value; shown = 30; void openList(); };
CLICK['discoverOpen'] = d => { void openOne(d['id'] ?? '', d['k'] ?? ''); };
CLICK['discoverAdd'] = async d => {
  const r = (await loadCatalog())?.recipes.find(x => x.id === d['id']);
  if (r) showParsed({ ...toParsed(r), yield: r.yield ?? chosen.get(r.id) ?? null }, 'Wikilivres', attribution(r), r.tags.filter(t => t === 'rapide' || t === 'végétarien'));
};
CLICK['readyYield'] = d => { chosen.set(d['id'] ?? '', Number(d['n'])); refreshSheet(); };
// Prévoir une recette prête sur un repas (fiche, choix d'un plat, idées d'Aujourd'hui) : un toucher, annulable.
CLICK['pickCatalog'] = async d => {
  const r = (await loadCatalog())?.recipes.find(x => x.id === d['id']), k = d['k'] ?? '';
  if (!r || !k) return;
  const y = r.yield ?? chosen.get(r.id) ?? null;
  if (!y) { void openOne(r.id, k); return; }
  const fresh = !ownedFor(S(), r);
  closeSheet();
  const w = withLunch(S(), k, planCatalog(S(), k, r, r.yield ? null : y));
  dispatch(w.drafts, { toast: () => `${r.title} prévu ${fmtSlot(k, clock().date)}${fresh ? ' · ajouté à vos plats' : ''}${lunchNote(w)}${coverNote(k)}` });
};
CLICK['catalogAdd'] = async d => {
  const r = (await loadCatalog())?.recipes.find(x => x.id === d['id']);
  if (!r) return;
  const { drafts } = addCatalog(S(), r, r.yield ? null : chosen.get(r.id) ?? null);
  if (!drafts.length) { toast('Déjà dans vos plats'); return; }
  dispatch(drafts, { toast: `${r.title} ajouté à vos plats` });
  refreshSheet();
};

// Crédits de toutes les photos du catalogue (licences libres : auteur et licence pour chacune).
CLICK['photoCredits'] = async () => {
  const cat = await loadCatalog();
  if (!cat) return;
  const list = cat.recipes.filter(r => r.photo);
  openSheet({ id: 'photoCredits', render: () => `${sheetHead('Crédits des photos', `${list.length} photos de Wikimedia Commons, sous licence libre, réduites pour l'app.`)}
    <ul class="list">${list.map(r => `<li class="small"><strong>${esc(r.title)}</strong> : ${esc(r.photo?.author ?? '')} · ${esc(r.photo?.license ?? '')} · <a href="${esc(r.photo?.page ?? '')}" target="_blank" rel="noopener noreferrer">source</a></li>`).join('')}</ul>` });
};
