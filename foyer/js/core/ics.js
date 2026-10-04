// Rappels dans l'agenda du téléphone, sans serveur ni notification : un fichier .ics de la semaine.
// Heures locales « flottantes » (comme les rappels de Mes Comptes) ; identifiants stables pour qu'un nouvel import remplace l'ancien.
import { addDays, parseSlot, slotKey, SLOTS, fmtDayShort } from './dates.js';
import { current } from './model.js';
import { eaters, portions } from './plan.js';
import { prepTitle } from './status.js';
const MEAL_TIME = { midi: '1230', soir: '1930' };
const esc = (t) => t.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, '\\n');
const ymd = (d) => d.replace(/-/g, '');
export function weekItems(s, week, withMeals, from = '') {
    const out = [];
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(week, i), sl);
            const slot = s.slots[k];
            const d = slot?.dish;
            if (!d || slot?.eaten)
                continue;
            const day = parseSlot(k)?.date;
            if (d.kind === 'outside') {
                if (withMeals)
                    out.push({ uid: `repas-${k}`, day, time: MEAL_TIME[sl], minutes: 60, title: `🍽️ ${d.note || 'Repas extérieur'}`, text: '', alarm: false });
                continue;
            }
            const prep = s.preps[d.prep];
            if (!prep)
                continue;
            const name = prepTitle(s, prep);
            if (withMeals) {
                const chef = slot?.chef ? s.members.find(m => m.id === slot.chef)?.name : undefined;
                const n = d.kind === 'cook' ? portions(s, prep).planned : 0;
                out.push({ uid: `repas-${k}`, day, time: MEAL_TIME[sl], minutes: 60, title: `🍽️ ${d.kind === 'from' ? `Restes : ${name}` : name}`,
                    text: [d.kind === 'cook' ? `${n} portion${n > 1 ? 's' : ''} à préparer` : '', chef ? `Cuisine : ${chef}` : ''].filter(Boolean).join(' · '), alarm: false });
            }
            if (d.kind === 'cook' && !prep.done) {
                const r = s.recipes[prep.recipe];
                (r ? current(r).ahead : []).forEach((a, j) => out.push({
                    uid: `tache-${prep.id}-${j}`, day: a.when === 'veille' ? addDays(day, -1) : day, time: a.when === 'veille' ? '1900' : '0800', minutes: 10,
                    title: `⏰ ${a.label}`, text: `Pour ${name} (${fmtDayShort(day)} ${sl})`, alarm: true
                }));
            }
            for (const e of eaters(s, k).filter(x => x.presence === 'boite')) {
                out.push({ uid: `boite-${k}-${e.id}`, day: sl === 'midi' ? addDays(day, -1) : day, time: sl === 'midi' ? '2100' : '1700', minutes: 10,
                    title: `🥡 Boîte de ${e.name}`, text: `${name} pour ${fmtDayShort(day)} ${sl}`, alarm: true });
            }
        }
    return out.filter(x => x.day >= from).sort((a, b) => (a.day + a.time < b.day + b.time ? -1 : 1)); // rien dans le passé
}
export function weekIcs(s, week, withMeals, now, url, from = '') {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ev = weekItems(s, week, withMeals, from).map(x => [
        'BEGIN:VEVENT', `UID:foyer-${x.uid}@foyer`, `DTSTAMP:${stamp}`, `DTSTART:${ymd(x.day)}T${x.time}00`, `DURATION:PT${x.minutes}M`,
        `SUMMARY:${esc(x.title)}`, `DESCRIPTION:${esc(x.text ? `${x.text}\n${url}` : url)}`, `URL:${url}`,
        ...(x.alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${esc(x.title)}`, 'END:VALARM'] : []),
        'END:VEVENT'
    ].join('\r\n'));
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Foyer//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Foyer', ...ev, 'END:VCALENDAR', ''].join('\r\n');
}
