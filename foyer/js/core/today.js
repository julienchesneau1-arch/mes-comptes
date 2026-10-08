// Écran « Aujourd'hui » : le prochain repas, l'action suivante, les tâches courtes, et seulement les problèmes utiles à ces repas.
import { slotKey, addDays, parseSlot, fmtSlot, fmtRelDay, weekOf, weekday, SLOTS, paris } from './dates.js';
import { current } from './model.js';
import { portions, servings, eaters, dependents } from './plan.js';
import {} from './reduce.js';
import { slotView, problems, prepTitle } from './status.js';
import { deriveShopping } from './shopping.js';
import { rank, leftovers, isUpcoming } from './propose.js';
import { ritualNow } from './batch.js';
const capitalFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const who = (s, k) => {
    const boxes = eaters(s, k).filter(e => e.presence === 'boite').map(e => e.name);
    return boxes.length ? ` (boîte ${boxes.join(', ')})` : '';
};
// « Préparer 4 portions : 2 ce soir, 1 pour demain midi (boîte Alex), 1 en plus. »
export function portionsDetail(s, prep, at, today) {
    const pt = portions(s, prep);
    const deps = dependents(s, prep.id);
    const parts = [];
    if (prep.slot)
        parts.push(`${pt.serve} ${fmtSlot(prep.slot, today)}`);
    for (const d of deps)
        parts.push(`${servings(s, d)} pour ${fmtSlot(d, today)}${who(s, d)}`);
    if (pt.extra)
        parts.push(`${pt.extra} en plus`);
    if (!prep.done) {
        if (prep.slot !== at)
            return `Restes de ${prepTitle(s, prep)} (${prep.slot ? fmtSlot(prep.slot, today) : 'déjà préparé'}) · pas encore déclaré préparé`;
        return pt.planned === pt.serve ? `${pt.planned} portion${pt.planned > 1 ? 's' : ''}` : `Préparer ${pt.planned} portions : ${parts.join(', ')}`;
    }
    const res = pt.reservations.map(r => `${r.n} ${fmtSlot(r.slot, today)}`).join(', ');
    const free = pt.free ?? 0;
    return `${pt.declared} portion${(pt.declared ?? 0) > 1 ? 's' : ''} déclarée${(pt.declared ?? 0) > 1 ? 's' : ''}${pt.eaten ? ` · ${pt.eaten} mangée${pt.eaten > 1 ? 's' : ''}` : ''}${res ? ` · réservées : ${res}` : ''}${free > 0 ? ` · ${free} libre${free > 1 ? 's' : ''}` : free < 0 ? ` · il en manque ${-free}` : ''}`;
}
export function deriveToday(r, now) {
    const s = r.state;
    const { date: today, hour } = paris(now);
    const tomorrow = addDays(today, 1);
    // Les deux prochains repas où quelqu'un mange ou qui ont un plat.
    const cards = [];
    let k = slotKey(today, hour < 15 ? 'midi' : 'soir');
    for (let i = 0; i < 5 && cards.length < 2; i++) {
        const v = slotView(s, k, today, hour);
        if (v.servings > 0 || s.slots[k]?.dish) {
            const label = fmtSlot(k, today);
            const prep = v.prep;
            cards.push({ label: label.charAt(0).toUpperCase() + label.slice(1), view: v, detail: prep ? portionsDetail(s, prep, k, today) : null });
        }
        const p = parseSlot(k);
        if (!p)
            break;
        k = p.slot === 'midi' ? slotKey(p.date, 'soir') : slotKey(addDays(p.date, 1), 'midi');
    }
    // Tâches renseignées : « à faire la veille » / « le matin », et les boîtes à préparer.
    const tasks = [];
    // Plats cuisinés tel jour : le jour du repas, ou le jour du batch s'ils y sont prévus.
    const cookAt = (d) => Object.values(s.preps).filter(p => !p.done && p.slot && (p.batch ?? parseSlot(p.slot)?.date) === d)
        .map(p => ({ k: p.slot, d: { kind: 'cook', prep: p.id } }));
    const addAhead = (slotK, prepId, when, hint) => {
        const prep = s.preps[prepId];
        if (!prep || prep.done || s.slots[slotK]?.eaten)
            return;
        const rc = s.recipes[prep.recipe];
        if (!rc)
            return;
        current(rc).ahead.forEach((a, i) => {
            if (a.when !== when)
                return;
            const key = `ahead:${prepId}:${i}:${a.label}`;
            tasks.push({ key, text: a.label, done: !!s.tasks[key]?.done, hint: `${hint} · ${current(rc).name} ${prep.batch ? `· batch ${fmtRelDay(prep.batch, today)}` : fmtSlot(slotK, today)}` });
        });
    };
    for (const x of cookAt(tomorrow))
        if (x.d?.kind === 'cook')
            addAhead(x.k, x.d.prep, 'veille', "aujourd'hui pour demain");
    for (const x of cookAt(today))
        if (x.d?.kind === 'cook') {
            addAhead(x.k, x.d.prep, 'matin', 'ce matin');
            addAhead(x.k, x.d.prep, 'veille', 'prévu hier');
        }
    const boxSlots = [slotKey(tomorrow, 'midi'), ...(hour < 12 ? [slotKey(today, 'midi')] : [])];
    for (const bk of boxSlots) {
        const d = s.slots[bk]?.dish;
        if (!d || d.kind === 'outside' || s.slots[bk]?.eaten)
            continue;
        for (const e of eaters(s, bk).filter(x => x.presence === 'boite')) {
            const key = `box:${bk}:${e.id}`;
            tasks.push({ key, text: `Préparer la boîte de ${e.name}`, done: !!s.tasks[key]?.done, hint: `${prepTitle(s, s.preps[d.prep])} · ${fmtSlot(bk, today)}` });
        }
    }
    // Courses pas encore prises pour les repas d'aujourd'hui et demain.
    const soon = new Set([slotKey(today, 'midi'), slotKey(today, 'soir'), slotKey(tomorrow, 'midi'), slotKey(tomorrow, 'soir')].filter(x => isUpcoming(x, today, hour)));
    // Plat du batch d'aujourd'hui ou de demain : ses ingrédients sont nécessaires dès le batch, pas au repas.
    const batchSoon = new Map(Object.values(s.preps).filter(p => !p.done && p.batch && (p.batch === today || p.batch === tomorrow)).map(p => [p.id, p.batch]));
    const weeks = [...new Set([...soon].map(x => weekOf(parseSlot(x)?.date ?? today, s.settings.weekStart))
            .concat(Object.values(s.preps).filter(p => batchSoon.has(p.id) && p.slot).map(p => weekOf(parseSlot(p.slot)?.date ?? today, s.settings.weekStart))))];
    const byWhen = new Map();
    const put = (label, name) => { const set = byWhen.get(label) ?? new Set(); set.add(name); byWhen.set(label, set); };
    for (const w of weeks)
        for (const l of deriveShopping(s, w).lines) {
            if (l.done)
                continue;
            for (const src of l.sources) {
                if (s.preps[src.prep]?.done)
                    continue; // déjà préparé : ses ingrédients ont forcément été pris
                const b = batchSoon.get(src.prep);
                if (b)
                    put(`Batch ${b === today ? 'd\'aujourd\'hui' : 'de demain'}`, l.name);
                else if (soon.has(src.slot))
                    put(capitalFirst(fmtSlot(src.slot, today)), l.name);
            }
        }
    const toBuy = [...byWhen.entries()].map(([label, names]) => ({ label, names: [...names] }));
    // À vérifier : problèmes liés aux repas affichés, produits dont la DLC arrive, conflits de synchro.
    const shown = new Set(cards.map(c => c.view.key));
    const shownPreps = new Set(cards.map(c => c.view.prep?.id).filter(Boolean));
    const checks = problems(r, today, hour).filter(p => p.event || p.watch || (p.slot && (shown.has(p.slot) || soon.has(p.slot))) || (p.prep && shownPreps.has(p.prep)));
    // Ce qui reste à décider.
    const week = weekOf(today, s.settings.weekStart);
    let empty = 0;
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const x = slotKey(addDays(week, i), sl);
            if (isUpcoming(x, today, hour) && !s.slots[x]?.dish && servings(s, x) > 0)
                empty++;
        }
    const next = addDays(week, 7);
    const nextWeekEmpty = weekday(today) >= 4 && !Object.entries(s.slots).some(([x, v]) => v.dish && (parseSlot(x)?.date ?? '') >= next && (parseSlot(x)?.date ?? '') < addDays(next, 7));
    const first = cards[0];
    const near = new Set(Object.values(s.preps).filter(p => { const d = p.slot ? parseSlot(p.slot)?.date : undefined; return d && d >= addDays(today, -2) && d <= addDays(today, 6); }).map(p => p.recipe));
    const ideas = first && !first.view.prep && first.view.status === 'vide'
        ? { leftovers: leftovers(s, today), recipes: rank(s, first.view.key, today, near).slice(0, 3) }
        : null;
    return { date: today, hour, cards, tasks, toBuy, checks, empty, nextWeekEmpty, ideas, ritual: ritualNow(s, today) };
}
