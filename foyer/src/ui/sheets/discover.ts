// « Découvrir des recettes » : le catalogue Wikilivres, filtré et cherché ; une recette n'entre dans « Nos plats » qu'après relecture.
import { type Filter, FILTERS, search, toParsed, attribution, historyUrl } from '../../core/catalog.ts';
import type { CatalogRecipe } from '../../core/wikibook.ts';
import { S } from '../state.ts';
import { openSheet, sheetHead, esc, toast } from '../dom.ts';
import { CLICK, INPUT } from '../registry.ts';
import { loadCatalog } from '../catalog.ts';
import { showParsed } from './recipe.ts';

const LABEL: Record<Filter, string> = { 'tout': 'Tout', 'rapide': 'Rapide', 'volaille': 'Volaille', 'viande': 'Viande', 'poisson': 'Poisson', 'végétarien': 'Végétarien', 'soupe': 'Soupe', 'pâtes': 'Pâtes' };
let q = '', f: Filter = 'tout', shown = 30;

const meta = (r: CatalogRecipe): string => [r.yield ? `pour ${r.yield}` : 'nombre de personnes à préciser', r.minutes !== null ? `${r.minutes} min` : '', ...r.tags.filter(t => t !== 'rapide')].filter(Boolean).join(' · ');

async function openList(): Promise<void> {
  const cat = await loadCatalog();
  if (!cat) { toast('Catalogue indisponible : il faut avoir ouvert Foyer une fois avec du réseau'); return; }
  openSheet({ id: 'discover', render: () => {
    const all = search(S(), cat, q, f);
    return `${sheetHead('Découvrir des recettes', `${cat.count} plats du Livre de cuisine de Wikilivres, licence ${esc(cat.license)}.`)}
    <label class="field">Chercher un plat ou un ingrédient<input type="search" data-i="discoverQ" data-focus="discoverQ" value="${esc(q)}" placeholder="poulet, lentilles, gratin…" autocomplete="off"></label>
    <div class="chips" role="group" aria-label="Filtrer">${FILTERS.map(x => `<button class="tag" data-a="discoverF" data-v="${x}" aria-pressed="${x === f}">${LABEL[x]}</button>`).join('')}</div>
    <p class="small muted">${all.length} plat${all.length > 1 ? 's' : ''}${all.length > shown ? ` · ${shown} affichés` : ''}. Déjà dans vos plats : masqués.</p>
    <ul class="list">${all.slice(0, shown).map(r => `<li><button class="item-btn" data-a="discoverOpen" data-id="${r.id}"><span class="grow"><span class="title">${esc(r.title)}</span><br><span class="sub">${esc(meta(r))}</span></span></button></li>`).join('')}</ul>
    ${all.length > shown ? '<button class="btn ghost block" data-a="discoverMore">Voir plus</button>' : ''}
    <p class="small muted">Recettes écrites par les contributeurs de Wikilivres, reprises sans modification de fond ; Foyer met seulement les ingrédients en forme. <a href="${esc(cat.licenseUrl)}" target="_blank" rel="noopener noreferrer">Licence</a> · <a href="${esc(cat.sourceUrl)}" target="_blank" rel="noopener noreferrer">Livre de cuisine</a></p>`;
  } });
}

async function openOne(id: string): Promise<void> {
  const cat = await loadCatalog();
  const r = cat?.recipes.find(x => x.id === id);
  if (!r) return;
  openSheet({ id: `discover:${id}`, render: () => `${sheetHead(esc(r.title), esc(meta(r)))}
    <section class="card stack"><h3 class="section-title">Ingrédients${r.yield ? ` pour ${r.yield}` : ''}</h3><ul class="parsed">${r.ingredients.map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>
    <details class="card"><summary>Étapes (${r.steps.length})</summary><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>
    <button class="btn block" data-a="discoverAdd" data-id="${r.id}">Ajouter à nos plats (relecture d'abord)</button>
    <button class="btn ghost block" data-a="discover">Retour à la liste</button>
    <p class="small muted">Source : <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">« ${esc(r.title)} » sur Wikilivres</a> · <a href="${esc(historyUrl(r))}" target="_blank" rel="noopener noreferrer">auteurs</a> · licence CC BY-SA 4.0.</p>` });
}

CLICK['discover'] = () => { void openList(); };
CLICK['discoverF'] = d => { f = (FILTERS as readonly string[]).includes(d['v'] ?? '') ? d['v'] as Filter : 'tout'; shown = 30; void openList(); };
CLICK['discoverMore'] = () => { shown += 30; void openList(); };
INPUT['discoverQ'] = (_d, el) => { q = (el as HTMLInputElement).value; shown = 30; void openList(); };
CLICK['discoverOpen'] = d => { void openOne(d['id'] ?? ''); };
CLICK['discoverAdd'] = async d => {
  const r = (await loadCatalog())?.recipes.find(x => x.id === d['id']);
  if (r) showParsed(toParsed(r), 'Wikilivres', attribution(r), r.tags.filter(t => t === 'rapide' || t === 'végétarien'));
};
