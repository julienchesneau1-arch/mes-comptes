// Lecture d'un agenda au format iCalendar (RFC 5545) : Google Agenda, iCloud, Outlook. Sans dépendance, déterministe.
// Événements simples, journées entières, récurrences courantes (tous les jours, semaines, mois, ans ; jours choisis ;
// « 2ᵉ mardi », « dernier vendredi »), exceptions et occurrences déplacées. Ce qui n'est pas compris est compté et
// signalé, jamais deviné. Copié tel quel (avec dates.ts) dans la fonction serveur foyer-agenda ; un test vérifie la copie.
import { type LocalDate, addDays, isDate, weekday, daysBetween } from './dates.ts';

export interface Occurrence {
  id: string;            // stable : agenda + UID + début d'origine (une occurrence déplacée garde le sien)
  title: string;
  allDay: boolean;
  start: number;         // instant (ms) ; journée entière : minuit heure de Paris du premier jour
  end: number;           // exclusif
  days: [LocalDate, LocalDate] | null; // journée(s) entière(s) : [premier jour, lendemain du dernier]
  busy: boolean;         // « occupé » (TRANSP différent de TRANSPARENT)
  recurring: boolean;
  tzGuess: boolean;      // fuseau inconnu : heure de Paris supposée (signalé)
}
export interface CalendarRead { occurrences: Occurrence[]; events: number; skipped: { title: string; why: string }[] }

const MAX_TEXT = 12e6, MAX_EVENTS = 30000, MAX_STEPS = 60000;

/* ---------- Identifiant stable (FNV-1a, deux graines → 16 caractères hexadécimaux) ---------- */
const fnv = (s: string, seed: number): string => { let h = seed >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
export const hash16 = (s: string): string => fnv(s, 2166136261) + fnv(s, 0x1b873593);

/* ---------- Lignes et propriétés ---------- */
interface Prop { name: string; params: Record<string, string>; value: string }

function splitOutside(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (const c of s) {
    if (c === '"') q = !q;
    if (c === sep && !q) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseLine(line: string): Prop | null {
  let q = false, colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ':' && !q) { colon = i; break; }
  }
  if (colon <= 0) return null;
  const [name = '', ...rest] = splitOutside(line.slice(0, colon), ';');
  const params: Record<string, string> = {};
  for (const r of rest) { const eq = r.indexOf('='); if (eq > 0) params[r.slice(0, eq).toUpperCase()] = r.slice(eq + 1).replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (v: string): string => v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c)).replace(/\s+/g, ' ').trim();

/* ---------- Fuseaux ---------- */
const WINDOWS: Record<string, string> = {
  'romance standard time': 'Europe/Paris', 'w. europe standard time': 'Europe/Berlin', 'central europe standard time': 'Europe/Budapest',
  'central european standard time': 'Europe/Warsaw', 'gmt standard time': 'Europe/London', 'utc': 'UTC', 'coordinated universal time': 'UTC',
};
const FMT = new Map<string, Intl.DateTimeFormat | null>();
function fmt(tz: string): Intl.DateTimeFormat | null {
  if (FMT.has(tz)) return FMT.get(tz) ?? null;
  let f: Intl.DateTimeFormat | null = null;
  try { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { f = null; }
  FMT.set(tz, f);
  return f;
}
// Nom de fuseau lisible (IANA ou Windows courant) ; null si inconnu.
export function resolveTz(tzid: string | undefined): string | null {
  if (!tzid) return null;
  const t = tzid.replace(/^\/+/, '').trim();
  if (fmt(t)) return t;
  const w = WINDOWS[t.toLowerCase()];
  return w && fmt(w) ? w : null;
}
// Heure murale d'un instant dans un fuseau.
export function wall(ms: number, tz: string): { date: LocalDate; sec: number } {
  const p = Object.fromEntries((fmt(tz) ?? (fmt('UTC') as Intl.DateTimeFormat)).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { date: `${p['year']}-${p['month']}-${p['day']}`, sec: Number(p['hour']) * 3600 + Number(p['minute']) * 60 + Number(p['second']) };
}
// Heure murale (jour + secondes depuis minuit) dans un fuseau → instant exact, changements d'heure compris.
export function zoned(date: LocalDate, sec: number, tz: string): number {
  const want = Date.parse(`${date}T00:00:00Z`) + sec * 1000;
  let t = want;
  for (let i = 0; i < 3; i++) {
    const w = wall(t, tz), d = want - (Date.parse(`${w.date}T00:00:00Z`) + w.sec * 1000);
    if (!d) break;
    t += d;
  }
  return t;
}

/* ---------- Dates et durées ---------- */
type When = { kind: 'date'; date: LocalDate } | { kind: 'time'; date: LocalDate; sec: number; tz: string; utc: boolean; guess: boolean };

function parseWhenValue(v: string, params: Record<string, string>): When | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(v.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isDate(date)) return null;
  if (m[4] === undefined || params['VALUE'] === 'DATE') return { kind: 'date', date };
  const sec = Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6]);
  if (sec >= 86400 + 1) return null;
  if (m[7] === 'Z') return { kind: 'time', date, sec, tz: 'UTC', utc: true, guess: false };
  const tz = resolveTz(params['TZID']);
  return { kind: 'time', date, sec, tz: tz ?? 'Europe/Paris', utc: false, guess: !!params['TZID'] && !tz };
}
const instant = (w: When): number => (w.kind === 'date' ? zoned(w.date, 0, 'Europe/Paris') : zoned(w.date, w.sec, w.tz));

