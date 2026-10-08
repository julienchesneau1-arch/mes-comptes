import { current } from './model.js';
import { parseIngredient, aisleOf } from './ingredients.js';
import { familyOf } from './wikibook.js';
import { nameKey, norm } from './text.js';
import { dishType } from './visual.js';
const isStrArr = (v, max) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 500);
// Fichier relu avant usage : une recette mal formée est ignorée, pas affichée.
export function readCatalog(x) {
    if (typeof x !== 'object' || x === null)
        return null;
    const c = x;
    if (typeof c['license'] !== 'string' || !Array.isArray(c['recipes']))
        return null;
    const recipes = c['recipes'].filter((r) => {
        if (typeof r !== 'object' || r === null)
            return false;
        const o = r;
        return typeof o['id'] === 'string' && /^wb\d{1,9}$/.test(o['id']) && typeof o['title'] === 'string' && o['title'].length <= 80
            && (o['yield'] === null || (Number.isInteger(o['yield']) && o['yield'] >= 1 && o['yield'] <= 20)) && (o['minutes'] === null || Number.isInteger(o['minutes']))
            && isStrArr(o['ingredients'], 40) && isStrArr(o['steps'], 20) && isStrArr(o['tags'], 10)
            && typeof o['url'] === 'string' && o['url'].startsWith('https://fr.wikibooks.org/wiki/');
    });
    return { source: String(c['source'] ?? ''), sourceUrl: String(c['sourceUrl'] ?? ''), license: c['license'], licenseUrl: String(c['licenseUrl'] ?? ''),
        note: String(c['note'] ?? ''), generated: String(c['generated'] ?? ''), count: recipes.length, recipes };
}
export const historyUrl = (r) => `${r.url}?action=history`;
export const attribution = (r) => `D'après « ${r.title} », Wikilivres, licence CC BY-SA 4.0 : ${r.url} (auteurs : historique de la page).`;
// Recette du catalogue → même relecture qu'une recette collée ou importée.
export function toParsed(r) {
    return { name: r.title, yield: r.yield, ingredients: r.ingredients.map(parseIngredient), steps: r.steps };
}
// yieldN : nombre de personnes choisi par le foyer quand la page ne le dit pas (jamais deviné).
export function toContent(r, yieldN = null) {
    return { name: r.title, yield: r.yield ?? yieldN, ingredients: r.ingredients.map(l => parseIngredient(l).line), steps: r.steps, ahead: [],
        tags: r.tags.filter(t => t === 'rapide' || t === 'végétarien'), note: attribution(r).slice(0, 1000) };
}
const ownedNames = (s) => new Set(Object.values(s.recipes).map(r => nameKey(current(r).name)));
export const FILTERS = ['tout', 'rapide', 'volaille', 'viande', 'poisson', 'végétarien', 'soupe', 'pâtes'];
// Recherche dans le titre et les ingrédients ; les plats déjà dans « Nos plats » sont écartés.
export function search(s, cat, text, f) {
    const words = norm(text).split(/\s+/).filter(w => w.length >= 2);
    const owned = ownedNames(s);
    return cat.recipes.filter(r => !owned.has(nameKey(r.title))
        && (f === 'tout' || r.tags.includes(f) || r.main === f)
        && words.every(w => norm(r.title).includes(w) || r.ingredients.some(l => norm(l).includes(w))));
}
// Lignes lues une fois par recette (le classement est refait pour chaque créneau de la semaine).
const LINES = new Map();
function linesOf(r) {
    const k = `${r.id}:${r.rev}`;
    let v = LINES.get(k);
    if (!v) {
        v = r.ingredients.map(l => parseIngredient(l).line);
        LINES.set(k, v);
    }
    return v;
}
// Petit brassage déterministe : d'une semaine à l'autre, les découvertes changent ; deux téléphones voient les mêmes.
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function discover(s, cat, ctx) {
    const owned = ownedNames(s);
    const out = [];
    for (const r of cat.recipes) {
        // Sans nombre de personnes, pas de courses justes : proposé seulement si le foyer accepte de le préciser à la validation.
        if ((r.yield === null && !ctx.noYield) || ctx.exclude.has(r.id) || owned.has(nameKey(r.title)))
            continue;
        let score = 20;
        const why = ['nouveau'];
        if (r.yield === null)
            score -= 6;
        if (ctx.seen?.has(r.id))
            score -= 40; // déjà vue sans être retenue : d'autres d'abord
        const type = dishType(r.title, r.ingredients), same = type ? ctx.types?.get(type) ?? 0 : 0;
        if (same)
            score -= 14 * same; // pas deux plats du même genre dans la semaine
        const b = ctx.bonus?.(r);
        if (b) {
            score += b.score;
            why.push(b.why);
        }
        if (r.tags.includes('classique')) {
            score += 8;
            why.push('classique');
        }
        score -= Math.max(0, r.ingredients.length - 10); // plus simple à acheter et à faire
        if (ctx.evening && !ctx.weekend) {
            if (r.tags.includes('rapide')) {
                score += 10;
                why.push(`rapide (${r.minutes} min)`);
            }
            else if (r.minutes !== null && r.minutes > 60)
                score -= 15;
        }
        if (ctx.weekend && r.minutes !== null && r.minutes > 45) {
            score += 5;
            why.push('plat du week-end');
        }
        if (r.main && ctx.neighbourFamilies.has(r.main))
            score -= 15;
        const lines = linesOf(r);
        const shared = [...new Set(lines.filter(l => ['fruits-legumes', 'cremerie', 'frais'].includes(aisleOf(l.name, l.form, s.aisles)))
                .map(l => nameKey(l.name)).filter(k => ctx.weekFresh.has(k)))].map(k => ctx.weekFresh.get(k));
        if (shared.length) {
            score += Math.min(12, 4 * shared.length);
            why.push(`réutilise ${shared.slice(0, 2).join(', ')}`);
        }
        out.push({ recipe: r, score, reason: `${why.join(' · ')} · Wikilivres` });
    }
    return out.sort((a, b) => b.score - a.score || hash(ctx.week + a.recipe.id) - hash(ctx.week + b.recipe.id));
}
// Familles des plats déjà prévus autour d'un jour (vos plats), pour ne pas proposer deux volailles de suite.
export function familiesOf(s, recipes) {
    const out = new Set();
    for (const id of recipes) {
        const r = s.recipes[id];
        if (!r)
            continue;
        const f = current(r).ingredients.map(l => familyOf(l.name)).find(Boolean);
        if (f)
            out.add(f);
    }
    return out;
}
