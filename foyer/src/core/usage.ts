// Ce que vous utilisez, compté sur ce téléphone seulement : jamais synchronisé, jamais envoyé, absent des sauvegardes.
// Des compteurs par jour, gardés 60 jours, servent à mettre à portée de pouce ce qui revient le plus, sans jamais déplacer
// la navigation : une interface qui se réorganise seule ralentit et déplaît (Findlater et McGrenere, CHI 2004 ; Gajos et al.,
// AI Magazine 2009). Les raccourcis sont des copies dans une zone fixe (« split menu », Sears et Shneiderman, 1994), recalculés
// une fois par jour (jamais pendant que vous vous en servez) et épinglables à la main, ce que les utilisateurs préfèrent.
import { type LocalDate, addDays, daysBetween } from './dates.ts';

export interface Usage { v: 1; since: LocalDate; days: Record<LocalDate, Record<string, number>> }
export const KEEP_DAYS = 60, WINDOW = 30, MIN_USES = 3, MAX_SHORTCUTS = 4, MEASURE_DAYS = 14, MAX_PINS = 4;
const KEY_RE = /^[art]:[A-Za-z0-9]{1,40}$/;  // a: action, r: recette ouverte, t: onglet
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isUsageKey = (k: unknown): k is string => typeof k === 'string' && KEY_RE.test(k);

export const emptyUsage = (today: LocalDate): Usage => ({ v: 1, since: today, days: {} });
// Relu au démarrage : tout ce qui est mal formé est ignoré (le compteur repart de zéro plutôt que d'afficher n'importe quoi).
export function readUsage(x: unknown, today: LocalDate): Usage {
  if (typeof x !== 'object' || x === null) return emptyUsage(today);
  const o = x as Record<string, unknown>, days: Usage['days'] = {};
  if (o['v'] !== 1 || typeof o['since'] !== 'string' || !DAY_RE.test(o['since']) || typeof o['days'] !== 'object' || o['days'] === null) return emptyUsage(today);
  for (const [d, m] of Object.entries(o['days'] as Record<string, unknown>)) {
    if (!DAY_RE.test(d) || typeof m !== 'object' || m === null) continue;
    const row: Record<string, number> = {};
    for (const [k, n] of Object.entries(m as Record<string, unknown>)) if (isUsageKey(k) && Number.isInteger(n) && (n as number) > 0) row[k] = Math.min(n as number, 1e6);
    days[d] = row;
  }
  return { v: 1, since: o['since'] > today ? today : o['since'], days };
}
export function record(u: Usage, key: string, today: LocalDate): Usage {
  if (!isUsageKey(key)) return u;
  const row = u.days[today] ?? (u.days[today] = {});
  if (row[key] !== undefined || Object.keys(row).length < 200) row[key] = (row[key] ?? 0) + 1;
  const oldest = addDays(today, -KEEP_DAYS);
  for (const d of Object.keys(u.days)) if (d < oldest) delete u.days[d];
  return u;
}
// Totaux des `days` derniers jours, sans aujourd'hui : les raccourcis ne bougent pas pendant la journée.
export function counts(u: Usage, today: LocalDate, days = WINDOW, withToday = false): Map<string, number> {
  const from = addDays(today, -days), out = new Map<string, number>();
  for (const [d, row] of Object.entries(u.days)) {
    if (d < from || d > today || (d === today && !withToday)) continue;
    for (const [k, n] of Object.entries(row)) out.set(k, (out.get(k) ?? 0) + n);
  }
  return out;
}
export const measured = (u: Usage, today: LocalDate): number => Math.max(0, daysBetween(u.since, today));

// Outils proposables en raccourci : seulement ceux qui s'ouvrent d'un toucher depuis n'importe quel écran.
export interface Feature { key: string; icon: string; label: string; where: string }
export const FEATURES: readonly Feature[] = [
  { key: 'a:propose', icon: '✨', label: 'Proposer le menu', where: 'Semaine' },
  { key: 'a:drive', icon: '🛒', label: 'Commander au drive', where: 'Courses' },
  { key: 'a:invoice', icon: '🧾', label: 'Lire la facture du drive', where: 'Courses' },
  { key: 'a:newRecipe', icon: '➕', label: 'Nouveau plat', where: 'Maison › Nos plats' },
  { key: 'a:pasteRecipe', icon: '📋', label: 'Coller une recette', where: 'Maison › Nos plats' },
  { key: 'a:discover', icon: '🔎', label: 'Découvrir des recettes', where: 'Maison › Nos plats' },
  { key: 'a:copyWeek', icon: '📑', label: 'Reprendre une semaine', where: 'Semaine' },
  { key: 'a:watchNew', icon: '⏰', label: 'Surveiller une date', where: 'Maison › À surveiller' },
  { key: 'a:agendaOpen', icon: '📅', label: 'Ce que l\'agenda change', where: 'Aujourd\'hui, quand l\'agenda change un repas' },
];
export const featureOf = (key: string): Feature | undefined => FEATURES.find(f => f.key === key);

export interface Shortcut { key: string; uses: number; pinned: boolean }
// Épinglés d'abord (dans votre ordre), puis les recettes ouvertes et les outils servis au moins 3 fois en 30 jours ; 4 au plus.
export function shortcuts(u: Usage, today: LocalDate, pins: readonly string[], recipeOk: (id: string) => boolean): Shortcut[] {
  const c = counts(u, today), ok = (k: string): boolean => (k.startsWith('r:') ? recipeOk(k.slice(2)) : !!featureOf(k));
  const pinned = pins.filter(ok).slice(0, MAX_PINS).map(k => ({ key: k, uses: c.get(k) ?? 0, pinned: true }));
  const rest = [...c].filter(([k, n]) => n >= MIN_USES && ok(k) && !pins.includes(k))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => ({ key: k, uses: n, pinned: false }));
  return [...pinned, ...rest].slice(0, MAX_SHORTCUTS);
}
// Outils jamais servis sur 30 jours, une fois deux semaines de mesure au moins (avant : on ne sait pas encore).
export function unused(u: Usage, today: LocalDate): Feature[] | null {
  if (measured(u, today) < MEASURE_DAYS) return null;
  const c = counts(u, today, WINDOW, true);
  return FEATURES.filter(f => !c.get(f.key));
}
// Ce qui revient le plus (30 derniers jours, aujourd'hui compris), pour la page « Votre usage ».
export const top = (u: Usage, today: LocalDate, n = 8): [string, number][] =>
  [...counts(u, today, WINDOW, true)].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
