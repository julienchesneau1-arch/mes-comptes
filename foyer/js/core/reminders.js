// Rappels sur le téléphone : les mêmes que l'agenda (.ics) — tâches de la veille ou du matin, boîtes à préparer —
// plus « la semaine prochaine est vide » le dimanche à 18 h. Heures de Paris converties en instants exacts.
import { addDays, paris, parisToUtc, weekOf, slotKey, SLOTS } from './dates.js';
import { weekItems } from './ics.js';
import { servings } from './plan.js';
import { batchView, nextWeekday } from './batch.js';
import { deriveShopping } from './shopping.js';
// Identifiant stable : un rappel inchangé garde le sien (pas de doublon) ; modifié, il en change.
const fnv = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
export const reminderId = (uid, at, title, body) => { const k = `${uid}|${at}|${title}|${body}`; return fnv(k, 2166136261) + fnv(k, 0x1b873593); };
export function remindersFor(s, now, days = 8) {
    const week = weekOf(paris(now).date, s.settings.weekStart), next = addDays(week, 7);
    const raw = [...weekItems(s, week, false), ...weekItems(s, next, false)].filter(x => x.alarm)
        .map(x => ({ uid: x.uid, at: parisToUtc(x.day, x.time).toISOString(), title: x.title, body: x.text }));
    const r = s.settings.ritual;
    if (r) {
        for (const day of [nextWeekday(paris(now).date, r.cook), addDays(nextWeekday(paris(now).date, r.cook), 7)]) {
            const v = batchView(s, day);
            if (v.shopDay) {
                const empty = !v.dishes.length && !v.candidates.length;
                const left = empty ? 0 : deriveShopping(s, v.week).remaining;
                raw.push(empty
                    ? { uid: `rituel-menu-${day}`, at: parisToUtc(v.shopDay, r.shopAt).toISOString(), title: '🗓️ Menu à choisir avant les courses', body: 'Proposer le menu en un geste, puis commander au drive' }
                    : { uid: `rituel-courses-${day}`, at: parisToUtc(v.shopDay, r.shopAt).toISOString(), title: '🛒 Courses du batch à commander', body: left ? `${left} article${left > 1 ? 's' : ''} sur la liste · commander au drive depuis Foyer` : 'La liste est déjà traitée' });
            }
            if (v.dishes.length)
                raw.push({ uid: `rituel-batch-${day}`, at: parisToUtc(day, r.cookAt).toISOString(), title: '👩‍🍳 Batch cooking aujourd\'hui',
                    body: `${v.dishes.length} plat${v.dishes.length > 1 ? 's' : ''} · ${v.portions} portion${v.portions > 1 ? 's' : ''} · la mise en place est prête dans Foyer` });
        }
    }
    // Veille de chaque semaine à venir (le dimanche, la « prochaine » peut commencer dès demain) : vide alors qu'on mange à la maison.
    // Avec un rituel, le rappel du jour des courses le remplace.
    for (const start of r ? [] : [next, addDays(next, 7)]) {
        const ds = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        if (ds.every(d => SLOTS.every(sl => !s.slots[slotKey(d, sl)]?.dish)) && ds.some(d => SLOTS.some(sl => servings(s, slotKey(d, sl)) > 0)))
            raw.push({ uid: `semaine-${start}`, at: parisToUtc(addDays(start, -1), '1800').toISOString(), title: '🗓️ La semaine prochaine est vide', body: 'Proposer les repas en un geste dans Foyer' });
    }
    const from = now.getTime(), to = from + days * 864e5;
    return raw.filter(r => Date.parse(r.at) > from && Date.parse(r.at) <= to)
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.uid < b.uid ? -1 : 1))
        .map(r => ({ rid: reminderId(r.uid, r.at, r.title, r.body), at: r.at, title: r.title.slice(0, 120), body: r.body.slice(0, 200) }));
}