// Durée ISO 8601 (« PT1H30M », « P1D », « P2W ») en secondes ; null si illisible ou négative.
export function parseDuration(v: string): number | null {
  const m = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m || v.trim() === 'P' || v.trim().endsWith('T')) return null;
  return (Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0)) * 86400 + Number(m[3] ?? 0) * 3600 + Number(m[4] ?? 0) * 60 + Number(m[5] ?? 0);
}

/* ---------- Récurrences ---------- */
const WD: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
interface Rule { freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; interval: number; count: number | null; until: When | null;
  byday: { n: number; wd: number }[]; bymonthday: number[]; bymonth: number[]; wkst: number }
const SUPPORTED = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST']);

function parseRule(v: string): Rule | string {
  const kv = Object.fromEntries(v.split(';').filter(Boolean).map(x => { const i = x.indexOf('='); return [x.slice(0, i).toUpperCase(), x.slice(i + 1)]; }));
  const unknown = Object.keys(kv).filter(k => !SUPPORTED.has(k));
  if (unknown.length) return `récurrence non comprise (${unknown.join(', ')})`;
  const freq = kv['FREQ'];
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return `récurrence non comprise (${freq ?? 'sans fréquence'})`;
  const interval = kv['INTERVAL'] ? Number(kv['INTERVAL']) : 1;
  const count = kv['COUNT'] ? Number(kv['COUNT']) : null;
  if (!Number.isInteger(interval) || interval < 1 || interval > 1000 || (count !== null && (!Number.isInteger(count) || count < 1))) return 'récurrence illisible';
  const until = kv['UNTIL'] ? parseWhenValue(kv['UNTIL'], {}) : null;
  if (kv['UNTIL'] && !until) return 'fin de récurrence illisible';
  const byday: { n: number; wd: number }[] = [];
  for (const d of (kv['BYDAY'] ?? '').split(',').filter(Boolean)) {
    const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(d.trim());
    if (!m) return 'jours de récurrence illisibles';
    byday.push({ n: m[1] ? Number(m[1]) : 0, wd: WD[m[2] as string] as number });
  }
  const nums = (s: string | undefined, lo: number, hi: number): number[] | null => {
    const out = (s ?? '').split(',').filter(Boolean).map(Number);
    return out.every(n => Number.isInteger(n) && n !== 0 && Math.abs(n) >= lo && Math.abs(n) <= hi) ? out : null;
  };
  const bymonthday = nums(kv['BYMONTHDAY'], 1, 31), bymonth = nums(kv['BYMONTH'], 1, 12);
  if (!bymonthday || !bymonth || bymonth.some(n => n < 0)) return 'récurrence illisible';
  if (byday.some(d => d.n !== 0) && freq !== 'MONTHLY' && !(freq === 'YEARLY' && bymonth.length)) return 'récurrence non comprise (jour numéroté)';
  if (freq === 'YEARLY' && byday.length && !bymonth.length) return 'récurrence non comprise (jours de l\'année)';
  return { freq, interval, count, until, byday, bymonthday, bymonth, wkst: WD[kv['WKST'] ?? 'MO'] ?? 0 };
}

