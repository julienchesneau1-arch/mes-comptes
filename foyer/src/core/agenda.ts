// Agenda → repas. Règles fixes, lisibles, sans IA : un événement qui tombe à l'heure d'un repas (ou qui le dit dans son
// titre) change la présence de la personne dont c'est l'agenda. Rien n'est fait sans une première décision du foyer
// (« appliquer », avec « pareil les prochaines fois »), puis les mêmes événements sont appliqués seuls. Un événement qui
// disparaît ou se déplace : la présence posée d'après lui est retirée. Un réglage fait à la main l'emporte toujours.
import { type LocalDate, type SlotKey, type SlotName, SLOTS, addDays, paris, parisToUtc, slotKey, parseSlot, nextSlot, fmtDayShort, daysBetween } from './dates.ts';
import type { MemberId, Presence, State } from './model.ts';
import type { Draft } from './reduce.ts';
import { type Occurrence, hash16 } from './ical.ts';
import { presence, dependents } from './plan.ts';
import { norm } from './text.ts';

export interface Feed { cal: string; member: MemberId | null; label: string; occurrences: readonly Occurrence[] }
export type AgendaKind = 'dehors' | 'maison' | 'invites' | 'deplacer';
export interface Move { from: SlotKey; to: SlotKey; dish: string }
export interface AgendaChange {
  occ: string; cal: string; label: string; title: string; when: string;
  kind: AgendaKind; sure: boolean;   // sure = le titre le dit (« resto », « télétravail »…) ; sinon : seulement occupé à l'heure du repas
  who: MemberId[]; slots: SlotKey[];
  drafts: Draft[];                   // présences à poser (vide pour « invités » : le nombre est demandé)
  moves: Move[];                     // plats décalés parce que plus personne ne les mange
  rule: string;                      // clé de la décision « pareil les prochaines fois » (titre de l'événement)
  auto: boolean;                     // décision déjà prise : appliqué sans demander
  manual: boolean;                   // contredit un réglage fait à la main : jamais automatique
}
export interface Revert { drafts: Draft[]; text: string }
export interface AgendaPlan { changes: AgendaChange[]; reverts: Revert[] }

// Mots-clés (sans accents, en minuscules). L'ordre compte : « dîner à la maison » = invités, pas « dîner dehors ».
const INVITES = /\b(on recoit|recevoir|invites?|chez nous|a la maison|a la maison)\b/;
const MAISON = /\b(teletravail|tele travail|tt|ferie|rtt|repos|conges?|jour off|day off|remote|malade|maladie|arret maladie)\b/;
const LOIN = /\b(vacances|voyage|deplacement|seminaire|mission|salon|congres|week ?end|weekend|formation|hopital|hospitalisation|colo|sejour)\b/;
const REPAS = /\b(restau?|resto|restaurant|dejeuner|dej|diner|brunch|apero|aperitif|barbecue|bbq|pique nique|picnic|buffet|cocktail|soiree|fete|anniv|anniversaire|mariage|bapteme|afterwork|after work|pot|repas|raclette|fondue|pizza|cantine|self)\b/;

// Heures des repas (Paris) : un événement occupé pendant au moins la moitié du créneau compte ; s'il parle de repas, dès qu'il le touche.
export const MEAL_WINDOW: Record<SlotName, [string, string]> = { midi: ['1200', '1400'], soir: ['1900', '2130'] };

// Même décision pour « Foot » et « Foot (décalé) », « Jour férié (Toussaint) » et « Jour férié (Noël) ».
export const ruleKey = (title: string): string => `t:${norm(title).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 110)}`;
export const onceKey = (occ: string): string => `o:${occ}`;

