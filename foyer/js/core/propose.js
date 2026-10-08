// « Qu'est-ce qu'on mange ? » : propositions tirées uniquement de VOS plats, avec une raison lisible.
// Règle déterministe (pas d'IA) : le plat le moins récemment prévu d'abord, bonus « rapide » en semaine, « week-end » le week-end,
// « favori », et un plat qui utilise un produit surveillé dont la DLC approche. Rien n'est appliqué sans votre accord.
import { slotKey, parseSlot, addDays, weekday, daysBetween, prevSlot, slotOrder, SLOTS, fmtDayShort, paris } from './dates.js';
import { current } from './model.js';
import { eaters, servings, portions, presence as presenceOf } from './plan.js';
import { nameKey } from './text.js';
import { aisleOf } from './ingredients.js';
import { newId } from './reduce.js';
import { wholeExtra } from './commands.js';
import { prepTitle } from './status.js';
import { discover, familiesOf, toContent } from './catalog.js';
import { defaultIn, lastWeekday } from './batch.js';
import { dishType } from './visual.js';
import { weekBalance, running, balanceBonus, addToRunning } from './balance.js';
import { weekOf } from './dates.js';
export const TAGS = ['rapide', 'week-end', 'favori', 'plat entier', 'placard', 'végétarien', 'batch'];
// Dernier jour où chaque plat a été prévu (cuisiné).
export function lastPlanned(s) {
    const m = new Map();
    for (const p of Object.values(s.preps)) {
        const d = p.slot ? parseSlot(p.slot)?.date : p.done ? paris(new Date(p.done.at)).date : undefined;
        if (d && (!m.has(p.recipe) || m.get(p.recipe) < d))
            m.set(p.recipe, d);
    }
    return m;
}
// Aucune redondance : un plat prévu à moins de 2 semaines (avant ou après) n'est pas reproposé tant qu'il reste autre chose.
export const NO_REPEAT = 13;
const DATES = new WeakMap();
function plannedDates(s) {
    let m = DATES.get(s);
    if (!m) {
        m = new Map();
        for (const p of Object.values(s.preps)) {
            const d = p.slot ? parseSlot(p.slot)?.date : p.done ? paris(new Date(p.done.at)).date : undefined;
            if (d)
                m.set(p.recipe, [...(m.get(p.recipe) ?? []), d]);
        }
        DATES.set(s, m);
    }
    return m;
}
const typeOfRecipe = (s, id) => { const r = s.recipes[id]; if (!r)
    return null; const c = current(r); return dishType(c.name, c.ingredients.map(l => l.name)); };
