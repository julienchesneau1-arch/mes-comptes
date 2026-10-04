import { emptyState, current } from './model.js';
import { portions, invalidate } from './plan.js';
class Reject extends Error {
    severity;
    constructor(reason, severity = 'conflict') { super(reason); this.severity = severity; }
}
function noop(why) { throw new Reject(why, 'noop'); }
function conflict(why) { throw new Reject(why, 'conflict'); }
// Ordre commun : horloge logique, puis appareil, puis identifiant. Indépendant de l'ordre de réception.
export const order = (a, b) => a.lc - b.lc || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function sortLog(events) {
    const byId = new Map();
    for (const e of events)
        if (!byId.has(e.id))
            byId.set(e.id, e);
    return [...byId.values()].sort(order);
}
const slotOf = (s, k) => (s.slots[k] ??= { presence: {}, guests: 0, dish: null, eaten: null, chef: null });
const weekShop = (s, w) => (s.shop[w] ??= { checked: {}, pantry: {}, items: {} });
const prepOf = (s, id) => s.preps[id] ?? conflict('plat introuvable (retiré entre-temps)');
const recipeName = (s, id) => { const r = s.recipes[id]; return r ? current(r).name : 'ce plat'; };
const dishName = (s, k) => {
    const d = s.slots[k]?.dish;
    if (!d)
        return 'rien';
    if (d.kind === 'outside')
        return 'un repas extérieur';
    const p = s.preps[d.prep];
    return p ? recipeName(s, p.recipe) : 'un plat';
};
// Un créneau devenu vide sans réglage particulier disparaît : l'état reste compact.
const tidy = (s, k) => {
    const x = s.slots[k];
    if (x && !x.dish && !x.eaten && !x.guests && !x.chef && !Object.keys(x.presence).length)
        delete s.slots[k];
};
function removeDish(s, k) {
    const slot = s.slots[k];
    const d = slot?.dish;
    if (!slot || !d)
        return;
    if (d.kind === 'cook') {
        const prep = s.preps[d.prep];
        if (prep) {
            if (prep.done)
                prep.slot = null; // déjà préparé : les portions restent, détachées du planning
            else
                delete s.preps[d.prep]; // jamais préparé : la préparation disparaît (les repas qui en dépendaient le signalent)
        }
    }
    slot.dish = null;
}
function apply(s, e) {
    if (e.t !== 'household.init' && !s.hid)
        conflict('foyer pas encore créé sur ce téléphone');
    switch (e.t) {
        case 'household.init': {
            if (s.hid === e.p.hid)
                noop('foyer déjà créé');
            if (s.hid)
                conflict('ce lien vient d\'un autre foyer');
            s.hid = e.p.hid;
            s.members = e.p.members.map(m => ({ ...m }));
            s.settings = structuredClone(e.p.settings);
            return;
        }
        case 'members.set': {
            const ids = new Set(e.p.members.map(m => m.id));
            if (s.members.some(m => !ids.has(m.id)))
                conflict('un membre ne peut pas être retiré');
            s.members = e.p.members.map(m => ({ ...m }));
            return;
        }
        case 'settings.set': {
            if (e.p.weekStart !== undefined)
                s.settings.weekStart = e.p.weekStart;
            if (e.p.rhythm !== undefined)
                s.settings.rhythm = structuredClone(e.p.rhythm);
            if (e.p.boxesFromDinner !== undefined)
                s.settings.boxesFromDinner = e.p.boxesFromDinner;
            if (e.p.aisleOrder !== undefined)
                s.settings.aisleOrder = [...e.p.aisleOrder];
            return;
        }
        case 'recipe.save': {
            const r = s.recipes[e.p.recipe];
            const content = structuredClone(e.p.content);
            if (!r) {
                s.recipes[e.p.recipe] = { id: e.p.recipe, versions: [content], archived: false };
                return;
            }
            if (JSON.stringify(current(r)) === JSON.stringify(content))
                noop('recette inchangée');
            r.versions.push(content);
            return;
        }
        case 'recipe.archive': {
            const r = s.recipes[e.p.recipe] ?? conflict('recette introuvable');
            if (r.archived === e.p.archived)
                noop('déjà fait');
            r.archived = e.p.archived;
            return;
        }
        case 'slot.presence': {
            if (!s.members.some(m => m.id === e.p.member))
                conflict('membre inconnu');
            const slot = slotOf(s, e.p.slot);
            if (e.p.presence === null)
                delete slot.presence[e.p.member];
            else
                slot.presence[e.p.member] = e.p.presence;
            tidy(s, e.p.slot);
            return;
        }
        case 'slot.guests': {
            slotOf(s, e.p.slot).guests = e.p.guests;
            tidy(s, e.p.slot);
            return;
        }
        case 'slot.chef': {
            if (e.p.member !== null && !s.members.some(m => m.id === e.p.member))
                conflict('membre inconnu');
            slotOf(s, e.p.slot).chef = e.p.member;
            tidy(s, e.p.slot);
            return;
        }
        case 'slot.cook': {
            if (s.preps[e.p.prep])
                noop('déjà enregistré');
            if (!s.recipes[e.p.recipe])
                conflict('recette introuvable');
            const slot = slotOf(s, e.p.slot);
            if (slot.eaten)
                conflict('ce repas est déjà déclaré mangé');
            if (slot.dish)
                conflict(`créneau déjà occupé par ${dishName(s, e.p.slot)}`);
            s.preps[e.p.prep] = { id: e.p.prep, recipe: e.p.recipe, slot: e.p.slot, extra: e.p.extra, status: 'planned', done: null, discarded: 0 };
            slot.dish = { kind: 'cook', prep: e.p.prep };
            return;
        }
        case 'slot.from': {
            const prep = prepOf(s, e.p.prep);
            if (prep.slot === e.p.slot)
                conflict('un plat ne peut pas être ses propres restes');
            const slot = slotOf(s, e.p.slot);
            if (slot.eaten)
                conflict('ce repas est déjà déclaré mangé');
            if (slot.dish?.kind === 'from' && slot.dish.prep === e.p.prep)
                noop('déjà prévu');
            if (slot.dish)
                conflict(`créneau déjà occupé par ${dishName(s, e.p.slot)}`);
            slot.dish = { kind: 'from', prep: e.p.prep };
            invalidate(s);
            const pt = portions(s, prep);
            if (pt.free !== null && pt.free < 0) {
                slot.dish = null;
                tidy(s, e.p.slot);
                conflict(`plus assez de portions libres de ${recipeName(s, prep.recipe)}`);
            }
            return;
        }
        case 'slot.outside': {
            const slot = slotOf(s, e.p.slot);
            if (slot.eaten)
                conflict('ce repas est déjà déclaré mangé');
            if (slot.dish?.kind === 'outside') {
                slot.dish.note = e.p.note;
                return;
            }
            if (slot.dish)
                conflict(`créneau déjà occupé par ${dishName(s, e.p.slot)}`);
            slot.dish = { kind: 'outside', note: e.p.note };
            return;
        }
        case 'slot.clear': {
            const slot = s.slots[e.p.slot];
            if (!slot?.dish)
                noop('déjà vide');
            if (slot.eaten)
                conflict('ce repas est déjà déclaré mangé : utilisez « Annuler »');
            removeDish(s, e.p.slot);
            tidy(s, e.p.slot);
            return;
        }
        case 'slot.move': {
            const a = s.slots[e.p.from], b = s.slots[e.p.to];
            if (!a?.dish)
                conflict('plus rien à déplacer sur ce créneau');
            if (a.eaten || b?.eaten)
                conflict('un repas déjà mangé ne se déplace pas');
            if (b?.dish && !e.p.swap)
                conflict(`créneau cible occupé par ${dishName(s, e.p.to)}`);
            const from = slotOf(s, e.p.from), to = slotOf(s, e.p.to);
            const da = from.dish, db = to.dish;
            from.dish = db;
            to.dish = da;
            if (da?.kind === 'cook') {
                const p = s.preps[da.prep];
                if (p)
                    p.slot = e.p.to;
            }
            if (db?.kind === 'cook') {
                const p = s.preps[db.prep];
                if (p)
                    p.slot = e.p.from;
            }
            tidy(s, e.p.from);
            tidy(s, e.p.to);
            return;
        }
        case 'slot.eaten': {
            const slot = s.slots[e.p.slot];
            if (slot?.eaten)
                noop('déjà déclaré mangé');
            const d = slot?.dish;
            if (!slot || !d)
                conflict('aucun plat sur ce créneau');
            if (d.kind === 'outside')
                conflict('repas extérieur');
            const prep = prepOf(s, d.prep);
            if (!prep.done)
                conflict(`${recipeName(s, prep.recipe)} n'est pas déclaré préparé`);
            const pt = portions(s, prep);
            if (pt.remaining !== null && e.p.n > pt.remaining)
                conflict(`il ne reste que ${pt.remaining} portion(s) déclarée(s)`);
            slot.eaten = { n: e.p.n, by: e.by, at: e.at };
            return;
        }
        case 'prep.recipe': {
            const prep = prepOf(s, e.p.prep);
            if (prep.done)
                conflict('plat déjà préparé');
            if (!s.recipes[e.p.recipe])
                conflict('recette introuvable');
            if (prep.recipe === e.p.recipe)
                noop('déjà ce plat');
            prep.recipe = e.p.recipe;
            return;
        }
        case 'prep.extra': {
            const prep = prepOf(s, e.p.prep);
            if (prep.done)
                conflict('plat déjà préparé : corrigez plutôt le nombre de portions préparées');
            prep.extra = e.p.extra;
            return;
        }
        case 'prep.start': {
            const prep = prepOf(s, e.p.prep);
            if (prep.status !== 'planned')
                noop('déjà commencé');
            prep.status = 'started';
            return;
        }
        case 'prep.done': {
            const prep = prepOf(s, e.p.prep);
            if (prep.done) {
                if (prep.done.yield === e.p.yield)
                    noop('déjà déclaré préparé');
                conflict(`déjà déclaré préparé avec ${prep.done.yield} portion(s)`);
            }
            const r = s.recipes[prep.recipe];
            prep.status = 'done';
            prep.done = { yield: e.p.yield, planned: e.p.planned, version: r ? Math.min(e.p.version, r.versions.length) : e.p.version, by: e.by, at: e.at };
            return;
        }
        case 'prep.correct': {
            const prep = prepOf(s, e.p.prep);
            if (!prep.done)
                conflict('pas encore déclaré préparé');
            const pt = portions(s, prep);
            if (e.p.yield < pt.eaten + pt.discarded)
                conflict(`incompatible : ${pt.eaten} portion(s) déjà mangée(s) et ${pt.discarded} jetée(s)`);
            if (prep.done.yield === e.p.yield)
                noop('inchangé');
            prep.done.yield = e.p.yield;
            return;
        }
        case 'prep.discard': {
            const prep = prepOf(s, e.p.prep);
            if (!prep.done)
                conflict('pas encore déclaré préparé');
            const pt = portions(s, prep);
            if (pt.remaining !== null && e.p.n > pt.remaining)
                conflict(`il ne reste que ${pt.remaining} portion(s)`);
            prep.discarded += e.p.n;
            return;
        }
        case 'task.set': {
            s.tasks[e.p.key] = { done: e.p.done, by: e.by, at: e.at };
            return;
        }
        case 'shop.check': {
            const w = weekShop(s, e.p.week);
            if (e.p.needAt === null)
                delete w.checked[e.p.key];
            else
                w.checked[e.p.key] = { needAt: e.p.needAt, by: e.by, at: e.at };
            return;
        }
        case 'shop.pantry': {
            const w = weekShop(s, e.p.week);
            if (e.p.qty === null)
                delete w.pantry[e.p.key];
            else
                w.pantry[e.p.key] = { qty: e.p.qty, needAt: e.p.needAt, by: e.by, at: e.at };
            return;
        }
        case 'shop.item': {
            const w = weekShop(s, e.p.week);
            if (e.p.removed)
                delete w.items[e.p.id];
            else
                w.items[e.p.id] = { name: e.p.name, qty: e.p.qty, aisle: e.p.aisle, checked: e.p.checked, by: e.by, at: e.at };
            return;
        }
        case 'staple.set': {
            if (e.p.removed)
                delete s.staples[e.p.key];
            else
                s.staples[e.p.key] = { name: e.p.name, qty: e.p.qty, aisle: e.p.aisle };
            return;
        }
        case 'aisle.set': {
            s.aisles[e.p.key] = e.p.aisle;
            return;
        }
        case 'product.set': {
            if (e.p.url === null) {
                if (!s.products[e.p.key])
                    noop('aucun produit retenu');
                delete s.products[e.p.key];
                return;
            }
            s.products[e.p.key] = { url: e.p.url, label: e.p.label, size: e.p.size, unit: e.p.unit, by: e.by, at: e.at };
            return;
        }
        case 'watch.save': {
            const old = s.watch[e.p.id];
            s.watch[e.p.id] = { id: e.p.id, name: e.p.name, qty: e.p.qty, date: e.p.date ? { ...e.p.date } : null, state: e.p.state, slot: e.p.slot,
                closed: old?.closed ?? null, by: e.by, at: e.at };
            return;
        }
        case 'watch.close': {
            const w = s.watch[e.p.id] ?? conflict('produit introuvable');
            if (w.closed)
                noop('déjà retiré');
            w.closed = e.p.outcome;
            return;
        }
        case 'conflict.ack': {
            s.acked.add(e.p.event);
            return;
        }
        case 'undo':
            return; // traité avant le rejeu
    }
}
// Rejoue un journal. `skip` : événements à ignorer (simulation d'une annulation avant de la proposer).
export function replay(log, skip = new Set()) {
    const events = sortLog(log);
    const ids = new Map(events.map(e => [e.id, e]));
    const undone = new Set(skip);
    for (const e of events) {
        if (e.t !== 'undo' || undone.has(e.id))
            continue;
        const target = ids.get(e.p.event);
        if (target && target.t !== 'undo')
            undone.add(target.id);
    }
    const state = emptyState();
    const rejected = new Map();
    let maxLc = 0;
    for (const e of events) {
        maxLc = Math.max(maxLc, e.lc);
        if (undone.has(e.id))
            continue;
        try {
            apply(state, e);
        }
        catch (err) {
            if (!(err instanceof Reject))
                throw err;
            rejected.set(e.id, { id: e.id, t: e.t, by: e.by, at: e.at, reason: err.message, severity: err.severity });
        }
        invalidate(state);
    }
    return { state, rejected, maxLc, count: events.length, events: ids, undone };
}
// Conflits à montrer : écartés pour une vraie raison, pas encore vus.
export const openConflicts = (r) => [...r.rejected.values()].filter(x => x.severity === 'conflict' && !r.state.acked.has(x.id));
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newId(len = 12) {
    const b = crypto.getRandomValues(new Uint8Array(len));
    let s = '';
    for (const x of b)
        s += ALPHA[x % 36];
    return s;
}
// Une commande = un ou plusieurs événements, horloge logique croissante, même instant.
export function stamp(ctx, drafts) {
    const at = ctx.now.toISOString();
    return drafts.map((d, i) => ({ id: newId(), lc: ctx.lc + 1 + i, dev: ctx.dev, by: ctx.by, at, t: d.t, p: d.p }));
}
