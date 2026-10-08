// Découvertes déjà montrées sur ce téléphone (8 semaines) : elles repassent après les autres, pour ne pas revoir les mêmes.
// Mémoire locale (pas dans le journal) : une simple préférence d'affichage, sans conséquence sur les données du foyer.
import { addDays } from '../core/dates.ts';
import { clock } from './state.ts';

const KEY = 'foyer:vus', DAYS = 56;
function load(): Record<string, string> {
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}') as unknown; return o && typeof o === 'object' ? o as Record<string, string> : {}; } catch { return {}; }
}
export function seenSet(): Set<string> {
  const from = addDays(clock().date, -DAYS);
  return new Set(Object.entries(load()).filter(([id, d]) => /^wb\d{1,9}$/.test(id) && typeof d === 'string' && d >= from).map(([id]) => id));
}
export function markSeen(ids: Iterable<string>): void {
  const all = load(), today = clock().date, from = addDays(today, -DAYS);
  for (const id of ids) all[id] = today;
  for (const [id, d] of Object.entries(all)) if (typeof d !== 'string' || d < from) delete all[id];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* navigation privée : sans mémoire */ }
}