const ymd = (d: LocalDate): [number, number, number] => [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
const mk = (y: number, m: number, d: number): LocalDate => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthLen = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Jours d'un mois retenus par la règle (triés).
function monthDays(y: number, m: number, r: Rule, startDay: number): LocalDate[] {
  const len = monthLen(y, m);
  let days: number[];
  if (r.bymonthday.length) days = r.bymonthday.map(n => (n > 0 ? n : len + n + 1)).filter(n => n >= 1 && n <= len);
  else if (r.byday.length) days = Array.from({ length: len }, (_, i) => i + 1);
  else days = startDay <= len ? [startDay] : [];
  if (r.byday.length) {
    days = days.filter(d => {
      const wd = weekday(mk(y, m, d));
      return r.byday.some(b => {
        if (b.wd !== wd) return false;
        if (b.n === 0) return true;
        const nth = Math.floor((d - 1) / 7) + 1, fromEnd = Math.floor((len - d) / 7) + 1;
        return b.n > 0 ? nth === b.n : fromEnd === -b.n;
      });
    });
  }
  return [...new Set(days)].sort((a, b) => a - b).map(d => mk(y, m, d));
}

// Dates de début (jour local de l'événement) d'une règle, de DTSTART jusqu'à `last` (inclus), dans l'ordre.
// Sans COUNT, on saute directement près de `skipTo` (rien à compter avant) : un événement quotidien depuis dix ans reste rapide.
function expandDates(start: LocalDate, r: Rule, last: LocalDate, keep: (d: LocalDate) => boolean, skipTo: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  let n = 0, steps = 0;
  const [y0, m0, d0] = ymd(start);
  const push = (d: LocalDate): boolean => { // false = fin
    if (d < start) return true;
    if (d > last || (r.count !== null && n >= r.count) || !keep(d)) return false;
    n++; out.push(d);
    return true;
  };
  const okMonth = (d: LocalDate): boolean => !r.bymonth.length || r.bymonth.includes(Number(d.slice(5, 7)));
  let p0 = 0;
  if (r.count === null && skipTo > start) {
    const [ys, ms] = ymd(skipTo);
    const gap = r.freq === 'DAILY' ? daysBetween(start, skipTo) : r.freq === 'WEEKLY' ? Math.floor(daysBetween(start, skipTo) / 7)
      : r.freq === 'MONTHLY' ? (ys - y0) * 12 + (ms - m0) : ys - y0;
    p0 = Math.max(0, Math.floor(gap / r.interval) - 1);
  }
  for (let p = p0; steps < MAX_STEPS; p++, steps++) {
    let cands: LocalDate[];
    if (r.freq === 'DAILY') {
      const d = addDays(start, p * r.interval);
      if (d > last) break;
      cands = (!r.byday.length || r.byday.some(b => b.wd === weekday(d))) && okMonth(d) ? [d] : [];
    } else if (r.freq === 'WEEKLY') {
      const ws = addDays(addDays(start, -((weekday(start) - r.wkst + 7) % 7)), p * 7 * r.interval);
      if (ws > last) break;
      const wds = r.byday.length ? r.byday.map(b => b.wd) : [weekday(start)];
      cands = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter(d => wds.includes(weekday(d)) && okMonth(d));
    } else if (r.freq === 'MONTHLY') {
      const k = m0 - 1 + p * r.interval, y = y0 + Math.floor(k / 12), m = (k % 12) + 1;
      if (mk(y, m, 1) > last) break;
      cands = r.bymonth.length && !r.bymonth.includes(m) ? [] : monthDays(y, m, r, d0);
    } else {
      const y = y0 + p * r.interval;
      if (mk(y, 1, 1) > last) break;
      cands = (r.bymonth.length ? r.bymonth : [m0]).sort((a, b) => a - b).flatMap(m => monthDays(y, m, r, d0));
    }
    for (const d of cands) if (!push(d)) return out;
  }
  return out;
}

/* ---------- Lecture ---------- */
type Comp = Map<string, Prop[]>;
const one = (c: Comp, k: string): Prop | undefined => c.get(k)?.[0];

function components(text: string): Comp[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Comp[] = [];
  let cur: Comp | null = null, depth = 0;
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && !cur) { cur = new Map(); depth = 0; }
      else if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && depth === 0 && p.value.toUpperCase() === 'VEVENT') { out.push(cur); cur = null; if (out.length > MAX_EVENTS) break; }
      else if (cur) depth--;
      continue;
    }
    if (cur && depth === 0) { const l = cur.get(p.name) ?? []; l.push(p); cur.set(p.name, l); }
  }
  return out;
}

