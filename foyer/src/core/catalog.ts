// Plats « à découvrir » : catalogue tiré de Wikilivres (CC BY-SA 4.0), comme l'inspiration de Jow mais sans recette inventée.
// Vos plats passent d'abord ; une découverte par semaine au plus (davantage tant que vous avez peu de plats).
// Rien n'entre dans « Nos plats » sans votre accord, et chaque recette garde sa source et sa licence.
import type { LocalDate } from './dates.ts';
import { type State, type RecipeContent, current } from './model.ts';
import { type IngredientLine, parseIngredient, aisleOf } from './ingredients.ts';
import type { ParsedRecipe } from './recipe-text.ts';
import { type CatalogRecipe, familyOf } from './wikibook.ts';
import { nameKey, norm } from './text.ts';

export interface Catalog {
  source: string; sourceUrl: string; license: string; licenseUrl: string; note: string; generated: string; count: number;
  recipes: CatalogRecipe[];
}
const isStrArr = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 500);
// Fichier relu avant usage : une recette mal formée est ignorée, pas affichée.
export function readCatalog(x: unknown): Catalog | null {
  if (typeof x !== 'object' || x === null) return null;
  const c = x as Record<string, unknown>;
  if (typeof c['license'] !== 'string' || !Array.isArray(c['recipes'])) return null;
  const recipes = (c['recipes'] as unknown[]).filter((r): r is CatalogRecipe => {
    if (typeof r !== 'object' || r === null) return false;
    const o = r as Record<string, unknown>;
    return typeof o['id'] === 'string' && /^wb\d{1,9}$/.test(o['id']) && typeof o['title'] === 'string' && o['title'].length <= 80
      && (o['yield'] === null || (Number.isInteger(o['yield']) && (o['yield'] as number) >= 1 && (o['yield'] as number) <= 20)) && (o['minutes'] === null || Number.isInteger(o['minutes']))
      && isStrArr(o['ingredients'], 40) && isStrArr(o['steps'], 20) && isStrArr(o['tags'], 10)
      && typeof o['url'] === 'string' && o['url'].startsWith('https://fr.wikibooks.org/wiki/');
  });
  return { source: String(c['source'] ?? ''), sourceUrl: String(c['sourceUrl'] ?? ''), license: c['license'], licenseUrl: String(c['licenseUrl'] ?? ''),
    note: String(c['note'] ?? ''), generated: String(c['generated'] ?? ''), count: recipes.length, recipes };
}

export const historyUrl = (r: CatalogRecipe): string => `${r.url}?action=history`;
export const attribution = (r: CatalogRecipe): string => `D'après « ${r.title} », Wikilivres, licence CC BY-SA 4.0 : ${r.url} (auteurs : historique de la page).`;

// Recette du catalogue → même relecture qu'une recette collée ou importée.
export function toParsed(r: CatalogRecipe): ParsedRecipe {
  return { name: r.title, yield: r.yield, ingredients: r.ingredients.map(parseIngredient), steps: r.steps };
}
export function toContent(r: CatalogRecipe): RecipeContent {
  return { name: r.title, yield: r.yield, ingredients: r.ingredients.map(l => parseIngredient(l).line), steps: r.steps, ahead: [],
    tags: r.tags.filter(t => t === 'rapide' || t === 'végétarien'), note: attribution(r).slice(0, 1000) };
}

const ownedNames = (s: State): Set<string> => new Set(Object.values(s.recipes).map(r => nameKey(current(r).name)));

export type Filter = 'tout' | 'rapide' | 'volaille' | 'viande' | 'poisson' | 'végétarien' | 'soupe' | 'pâtes';
export const FILTERS: readonly Filter[] = ['tout', 'rapide', 'volaille', 'viande', 'poisson', 'végétarien', 'soupe', 'pâtes'];
// Recherche dans le titre et les ingrédients ; les plats déjà dans « Nos plats » sont écartés.
export function search(s: State, cat: Catalog, text: string, f: Filter): CatalogRecipe[] {
  const words = norm(text).split(/\s+/).filter(w => w.length >= 2);
  const owned = ownedNames(s);
  return cat.recipes.filter(r => !owned.has(nameKey(r.title))
    && (f === 'tout' || r.tags.includes(f) || r.main === f)
    && words.every(w => norm(r.title).includes(w) || r.ingredients.some(l => norm(l).includes(w))));
}

// Lignes lues une fois par recette (le classement est refait pour chaque créneau de la semaine).
const LINES = new Map<string, IngredientLine[]>();
function linesOf(r: CatalogRecipe): IngredientLine[] {
  const k = `${r.id}:${r.rev}`;
  let v = LINES.get(k);
  if (!v) { v = r.ingredients.map(l => parseIngredient(l).line); LINES.set(k, v); }
  return v;
}

// Petit brassage déterministe : d'une semaine à l'autre, les découvertes changent ; deux téléphones voient les mêmes.
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export interface Discovery { recipe: CatalogRecipe; score: number; reason: string }
export interface DiscoverContext { week: LocalDate; weekend: boolean; evening: boolean; neighbourFamilies: ReadonlySet<string>; weekFresh: ReadonlyMap<string, string>; exclude: ReadonlySet<string> }
export function discover(s: State, cat: Catalog, ctx: DiscoverContext): Discovery[] {
  const owned = ownedNames(s);
  const out: Discovery[] = [];
  for (const r of cat.recipes) {
    if (r.yield === null || ctx.exclude.has(r.id) || owned.has(nameKey(r.title))) continue; // sans nombre de personnes, pas de courses justes : jamais proposé d'office
    let score = 20;
    const why: string[] = ['nouveau'];
    if (r.tags.includes('classique')) { score += 8; why.push('classique'); }
    score -= Math.max(0, r.ingredients.length - 10); // plus simple à acheter et à faire
    if (ctx.evening && !ctx.weekend) {
      if (r.tags.includes('rapide')) { score += 10; why.push(`rapide (${r.minutes} min)`); }
      else if (r.minutes !== null && r.minutes > 60) score -= 15;
    }
    if (ctx.weekend && r.minutes !== null && r.minutes > 45) { score += 5; why.push('plat du week-end'); }
    if (r.main && ctx.neighbourFamilies.has(r.main)) score -= 15;
    const lines = linesOf(r);
    const shared = [...new Set(lines.filter(l => ['fruits-legumes', 'cremerie', 'frais'].includes(aisleOf(l.name, l.form, s.aisles)))
      .map(l => nameKey(l.name)).filter(k => ctx.weekFresh.has(k)))].map(k => ctx.weekFresh.get(k) as string);
    if (shared.length) { score += Math.min(12, 4 * shared.length); why.push(`réutilise ${shared.slice(0, 2).join(', ')}`); }
    out.push({ recipe: r, score, reason: `${why.join(' · ')} · Wikilivres` });
  }
  return out.sort((a, b) => b.score - a.score || hash(ctx.week + a.recipe.id) - hash(ctx.week + b.recipe.id));
}

// Familles des plats déjà prévus autour d'un jour (vos plats), pour ne pas proposer deux volailles de suite.
export function familiesOf(s: State, recipes: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of recipes) {
    const r = s.recipes[id];
    if (!r) continue;
    const f = current(r).ingredients.map(l => familyOf(l.name)).find(Boolean);
    if (f) out.add(f);
  }
  return out;
}
