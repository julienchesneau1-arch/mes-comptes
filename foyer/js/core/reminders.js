// Rappels sur le téléphone : les mêmes que l'agenda (.ics) — tâches de la veille ou du matin, boîtes à préparer —
// plus « la semaine prochaine est vide » le dimanche à 18 h. Heures de Paris converties en instants exacts.
import { addDays, paris, parisToUtc, weekOf, slotKey, SLOTS } from './dates.js';
import { weekItems } from './ics.js';
import { servings } from './plan.js';
// Identifiant stable : un rappel inchangé garde le sien (pas de doublon) ; modifié, il en change.
const fnv = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
export const reminderId = (uid, at, title, body) => { const k = `${uid}|${at}|${title}|${body}`; return fnv(k, 2166136261) + fnv(k, 0x1b873593); };
export function remindersFor(s, now, days = 8) {
    const week = weekOf(paris(now).date, s.settings.weekStart), next = addDays(week, 7);
    const raw = [...weekItems(s, week, false), ...weekItems(s, next, false)].filter(x => x.alarm)
        .map(x => ({ uid: x.uid, at: parisToUtc(x.day, x.time).toISOString(), title: x.title, body: x.text }));
    // Veille de chaque semaine à venir (le dimanche, la « prochaine » peut commencer dès demain) : vide alors qu'on mange à la maison.
    for (const start of [next, addDays(next, 7)]) {
        const ds = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        if (ds.every(d => SLOTS.every(sl => !s.slots[slotKey(d, sl)]?.dish)) && ds.some(d => SLOTS.some(sl => servings(s, slotKey(d, sl)) > 0)))
            raw.push({ uid: `semaine-${start}`, at: parisToUtc(addDays(start, -1), '1800').toISOString(), title: '🗓️ La semaine prochaine est vide', body: 'Proposer les repas en un geste dans Foyer' });
    }
    const from = now.getTime(), to = from + days * 864e5;
    return raw.filter(r => Date.parse(r.at) > from && Date.parse(r.at) <= to)
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.uid < b.uid ? -1 : 1))
        .map(r => ({ rid: reminderId(r.uid, r.at, r.title, r.body), at: r.at, title: r.title.slice(0, 120), body: r.body.slice(0, 200) }));
}