const whenKey = (w: When): string => (w.kind === 'date' ? w.date : String(instant(w)));

// Lit un agenda et renvoie les occurrences qui touchent [from, to] (jours de Paris, inclus).
export function readCalendar(text: string, from: LocalDate, to: LocalDate, seed: string): CalendarRead {
  const skipped: { title: string; why: string }[] = [];
  if (text.length > MAX_TEXT || !/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) return { occurrences: [], events: 0, skipped: [{ title: '', why: 'ce n\'est pas un agenda au format iCalendar' }] };
  const comps = components(text);
  const lo = zoned(from, 0, 'Europe/Paris'), hi = zoned(addDays(to, 1), 0, 'Europe/Paris');
  // Occurrences déplacées ou annulées (RECURRENCE-ID) : rangées par UID puis début d'origine.
  const overrides = new Map<string, Map<string, Comp>>();
  for (const c of comps) {
    const rid = one(c, 'RECURRENCE-ID'), uid = one(c, 'UID')?.value;
    const w = rid ? parseWhenValue(rid.value, rid.params) : null;
    if (uid && w) { const m = overrides.get(uid) ?? new Map<string, Comp>(); m.set(whenKey(w), c); overrides.set(uid, m); }
  }
  const out: Occurrence[] = [];
  const emit = (c: Comp, uid: string, origKey: string, s: When, dur: { sec: number; days: number }, recurring: boolean): void => {
    if ((one(c, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') return;
    const title = unescapeText(one(c, 'SUMMARY')?.value ?? '').slice(0, 120) || '(sans titre)';
    const busy = (one(c, 'TRANSP')?.value ?? 'OPAQUE').toUpperCase() !== 'TRANSPARENT';
    let start: number, end: number, days: [LocalDate, LocalDate] | null = null;
    if (s.kind === 'date') {
      const last = addDays(s.date, Math.max(1, dur.days));
      days = [s.date, last]; start = zoned(s.date, 0, 'Europe/Paris'); end = zoned(last, 0, 'Europe/Paris');
    } else { start = instant(s); end = start + dur.sec * 1000; }
    if (end <= lo || start >= hi || (end === start && (start < lo || start >= hi))) return;
    out.push({ id: hash16(`${seed}|${uid}|${origKey}`), title, allDay: s.kind === 'date', start, end, days, busy, recurring, tzGuess: s.kind === 'time' && s.guess });
  };

  for (const c of comps) {
    const uid = one(c, 'UID')?.value ?? `sans-uid-${hash16(JSON.stringify([...c.entries()].map(([k, v]) => [k, v.map(x => x.value)])))}`;
    const title = unescapeText(one(c, 'SUMMARY')?.value ?? '') || '(sans titre)';
    const ds = one(c, 'DTSTART');
    const s = ds ? parseWhenValue(ds.value, ds.params) : null;
    if (!s) { skipped.push({ title, why: 'date de début illisible' }); continue; }
    // Durée : DTEND, sinon DURATION, sinon 1 jour (journée entière) ou 0.
    const de = one(c, 'DTEND'), du = one(c, 'DURATION');
    let dur = { sec: 0, days: s.kind === 'date' ? 1 : 0 };
    if (de) {
      const e = parseWhenValue(de.value, de.params);
      if (!e || e.kind !== s.kind) { skipped.push({ title, why: 'date de fin illisible' }); continue; }
      dur = e.kind === 'date' && s.kind === 'date' ? { sec: 0, days: daysBetween(s.date, e.date) } : { sec: Math.max(0, (instant(e) - instant(s)) / 1000), days: 0 };
    } else if (du) {
      const sec = parseDuration(du.value);
      if (sec === null) { skipped.push({ title, why: 'durée illisible' }); continue; }
      dur = s.kind === 'date' ? { sec: 0, days: Math.max(1, Math.round(sec / 86400)) } : { sec, days: 0 };
    }
    // Jours locaux utiles (marge de la durée et des fuseaux) : tout ce qui est avant ou après est écarté sans calcul d'heure.
    const span = Math.ceil(dur.sec / 86400) + dur.days + 1, low = addDays(from, -span - 1), high = addDays(to, 1);
    const rid = one(c, 'RECURRENCE-ID');
    if (rid) { // occurrence modifiée : émise avec l'identifiant de l'occurrence d'origine
      const w = parseWhenValue(rid.value, rid.params);
      if (w && s.date >= low && s.date <= high) emit(c, uid, whenKey(w), s, dur, true);
      continue;
    }
    const rr = one(c, 'RRULE');
    if (!rr) { if (s.date >= low && s.date <= high) emit(c, uid, whenKey(s), s, dur, false); continue; }
    const rule = parseRule(rr.value);
    if (typeof rule === 'string') { skipped.push({ title, why: rule }); continue; }
    // Exceptions (EXDATE) : comparées à l'instant (heure précise) ou au jour.
    const ex = new Set<string>();
    for (const p of c.get('EXDATE') ?? []) for (const v of p.value.split(',')) { const w = parseWhenValue(v, p.params); if (w) { ex.add(whenKey(w)); if (w.kind === 'date') ex.add(`j${w.date}`); } }
    const own = overrides.get(uid);
    // Dernier jour local utile : fin de fenêtre (en jour local de l'événement, marge d'un jour pour les fuseaux) et UNTIL.
    const last = addDays(to, 1);
    const until = rule.until;
    const untilMs = until ? (until.kind === 'date' ? zoned(addDays(until.date, 1), 0, s.kind === 'time' ? s.tz : 'Europe/Paris') - 1 : instant(until)) : Infinity;
    // Calcul d'heure seulement à deux jours près de la fin (UNTIL) ; sinon simple comparaison de jours.
    const keep = (d: LocalDate): boolean => {
      if (!until || d <= addDays(until.date, -2)) return true;
      if (d >= addDays(until.date, 2)) return false;
      return (s.kind === 'date' ? zoned(d, 0, 'Europe/Paris') : zoned(d, s.sec, s.tz)) <= untilMs;
    };
    const dates = expandDates(s.date, rule, last, keep, low);
    for (const d of dates) {
      if (d < low) continue;
      const inst: When = s.kind === 'date' ? { kind: 'date', date: d } : { ...s, date: d };
      const key = whenKey(inst);
      if (ex.has(key) || ex.has(`j${d}`) || own?.has(key)) continue;
      emit(c, uid, key, inst, dur, true);
    }
  }
  out.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  return { occurrences: out, events: comps.length, skipped };
}
