// Dates de calendrier en heure de Paris, calculées sans dépendre du fuseau de l'appareil.
// Un jour = une chaîne « AAAA-MM-JJ » ; l'arithmétique se fait sur des jours entiers (pas de piège au changement d'heure).
export const SLOTS = ['midi', 'soir'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
    && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function paris(now) {
    const p = Object.fromEntries(PARTS.formatToParts(now).map(x => [x.type, x.value]));
    return { date: `${p['year']}-${p['month']}-${p['day']}`, hour: Number(p['hour']), minute: Number(p['minute']) };
}
// Heure de Paris (« 1900 » tel jour) → instant exact, changements d'heure compris : on corrige jusqu'à retomber sur l'heure voulue.
export function parisToUtc(d, hhmm) {
    const want = Date.parse(`${d}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
    let t = want;
    for (let i = 0; i < 3; i++) {
        const p = paris(new Date(t));
        t += want - Date.parse(`${p.date}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:00Z`);
    }
    return new Date(t);
}
const dayNum = (d) => Date.parse(`${d}T00:00:00Z`) / 864e5;
export const addDays = (d, n) => new Date((dayNum(d) + n) * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round(dayNum(b) - dayNum(a));
export const weekday = (d) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
export const weekOf = (d, weekStart) => addDays(d, -((weekday(d) - weekStart + 7) % 7));
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export const slotKey = (date, slot) => `${date}|${slot}`;
export function parseSlot(k) {
    const [date, slot] = k.split('|');
    return isDate(date) && (slot === 'midi' || slot === 'soir') ? { date, slot } : null;
}
export const isSlotKey = (k) => typeof k === 'string' && parseSlot(k) !== null;
// Ordre total des créneaux : lundi midi < lundi soir < mardi midi.
export const slotOrder = (k) => { const p = parseSlot(k); return p ? dayNum(p.date) * 2 + (p.slot === 'soir' ? 1 : 0) : Number.NaN; };
export const prevSlot = (k) => { const p = parseSlot(k); if (!p)
    return k; return p.slot === 'soir' ? slotKey(p.date, 'midi') : slotKey(addDays(p.date, -1), 'soir'); };
export const nextSlot = (k) => { const p = parseSlot(k); if (!p)
    return k; return p.slot === 'midi' ? slotKey(p.date, 'soir') : slotKey(addDays(p.date, 1), 'midi'); };
// Libellés français fixes (pas d'Intl : même rendu sur tous les téléphones et dans les tests).
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const dayName = (d) => DAYS[weekday(d)] ?? '';
export const dayShort = (d) => DAYS_SHORT[weekday(d)] ?? '';
export const dayNumber = (d) => Number(d.slice(8, 10));
export const monthName = (m) => MONTHS[m - 1] ?? '';
export const fmtDay = (d) => `${dayName(d)} ${dayNumber(d)} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''}`; // « lundi 5 octobre »
export const fmtDayShort = (d) => `${dayShort(d)} ${dayNumber(d)} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1] ?? ''}`; // « lun. 5 oct. »
// « ce soir », « demain midi », « jeudi soir », « lun. 12 oct. midi » : relatif quand c'est proche.
export function fmtSlot(k, today) {
    const p = parseSlot(k);
    if (!p)
        return k;
    const delta = daysBetween(today, p.date);
    const s = p.slot;
    if (delta === 0)
        return s === 'midi' ? 'ce midi' : 'ce soir';
    if (delta === 1)
        return `demain ${s}`;
    if (delta === -1)
        return `hier ${s}`;
    if (delta > 1 && delta < 7)
        return `${dayName(p.date)} ${s}`;
    return `${fmtDayShort(p.date)} ${s}`;
}
export function fmtRelDay(d, today) {
    const delta = daysBetween(today, d);
    if (delta === 0)
        return "aujourd'hui";
    if (delta === 1)
        return 'demain';
    if (delta === -1)
        return 'hier';
    if (delta > 1 && delta < 7)
        return dayName(d);
    return fmtDayShort(d);
}
