// « Qu'est-ce qu'on mange ? » : propositions tirées uniquement de VOS plats, avec une raison lisible.
// Règle déterministe (pas d'IA) : le plat le moins récemment prévu d'abord, bonus « rapide » en semaine, « week-end » le week-end,
// « favori », et un plat qui utilise un produit surveillé dont la DLC approche. Rien n'est appliqué sans votre accord.
import { slotKey, parseSlot, addDays, weekday, daysBetween, prevSlot, slotOrder, SLOTS, fmtDayShort, paris } from './dates.js';
import { current } from './model.js';
import { eaters, servings, portions, presence as presenceOf } from './plan.js';
import { nameKey } from './text.js';
import { newId } from './reduce.js';
import { wholeExtra } from './commands.js';
import { prepTitle } from './status.js';
export const TAGS = ['rapide', 'week-end', 'favori', 'plat entier', 'placard', 'végétarien'];
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
export function rank(s, slot, today, exclude = new Set()) {
    const p = parseSlot(slot);
    if (!p)
        return [];
    const last = lastPlanned(s);
    const weekend = weekday(p.date) >= 5, evening = p.slot === 'soir';
    const exp = expiring(s, p.date);
    const out = [];
    for (const r of Object.values(s.recipes)) {
        if (r.archived || exclude.has(r.id))
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
        if (since !== null && Math.abs(since) < 4)
            score -= 30; // pas deux fois en quelques jours
        why.push(since === null ? 'pas encore prévu' : since < 0 ? `déjà prévu ${fmtDayShort(seen)}` : since === 0 ? 'prévu aujourd\'hui' : `pas au menu depuis ${since} j`);
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
// Remplit les créneaux vides de la semaine où quelqu'un mange. Les créneaux déjà prévus ne bougent pas.
export function proposeWeek(s, week, today, hour) {
    const out = [];
    const used = new Set();
    const cooks = new Map(); // créneau → préparation existante (null si seulement proposée)
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
            const best = rank(s, k, today, used)[0];
            if (!best)
                continue;
            used.add(best.recipe);
            cooks.set(k, null);
            out.push({ slot: k, dish: { kind: 'cook', recipe: best.recipe, extra: 0 }, reason: best.reason, presence: {}, guests: 0 });
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
