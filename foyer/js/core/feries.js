// Jours fériés en France métropolitaine (Code du travail, art. L3133-1) : dates fixes et fêtes mobiles tirées de Pâques.
// Alsace-Moselle (Vendredi saint, 26 décembre) non comptés. Servent l'agenda : un férié en semaine = midi à la maison, à confirmer.
import { addDays, parisToUtc } from './dates.js';
import { hash16 } from './ical.js';
// Dimanche de Pâques (calendrier grégorien, algorithme de Meeus / Jones / Butcher).
export function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function holidays(y) {
    const p = easter(y);
    return [
        { date: `${y}-01-01`, name: 'Jour de l\'an' }, { date: addDays(p, 1), name: 'Lundi de Pâques' }, { date: `${y}-05-01`, name: 'Fête du Travail' },
        { date: `${y}-05-08`, name: 'Victoire 1945' }, { date: addDays(p, 39), name: 'Ascension' }, { date: addDays(p, 50), name: 'Lundi de Pentecôte' },
        { date: `${y}-07-14`, name: 'Fête nationale' }, { date: `${y}-08-15`, name: 'Assomption' }, { date: `${y}-11-01`, name: 'Toussaint' },
        { date: `${y}-11-11`, name: 'Armistice' }, { date: `${y}-12-25`, name: 'Noël' },
    ];
}
// Fériés de la période, au format des occurrences d'agenda (journée entière, « disponible »).
export function holidayOccurrences(from, to) {
    const out = [];
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
        for (const h of holidays(y)) {
            if (h.date < from || h.date > to)
                continue;
            const next = addDays(h.date, 1);
            out.push({ id: hash16(`feries|${h.date}`), title: `Jour férié (${h.name})`, allDay: true, start: parisToUtc(h.date, '0000').getTime(), end: parisToUtc(next, '0000').getTime(),
                days: [h.date, next], busy: false, recurring: false, tzGuess: false });
        }
    }
    return out.sort((a, b) => a.start - b.start);
}
