// Rappels dans l'agenda du téléphone, sans serveur ni notification : un fichier .ics de la semaine.
// Heures locales « flottantes » (comme les rappels de Mes Comptes) ; identifiants stables pour qu'un nouvel import remplace l'ancien.
import { type LocalDate, type SlotKey, addDays, parseSlot, slotKey, SLOTS, fmtDayShort } from './dates.ts';
import { type State, current } from './model.ts';
import { eaters, portions } from './plan.ts';
import { prepTitle } from './status.ts';

const MEAL_TIME: Record<'midi' | 'soir', string> = { midi: '1230', soir: '1930' };
const esc = (t: string): string => t.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, '\\n');
const ymd = (d: LocalDate): string => d.replace(/-/g, '');

interface Item { uid: string; day: LocalDate; time: string; minutes: number; title: string; text: string; alarm: boolean }

export function weekItems(s: State, week: LocalDate, withMeals: boolean, from = ''): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k: SlotKey = slotKey(addDays(week, i), sl);
    const slot = s.slots[k];
    const d = slot?.dish;
    if (!d || slot?.eaten) continue;
    const day = parseSlot(k)?.date as LocalDate;
    if (d.kind === 'outside') { if (withMeals) out.push({ uid: `repas-${k}`, day, time: MEAL_TIME[sl], minutes: 60, title: `🍽️ ${d.note || 'Repas extérieur'}`, text: '', alarm: false }); continue; }
    const prep = s.preps[d.prep];
    if (!prep) continue;
    const name = prepTitle(s, prep);
    if (withMeals) {
      const chef = slot?.chef ? s.members.find(m => m.id === slot.chef)?.name : undefined;
      const n = d.kind === 'cook' ? portions(s, prep).planned : 0;
      out.push({ uid: `repas-${k}`, day, time: MEAL_TIME[sl], minutes: 60, title: `🍽️ ${d.kind === 'from' ? `Restes : ${name}` : name}`,
        text: [d.kind === 'cook' ? `${n} portion${n > 1 ? 's' : ''} à préparer` : '', chef ? `Cuisine : ${chef}` : ''].filter(Boolean).join(' · '), alarm: false });
    }
    if (d.kind === 'cook' && !prep.done) {
      const r = s.recipes[prep.recipe], cook = prep.batch ?? day;
      (r ? current(r).ahead : []).forEach((a, j) => out.push({
        uid: `tache-${prep.id}-${j}`, day: a.when === 'veille' ? addDays(cook, -1) : cook, time: a.when === 'veille' ? '1900' : '0800', minutes: 10,
        title: `⏰ ${a.label}`, text: `Pour ${name} (${prep.batch ? `batch du ${fmtDayShort(cook)}` : `${fmtDayShort(day)} ${sl}`})`, alarm: true }));
    }
    for (const e of eaters(s, k).filter(x => x.presence === 'boite')) {
      out.push({ uid: `boite-${k}-${e.id}`, day: sl === 'midi' ? addDays(day, -1) : day, time: sl === 'midi' ? '2100' : '1700', minutes: 10,
        title: `🥡 Boîte de ${e.name}`, text: `${name} pour ${fmtDayShort(day)} ${sl}`, alarm: true });
    }
  }
  return out.filter(x => x.day >= from).sort((a, b) => (a.day + a.time < b.day + b.time ? -1 : 1)); // rien dans le passé
}

export function weekIcs(s: State, week: LocalDate, withMeals: boolean, now: Date, url: string, from = ''): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = weekItems(s, week, withMeals, from).map(x => [
    'BEGIN:VEVENT', `UID:foyer-${x.uid}@foyer`, `DTSTAMP:${stamp}`, `DTSTART:${ymd(x.day)}T${x.time}00`, `DURATION:PT${x.minutes}M`,
    `SUMMARY:${esc(x.title)}`, `DESCRIPTION:${esc(x.text ? `${x.text}\n${url}` : url)}`, `URL:${url}`,
    ...(x.alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${esc(x.title)}`, 'END:VALARM'] : []),
    'END:VEVENT'].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Foyer//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Foyer', ...ev, 'END:VCALENDAR', ''].join('\r\n');
}