// Produits frais d'un plat (ceux qu'on achète pour lui et qui ne se gardent pas au placard).
const FRESH = new Set(['fruits-legumes', 'cremerie', 'frais', 'boucherie', 'boulangerie']);
function fresh(s, recipe) {
    const r = s.recipes[recipe];
    const m = new Map();
    if (r)
        for (const l of current(r).ingredients)
            if (FRESH.has(aisleOf(l.name, l.form, s.aisles)))
                m.set(nameKey(l.name), l.name.toLowerCase());
    return m;
}
// Ingrédient principal : la première viande, le premier poisson ou la première charcuterie de la recette.
function mainOf(s, recipe) {
    const r = s.recipes[recipe];
    if (!r)
        return null;
    const l = current(r).ingredients.find(x => { const a = aisleOf(x.name, x.form, s.aisles); return a === 'boucherie' || a === 'frais'; });
    return l ? nameKey(l.name).split(' ')[0] ?? null : null;
}
function around(s, day, extra) {
    const m = new Map();
    for (const p of Object.values(s.preps)) {
        const d = p.slot ? parseSlot(p.slot)?.date : undefined;
        if (d && Math.abs(daysBetween(day, d)) <= 6)
            m.set(d, [...(m.get(d) ?? []), p.recipe]);
    }
    for (const [d, rs] of extra)
        m.set(d, [...(m.get(d) ?? []), ...rs]);
    return m;
}
// Produits surveillés fermés dont la DLC tombe dans les 3 jours suivant le créneau : un plat qui les utilise est mis en avant.
function expiring(s, day) {
    const m = new Map();
    for (const w of Object.values(s.watch)) {
        if (w.closed || !w.date || w.date.kind !== 'DLC' || w.state !== 'ferme')
            continue;
        const delta = daysBetween(day, w.date.value);
        if (delta >= 0 && delta <= 3)
            m.set(nameKey(w.name), { name: w.name, date: w.date.value });
    }
    return m;
}
export function rank(s, slot, today, exclude = new Set(), extra = new Map(), opts = {}) {
    const p = parseSlot(slot);
    if (!p)
        return [];
    const dates = plannedDates(s);
    const run = opts.run ?? running(weekBalance(s, weekOf(p.date, s.settings.weekStart)));
    const near = around(s, p.date, extra);
    const neighbours = [-1, 0, 1].flatMap(dd => near.get(addDays(p.date, dd)) ?? []);
    const neighbourMains = new Set(neighbours.map(r => mainOf(s, r)).filter((x) => !!x));
    const weekFresh = new Map();
    for (const rs of near.values())
        for (const r of rs)
            for (const [k, v] of fresh(s, r))
                weekFresh.set(k, v);
    const last = lastPlanned(s);
    const weekend = weekday(p.date) >= 5, evening = p.slot === 'soir';
    const rit = s.settings.ritual, batchSlot = !!rit && defaultIn(lastWeekday(addDays(p.date, -1), rit.cook), p.date);
    const exp = expiring(s, p.date);
    const out = [];
    for (const r of Object.values(s.recipes)) {
        if (r.archived || exclude.has(r.id))
            continue;
        if (opts.noRepeat && (dates.get(r.id) ?? []).some(d => Math.abs(daysBetween(d, p.date)) <= NO_REPEAT))
            continue;
        const c = current(r);
        const tags = new Set(c.tags);
        const seen = last.get(r.id);
        const since = seen ? daysBetween(seen, today) : null;
        let score = since === null ? 40 : Math.min(Math.max(since, 0), 45);
        const why = [];
        const used = c.ingredients.map(l => exp.get(nameKey(l.name))).find(Boolean);
        if (used) {
            score += 30;
            why.push(`utilise ${used.name.toLowerCase()} (DLC ${fmtDayShort(used.date)})`);
        }
        if (tags.has('rapide') && !weekend && evening) {
            score += 10;
            why.push('rapide');
        }
        if (tags.has('week-end') && weekend) {
            score += 10;
            why.push('plat du week-end');
        }
        if (tags.has('favori')) {
            score += 8;
            why.push('favori');
        }
        if (tags.has('batch') && batchSlot) {
            score += 10;
            why.push('se prépare à l\'avance');
        }
        const type = dishType(c.name, c.ingredients.map(l => l.name)), same = type ? opts.types?.get(type) ?? 0 : 0;
        if (same)
            score -= 14 * same; // pas deux plats du même genre dans la semaine
        const b = balanceBonus(run, c.ingredients.map(l => l.name));
        if (b) {
            score += b.score;
            if (b.why)
                why.push(b.why);
        }
        // Réutiliser un produit frais déjà acheté pour un autre plat de la semaine : moins de restes de crème ou de coriandre.
        const shared = [...fresh(s, r.id)].filter(([k]) => weekFresh.has(k)).map(([, v]) => v);
        if (shared.length) {
            score += Math.min(12, 4 * shared.length);
            why.push(`réutilise ${shared.slice(0, 2).join(', ')}`);
        }
        // Varier : pas la même viande ou le même poisson deux jours de suite.
        const main = mainOf(s, r.id);
        if (main && neighbourMains.has(main))
            score -= 15;
        if (since !== null && Math.abs(since) < 4)
            score -= 30; // pas deux fois en quelques jours
        why.push(since === null ? 'jamais encore au menu' : since < 0 ? `déjà prévu ${fmtDayShort(seen)}` : since === 0 ? 'prévu aujourd\'hui' : `pas au menu depuis ${since} j`);
        out.push({ recipe: r.id, name: c.name, score, reason: why.join(' · ') });
    }
    return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr') || (a.recipe < b.recipe ? -1 : 1));
}
const onlyBoxes = (s, k) => {
    const present = eaters(s, k).filter(e => e.presence !== 'dehors');
    return present.length > 0 && present.every(e => e.presence === 'boite') && !(s.slots[k]?.guests);
};
// Créneau encore à venir (on ne propose rien pour un repas passé).
export const isUpcoming = (k, today, hour) => {
    const p = parseSlot(k);
    if (!p)
        return false;
    return p.date > today || (p.date === today && (p.slot === 'soir' ? hour < 21 : hour < 14));
};
// Contexte d'un créneau pour une découverte : familles (volaille, poisson…) des jours voisins, produits frais de la semaine.
function discoveryContext(s, slot, week, extra, newFamilies, exclude) {
    const p = parseSlot(slot);
    const near = around(s, p.date, extra);
    const days = [-1, 0, 1].map(dd => addDays(p.date, dd));
    const neighbourFamilies = familiesOf(s, days.flatMap(d => near.get(d) ?? []));
    for (const d of days)
        for (const f of newFamilies.get(d) ?? [])
            neighbourFamilies.add(f);
    const weekFresh = new Map();
    for (const rs of near.values())
        for (const r of rs)
            for (const [k, v] of fresh(s, r))
                weekFresh.set(k, v);
    return { week, weekend: weekday(p.date) >= 5, evening: p.slot === 'soir', neighbourFamilies, weekFresh, exclude };
}
// Types de plats déjà prévus dans une semaine (pour varier : pas deux soupes, deux gratins…).
function weekTypes(s, week) {
    const types = new Map();
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const d = s.slots[slotKey(addDays(week, i), sl)]?.dish;
            const t = d?.kind === 'cook' ? typeOfRecipe(s, s.preps[d.prep]?.recipe ?? '') : null;
            if (t)
                types.set(t, (types.get(t) ?? 0) + 1);
        }
    return types;
}
// « Autre idée » sur une découverte : la suivante pour ce créneau, hors celles déjà vues ou proposées ailleurs.
export function nextDiscovery(s, cat, slot, week, exclude, seen = new Set()) {
    const run = running(weekBalance(s, week));
    return discover(s, cat, { ...discoveryContext(s, slot, week, new Map(), new Map(), exclude), types: weekTypes(s, week), seen,
        noYield: (s.settings.variety ?? 'max') === 'max', bonus: r => balanceBonus(run, r.ingredients) })[0];
}
// Remplit les créneaux vides de la semaine où quelqu'un mange. Les créneaux déjà prévus ne bougent pas.
// Selon le réglage « Nouveautés » : « max » (défaut) = une recette nouvelle à chaque repas tant que le catalogue en a, vos plats ensuite ;
// « equilibre » = vos plats d'abord, de 1 à 3 découvertes par semaine ; « mes-plats » = vos plats, découvertes seulement s'il n'en reste plus.
// Toujours : jamais deux fois le même plat, pas un plat prévu à moins de 2 semaines s'il reste autre chose, pas deux plats du même genre,
// pas la même viande deux jours de suite, et les repères d'équilibre de la semaine (poisson, légumes secs) mis en avant.
const MAX_NEW = 3;
export function proposeWeek(s, week, today, hour, cat = null, seen = new Set()) {
    const mode = s.settings.variety ?? 'max';
    const out = [];
    const used = new Set(), usedNew = new Set();
    const newFamilies = new Map();
    const scores = new Map();
    const cooks = new Map(); // créneau → préparation existante (null si seulement proposée)
    const proposed = new Map();
    const types = weekTypes(s, week), run = running(weekBalance(s, week));
    const addType = (t) => { if (t)
        types.set(t, (types.get(t) ?? 0) + 1); };
    const pickNew = (k) => {
        const best = cat ? discover(s, cat, { ...discoveryContext(s, k, week, proposed, newFamilies, usedNew), types, seen, noYield: mode === 'max',
            bonus: r => balanceBonus(run, r.ingredients) })[0] : undefined;
        if (!best)
            return null;
        usedNew.add(best.recipe.id);
        const d = parseSlot(k)?.date;
        if (best.recipe.main)
            newFamilies.set(d, [...(newFamilies.get(d) ?? []), best.recipe.main]);
        addType(dishType(best.recipe.title, best.recipe.ingredients));
        addToRunning(run, best.recipe.ingredients);
        return best;
    };
    const pickOwn = (k, noRepeat) => {
        const best = rank(s, k, today, used, proposed, { noRepeat, types, run })[0];
        if (!best)
            return null;
        const d = parseSlot(k)?.date, r = s.recipes[best.recipe];
        used.add(best.recipe);
        proposed.set(d, [...(proposed.get(d) ?? []), best.recipe]);
        addType(typeOfRecipe(s, best.recipe));
        if (r)
            addToRunning(run, current(r).ingredients.map(l => l.name));
        return best;
    };
    const pushNew = (k, fresh) => { cooks.set(k, null); out.push({ slot: k, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason, presence: {}, guests: 0 }); };
    const pushOwn = (k, best) => { cooks.set(k, null); scores.set(k, best.score); out.push({ slot: k, dish: { kind: 'cook', recipe: best.recipe, extra: 0 }, reason: best.reason, presence: {}, guests: 0 }); };
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(week, i), sl);
            const d = s.slots[k]?.dish;
            if (d?.kind === 'cook') {
                const p = s.preps[d.prep];
                if (p) {
                    used.add(p.recipe);
                    cooks.set(k, p.id);
                }
            }
        }
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(week, i), sl);
            if (!isUpcoming(k, today, hour) || s.slots[k]?.dish || servings(s, k) === 0)
                continue;
            if (sl === 'midi' && onlyBoxes(s, k) && s.settings.boxesFromDinner) {
                const src = prevSlot(k);
                if (cooks.has(src))
                    out.push({ slot: k, dish: { kind: 'from', source: src, prep: cooks.get(src) ?? null }, reason: 'boîte : restes du dîner de la veille', presence: {}, guests: 0 });
                continue;
            }
            if (mode === 'max') {
                const fresh = pickNew(k);
                if (fresh) {
                    pushNew(k, fresh);
                    continue;
                }
                const own = pickOwn(k, true) ?? pickOwn(k, false);
                if (own)
                    pushOwn(k, own);
                continue;
            }
            const own = pickOwn(k, true);
            if (own) {
                pushOwn(k, own);
                continue;
            }
            const fresh = mode === 'mes-plats' || usedNew.size < MAX_NEW ? pickNew(k) : null;
            if (fresh) {
                pushNew(k, fresh);
                continue;
            }
            const again = pickOwn(k, false); // plus rien d'autre : un plat récent plutôt qu'un repas vide
            if (again)
                pushOwn(k, again);
        }
    if (mode === 'equilibre' && cat && !out.some(p => p.dish?.kind === 'new')) {
        const weakest = out.filter(p => p.dish?.kind === 'cook' && !out.some(x => x.dish?.kind === 'from' && x.dish.source === p.slot))
            .sort((a, b) => (scores.get(a.slot) ?? 0) - (scores.get(b.slot) ?? 0) || (a.slot < b.slot ? -1 : 1))[0];
        const fresh = weakest ? pickNew(weakest.slot) : null;
        if (weakest && fresh)
            out[out.indexOf(weakest)] = { ...weakest, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason };
    }
    return out;
}
// Reprendre une autre semaine comme brouillon : plats, présences et invités ; jamais les états, coches, vérifications ni dates.
export function copyWeek(s, from, to) {
    const offset = daysBetween(from, to);
    const proposals = [];
    const skipped = [];
    const lo = slotOrder(slotKey(from, 'midi')), hi = slotOrder(slotKey(addDays(from, 6), 'soir'));
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const src = slotKey(addDays(from, i), sl), dst = slotKey(addDays(to, i), sl);
            const slot = s.slots[src];
            if (!slot)
                continue;
            const base = { slot: dst, presence: { ...slot.presence }, guests: slot.guests };
            const d = slot.dish;
            if (d && s.slots[dst]?.dish) {
                skipped.push(dst);
                continue;
            }
            if (!d) {
                if (Object.keys(base.presence).length || base.guests)
                    proposals.push({ ...base, dish: null, reason: 'présences copiées' });
                continue;
            }
            if (d.kind === 'outside') {
                proposals.push({ ...base, dish: { kind: 'outside', note: d.note }, reason: 'repas extérieur copié' });
                continue;
            }
            const p = s.preps[d.prep];
            if (!p)
                continue;
            if (d.kind === 'cook') {
                proposals.push({ ...base, dish: { kind: 'cook', recipe: p.recipe, extra: p.extra }, reason: 'copié' });
                continue;
            }
            const ps = p.slot ? parseSlot(p.slot) : null;
            if (ps && p.slot && slotOrder(p.slot) >= lo && slotOrder(p.slot) <= hi)
                proposals.push({ ...base, dish: { kind: 'from', source: slotKey(addDays(ps.date, offset), ps.slot), prep: null }, reason: `restes de ${prepTitle(s, p)}` });
            else
                proposals.push({ ...base, dish: null, reason: 'restes d\'un plat hors de la semaine : à choisir' });
        }
    return { proposals, skipped };
}
// Événements pour accepter des propositions (préparations créées ici, liens vers les plats proposés résolus).
export function acceptDrafts(s, proposals) {
    const drafts = [];
    const prepAt = new Map();
    for (const p of proposals) {
        for (const [m, pr] of Object.entries(p.presence))
            drafts.push({ t: 'slot.presence', p: { slot: p.slot, member: m, presence: pr } });
        if (p.guests)
            drafts.push({ t: 'slot.guests', p: { slot: p.slot, guests: p.guests } });
        if (p.dish?.kind === 'cook') {
            const id = newId();
            prepAt.set(p.slot, id);
            drafts.push({ t: 'slot.cook', p: { slot: p.slot, prep: id, recipe: p.dish.recipe, extra: p.dish.extra } });
        }
        if (p.dish?.kind === 'new') {
            const recipe = newId(), id = newId();
            prepAt.set(p.slot, id);
            drafts.push({ t: 'recipe.save', p: { recipe, content: toContent(p.dish.catalog, p.dish.yield ?? null) } }, { t: 'slot.cook', p: { slot: p.slot, prep: id, recipe, extra: p.dish.extra } });
        }
        if (p.dish?.kind === 'outside')
            drafts.push({ t: 'slot.outside', p: { slot: p.slot, note: p.dish.note } });
    }
    for (const p of proposals) {
        if (p.dish?.kind !== 'from')
            continue;
        const d = s.slots[p.dish.source]?.dish;
        const prep = p.dish.prep ?? prepAt.get(p.dish.source) ?? (d?.kind === 'cook' ? d.prep : null);
        if (prep)
            drafts.push({ t: 'slot.from', p: { slot: p.slot, prep } });
    }
    // « Plat entier » proposé : le surplus au-delà du repas et de ses boîtes est compté « en plus ».
    for (const p of proposals) {
        if (p.dish?.kind !== 'cook' || p.dish.extra)
            continue;
        const people = (k) => s.members.filter(m => (p2(k)?.presence[m.id] ?? presenceOf(s, k, m.id)) !== 'dehors').length + (p2(k)?.guests ?? 0);
        const needed = people(p.slot) + proposals.filter(x => x.dish?.kind === 'from' && x.dish.source === p.slot).reduce((n, x) => n + people(x.slot), 0);
        const extra = wholeExtra(s, p.dish.recipe, needed);
        const cook = drafts.find(x => x.t === 'slot.cook' && x.p.slot === p.slot);
        if (extra && cook && cook.t === 'slot.cook')
            cook.p.extra = extra;
    }
    return drafts;
    function p2(k) { return proposals.find(x => x.slot === k); }
}
export function leftovers(s, today) {
    const out = [];
    for (const p of Object.values(s.preps)) {
        const pt = portions(s, p);
        if (!p.done || pt.free === null || pt.free <= 0)
            continue;
        const declared = paris(new Date(p.done.at)).date, cooked = p.slot ? parseSlot(p.slot)?.date ?? declared : declared;
        const made = cooked < declared ? cooked : declared; // cuisiné au plus tard à la déclaration
        out.push({ prep: p.id, name: prepTitle(s, p), free: pt.free, age: Math.max(0, daysBetween(made, today)) });
    }
    return out.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name, 'fr'));
}