export function classify(o: Occurrence): { kind: AgendaKind; sure: boolean; any: boolean } | null {
  const t = norm(o.title).replace(/[^a-z0-9]+/g, ' ');
  if (o.allDay) { // journées entières : seulement si le titre dit absence ou journée à la maison (« Anniversaire de Léa » ne change rien)
    if (MAISON.test(t)) return { kind: 'maison', sure: true, any: true };
    if (LOIN.test(t)) return { kind: 'dehors', sure: true, any: true };
    return null;
  }
  if (INVITES.test(t)) return { kind: 'invites', sure: true, any: true };
  if (MAISON.test(t)) return { kind: 'maison', sure: true, any: true };
  if (REPAS.test(t)) return { kind: 'dehors', sure: true, any: true };
  if (LOIN.test(t)) return { kind: 'dehors', sure: true, any: false };
  if (o.busy) return { kind: 'dehors', sure: false, any: false };
  return null;
}

// Créneaux de repas touchés par une occurrence, entre `first` (exclu s'il a commencé) et `last`.
export function mealSlots(o: Occurrence, any: boolean, now: Date, last: LocalDate): SlotKey[] {
  const out: SlotKey[] = [];
  const d0 = o.days ? o.days[0] : paris(new Date(o.start)).date;
  const d1 = o.days ? addDays(o.days[1], -1) : paris(new Date(Math.max(o.start, o.end - 1))).date;
  for (let d = d0, i = 0; d <= d1 && d <= last && i < 62; d = addDays(d, 1), i++) {
    for (const sl of SLOTS) {
      const ws = parisToUtc(d, MEAL_WINDOW[sl][0]).getTime(), we = parisToUtc(d, MEAL_WINDOW[sl][1]).getTime();
      if (ws <= now.getTime()) continue; // repas commencé ou passé : jamais touché
      const overlap = o.days ? we - ws : Math.min(o.end, we) - Math.max(o.start, ws);
      if (any ? overlap > 0 : overlap * 2 >= we - ws) out.push(slotKey(d, sl));
    }
  }
  return out;
}

const hhmm = (ms: number): string => { const p = paris(new Date(ms)); return `${p.hour}h${String(p.minute).padStart(2, '0')}`; };
export function whenText(o: Occurrence): string {
  if (o.days) {
    const last = addDays(o.days[1], -1);
    return o.days[0] === last ? `${fmtDayShort(o.days[0])} (journée)` : `du ${fmtDayShort(o.days[0])} au ${fmtDayShort(last)}`;
  }
  const a = paris(new Date(o.start)).date, b = paris(new Date(Math.max(o.start, o.end - 1))).date;
  return a === b ? `${fmtDayShort(a)} ${hhmm(o.start)}–${hhmm(o.end)}` : `du ${fmtDayShort(a)} ${hhmm(o.start)} au ${fmtDayShort(b)} ${hhmm(o.end)}`;
}

const dishName = (s: State, k: SlotKey): string => {
  const d = s.slots[k]?.dish;
  if (d?.kind !== 'cook') return '';
  const r = s.recipes[s.preps[d.prep]?.recipe ?? ''];
  return r ? (r.versions[r.versions.length - 1]?.name ?? 'le plat') : 'le plat';
};

