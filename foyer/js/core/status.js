// État lisible d'un créneau et problèmes à résoudre, déduits du planning déclaré. Aucun repas n'est confirmé parce que le temps passe.
import { parseSlot, slotOrder, fmtSlot } from './dates.js';
import { current } from './model.js';
import { portions, servings, eaters, dependents } from './plan.js';
import { openConflicts } from './reduce.js';
import { activeWatch } from './watch.js';
import { describe } from './describe.js';
export const STATUS_LABEL = {
    personne: 'Personne à la maison', vide: 'Rien de prévu', exterieur: 'Repas extérieur', 'a-cuisiner': 'À cuisiner', commence: 'Préparation commencée',
    pret: 'Préparé', attend: 'Restes à venir', mange: 'Mangé', passe: 'Passé (pas noté mangé)', probleme: 'À résoudre',
};
// Un créneau est passé le lendemain, ou le jour même après 15 h pour le midi. Il reste « non confirmé », sans relance.
export function isPast(k, today, hour) {
    const p = parseSlot(k);
    if (!p)
        return false;
    return p.date < today || (p.date === today && p.slot === 'midi' && hour >= 15);
}
export function prepTitle(s, prep) {
    if (!prep)
        return 'Plat retiré';
    const r = s.recipes[prep.recipe];
    return r ? current(r).name : 'Plat retiré';
}
export function slotView(s, k, today, hour) {
    const slot = s.slots[k];
    const n = servings(s, k);
    const past = isPast(k, today, hour);
    const base = { key: k, status: n ? 'vide' : 'personne', servings: n, title: '', sub: '', prep: null, recipe: null, incomplete: false, link: null, past };
    const people = eaters(s, k).filter(e => e.presence !== 'dehors').map(e => (e.presence === 'boite' ? `${e.name} (boîte)` : e.name));
    const guests = slot?.guests ? `${slot.guests} invité${slot.guests > 1 ? 's' : ''}` : '';
    const chef = slot?.chef ? s.members.find(m => m.id === slot.chef)?.name : undefined;
    base.sub = [...people, guests, chef ? `cuisine : ${chef}` : ''].filter(Boolean).join(' · ');
    const d = slot?.dish;
    if (!d)
        return base;
    if (d.kind === 'outside')
        return { ...base, status: 'exterieur', title: d.note || 'Repas extérieur' };
    const prep = s.preps[d.prep] ?? null;
    base.prep = prep;
    base.title = prepTitle(s, prep);
    if (!prep)
        return { ...base, status: 'probleme', link: 'Le plat d\'origine a été retiré' };
    const r = s.recipes[prep.recipe];
    base.recipe = prep.recipe;
    base.incomplete = !!r && !current(r).ingredients.length;
    if (d.kind === 'from') {
        base.link = prep.slot ? `Restes de ${fmtSlot(prep.slot, today)}` : 'Portions déjà préparées';
        if (!prep.done && prep.slot && slotOrder(k) < slotOrder(prep.slot))
            return { ...base, status: 'probleme' };
    }
    else {
        const deps = dependents(s, prep.id);
        const pt = portions(s, prep);
        if (deps.length || pt.extra)
            base.link = `Aussi : ${[...deps.map(x => `${servings(s, x)} pour ${fmtSlot(x, today)}`), pt.extra ? `${pt.extra} en plus` : ''].filter(Boolean).join(', ')}`;
    }
    if (slot?.eaten)
        return { ...base, status: 'mange' };
    if (past)
        return { ...base, status: 'passe' };
    if (d.kind === 'from')
        return { ...base, status: prep.done ? 'pret' : 'attend' };
    return { ...base, status: prep.status === 'done' ? 'pret' : prep.status === 'started' ? 'commence' : 'a-cuisiner' };
}
export function problems(r, today, hour) {
    const s = r.state;
    const out = [];
    for (const [k, slot] of Object.entries(s.slots)) {
        const d = slot.dish;
        if (!d || d.kind !== 'from' || slot.eaten)
            continue;
        const prep = s.preps[d.prep];
        if (isPast(k, today, hour))
            continue;
        if (!prep)
            out.push({ key: `src-missing:${k}`, level: 'conflit', slot: k, text: `${capital(fmtSlot(k, today))} : le plat dont viennent ces restes a été retiré. Choisissez un autre repas.` });
        else if (!prep.done && prep.slot && slotOrder(k) < slotOrder(prep.slot))
            out.push({ key: `src-future:${k}`, level: 'conflit', slot: k, prep: prep.id, text: `${capital(fmtSlot(k, today))} dépend de ${prepTitle(s, prep)}, prévu plus tard (${fmtSlot(prep.slot, today)}).` });
    }
    for (const prep of Object.values(s.preps)) {
        const pt = portions(s, prep);
        if (pt.free !== null && pt.free < 0) {
            const future = pt.reservations.filter(x => !isPast(x.slot, today, hour));
            if (!future.length)
                continue;
            out.push({ key: `missing:${prep.id}`, level: 'conflit', prep: prep.id, slot: future[0]?.slot,
                text: `Il manque ${-pt.free} portion${pt.free < -1 ? 's' : ''} de ${prepTitle(s, prep)} pour ${future.map(x => fmtSlot(x.slot, today)).join(', ')}. Quel repas modifier ?` });
        }
    }
    for (const v of activeWatch(s.watch, today)) {
        for (const c of v.checks)
            if (c.level === 'conflit')
                out.push({ key: `watch:${v.item.id}:${c.text}`, level: 'conflit', watch: v.item.id, text: `${v.item.name} : ${c.text}` });
        for (const c of v.checks)
            if (c.level === 'attention')
                out.push({ key: `watch:${v.item.id}:${c.text}`, level: 'attention', watch: v.item.id, text: `${v.item.name} : ${c.text}` });
    }
    for (const c of openConflicts(r)) {
        const who = s.members.find(m => m.id === c.by)?.name ?? 'Un téléphone';
        out.push({ key: `ev:${c.id}`, level: 'conflit', event: c.id, text: `${who} voulait ${describe(r, c.id)} — non appliqué : ${c.reason}.` });
    }
    return out;
}
export const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
