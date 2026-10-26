// Pastille sur l'icône de Foyer (écran d'accueil) : le nombre de cartes « À régler », comme une app native. iOS 16.4+ pour une
// app installée, après l'accord des notifications ; ailleurs, sans effet. Recalculée à chaque rendu, posée seulement si elle change.
import { deriveToday } from '../core/today.ts';
import { A, S } from './state.ts';
import { reglerCount } from './sheets/decisions.ts';

type Badging = { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
let last = -1;
export function updateBadge(): void {
  const nav = navigator as Navigator & Badging;
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  const n = A.demo || !S().hid ? 0 : reglerCount(deriveToday(A.r, A.now()));
  if (n === last) return;
  last = n;
  (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => { last = -1; }); // pas d'accord des notifications : on réessaiera
}