// Plan : ce que l'agenda change (à proposer ou à appliquer seul) et ce qu'il faut défaire. `days` : horizon (un mois).
export function planAgenda(s: State, feeds: readonly Feed[], now: Date, days = 31): AgendaPlan {
  const today = paris(now).date, last = addDays(today, days);
  const fresh = new Set(feeds.map(f => f.cal));
  const members = s.members.map(m => m.id);
  const wanted = new Set<string>();   // occurrence|créneau|personne encore justifiés par l'agenda
  const changes: AgendaChange[] = [];
  // 1. Candidats : chaque occurrence comprise × créneaux touchés × personnes concernées.
  interface Cand { ch: AgendaChange; k: SlotKey; m: MemberId; want: Presence; rank: number; start: number }
  const best = new Map<string, Cand>();   // un seul gagnant par repas et par personne (sinon deux événements se renverraient la balle)
  for (const f of feeds) {
    const who = f.member && members.includes(f.member) ? [f.member] : members;
    for (const o of f.occurrences) {
      const c = classify(o);
      if (!c) continue;
      const rule = ruleKey(o.title);
      if (s.agenda.rules[rule] === 'jamais' || s.agenda.rules[onceKey(o.id)] === 'jamais') continue;
      let slots = mealSlots(o, c.any, now, last);
      if (c.kind === 'maison') slots = slots.filter(k => parseSlot(k)?.slot === 'midi');
      if (!slots.length) continue;
      const ch: AgendaChange = { occ: o.id, cal: f.cal, label: f.label, title: o.title, when: whenText(o), kind: c.kind, sure: c.sure,
        who: [], slots: [], drafts: [], moves: [], rule, auto: false, manual: false };
      if (c.kind === 'invites') {
        ch.slots = slots.filter(k => !s.slots[k]?.guests && !s.slots[k]?.eaten);
        if (ch.slots.length) { ch.who = who; changes.push(ch); }
        continue;
      }
      const want: Presence = c.kind === 'maison' ? 'maison' : 'dehors';
      const rank = c.kind === 'maison' ? 2 : c.sure ? 3 : 1; // repas dehors annoncé > journée à la maison > simplement occupé
      for (const k of slots) for (const m of who) {
        if (c.kind === 'maison' && presence(s, k, m) === 'maison' && !s.agenda.marks[`${k}|${m}`]) continue;
        wanted.add(`${o.id}|${k}|${m}`);
        const cand: Cand = { ch, k, m, want, rank, start: o.start };
        const prev = best.get(`${k}|${m}`);
        if (!prev || rank > prev.rank || (rank === prev.rank && (o.start < prev.start || (o.start === prev.start && o.id < prev.ch.occ)))) best.set(`${k}|${m}`, cand);
      }
      changes.push(ch);
    }
  }
  // 2. Ce que chaque occurrence gagnante change vraiment.
  for (const { ch, k, m, want } of best.values()) {
    const mark = s.agenda.marks[`${k}|${m}`];
    if (mark?.src === ch.occ && mark.overridden) continue; // corrigé à la main pour cet événement
    if (presence(s, k, m) === want || s.slots[k]?.eaten) continue;
    if (s.slots[k]?.presence[m] !== undefined && !mark) ch.manual = true;
    ch.drafts.push({ t: 'agenda.mark', p: { slot: k, member: m, presence: want, src: ch.occ, cal: ch.cal, title: ch.title } });
    if (!ch.slots.includes(k)) ch.slots.push(k);
    if (!ch.who.includes(m)) ch.who.push(m);
  }
  const kept = changes.filter(ch => ch.kind === 'invites' || ch.drafts.length);
  for (const ch of kept) {
    ch.slots.sort(); ch.drafts.sort((a, b) => (a.t === 'agenda.mark' && b.t === 'agenda.mark' ? (a.p.slot < b.p.slot ? -1 : a.p.slot > b.p.slot ? 1 : 0) : 0));
    ch.auto = ch.kind !== 'invites' && s.agenda.rules[ch.rule] === 'auto' && !ch.manual;
  }

  // 3. Plat prévu que plus personne ne mangerait : décalé au prochain repas à la maison sans plat, dans les 6 jours.
  const taken = new Set<SlotKey>();
  const eaters = (k: SlotKey, own: Map<string, Presence>): number =>
    (s.slots[k]?.guests ?? 0) + members.filter(m => (own.get(`${k}|${m}`) ?? presence(s, k, m)) !== 'dehors').length;
  const moveFor = (k: SlotKey, own: Map<string, Presence>): Move | null => {
    const d = s.slots[k]?.dish;
    if (d?.kind !== 'cook' || s.slots[k]?.eaten || eaters(k, own) > 0) return null;
    const prep = s.preps[d.prep];
    if (!prep || prep.status !== 'planned' || dependents(s, prep.id).length) return null;
    let t = nextSlot(k);
    for (let i = 0; i < 12; i++, t = nextSlot(t)) {
      const p = parseSlot(t);
      if (!p || daysBetween(today, p.date) > days) break;
      if (!s.slots[t]?.dish && !s.slots[t]?.eaten && !taken.has(t) && eaters(t, own) > 0) { taken.add(t); return { from: k, to: t, dish: dishName(s, k) }; }
    }
    return null;
  };
  for (const ch of kept) {
    if (ch.kind === 'invites') continue;
    const own = new Map(ch.drafts.flatMap(d => (d.t === 'agenda.mark' && d.p.presence ? [[`${d.p.slot}|${d.p.member}`, d.p.presence] as const] : [])));
    for (const k of ch.slots) { const mv = moveFor(k, own); if (mv) { ch.moves.push(mv); ch.drafts.push({ t: 'slot.move', p: { from: mv.from, to: mv.to, swap: false } }); } }
  }
  // Repas déjà vidé par l'agenda (plusieurs événements appliqués l'un après l'autre) : le plat suit, sans demander.
  const marked = new Set(Object.entries(s.agenda.marks).filter(([, mk]) => !mk.overridden && mk.presence === 'dehors').map(([key]) => key.slice(0, key.lastIndexOf('|'))));
  for (const k of [...marked].sort()) {
    const p = parseSlot(k);
    if (!p || p.date > last || parisToUtc(p.date, MEAL_WINDOW[p.slot][0]).getTime() <= now.getTime() || kept.some(ch => ch.slots.includes(k))) continue;
    const mv = moveFor(k, new Map());
    if (!mv) continue;
    kept.push({ occ: hash16(`deplacer|${k}`), cal: '', label: '', title: mv.dish, when: `${fmtDayShort(p.date)} ${p.slot}`, kind: 'deplacer', sure: true,
      who: [], slots: [k], drafts: [{ t: 'slot.move', p: { from: mv.from, to: mv.to, swap: false } }], moves: [mv], rule: '', auto: true, manual: false });
  }

  // 4. Présences posées d'après l'agenda que plus rien ne justifie (événement supprimé, déplacé, ou « jamais » décidé depuis).
  const reverts: Revert[] = [];
  for (const [key, mark] of Object.entries(s.agenda.marks)) {
    const k = key.slice(0, key.lastIndexOf('|')), m = key.slice(key.lastIndexOf('|') + 1);
    const p = parseSlot(k);
    if (!p || mark.overridden || !fresh.has(mark.cal) || p.date > last || s.slots[k]?.eaten) continue;
    if (parisToUtc(p.date, MEAL_WINDOW[p.slot][0]).getTime() <= now.getTime() || wanted.has(`${mark.src}|${k}|${m}`)) continue;
    const name = s.members.find(x => x.id === m)?.name ?? 'quelqu\'un';
    reverts.push({ drafts: [{ t: 'agenda.mark', p: { slot: k, member: m, presence: null, src: mark.src, cal: mark.cal, title: mark.title } }],
      text: `« ${mark.title} » n'est plus dans l'agenda : ${name} comme d'habitude ${fmtDayShort(p.date)} ${p.slot}` });
  }
  return { changes: kept, reverts };
}

// Phrase d'un changement : « Alex absent·e mar. 6 oct. soir · Curry décalé à mer. 7 oct. soir ».
export function changeText(s: State, c: AgendaChange): string {
  const names = c.who.map(m => s.members.find(x => x.id === m)?.name ?? '?').join(' et ');
  const slots = c.slots.map(k => { const p = parseSlot(k); return p ? `${fmtDayShort(p.date)} ${p.slot}` : k; });
  const list = slots.length > 4 ? `${slots.slice(0, 3).join(', ')} et ${slots.length - 3} autres repas` : slots.join(', ');
  if (c.kind === 'deplacer') return c.moves.map(mv => { const p = parseSlot(mv.to); return `${mv.dish} : plus personne ${list} → décalé à ${p ? `${fmtDayShort(p.date)} ${p.slot}` : mv.to}`; }).join(' · ');
  const main = c.kind === 'invites' ? `des invités ${list} ?` : c.kind === 'maison' ? `${names} à la maison ${list}` : `${names} absent${c.who.length > 1 ? 's' : '·e'} ${list}`;
  const moves = c.moves.map(mv => { const p = parseSlot(mv.to); return `${mv.dish} décalé à ${p ? `${fmtDayShort(p.date)} ${p.slot}` : mv.to}`; });
  return [main, ...moves].join(' · ');
}
