// Pastille sur l'icône de Foyer (écran d'accueil) : le nombre de cartes « À régler », comme une app native. iOS 16.4+ pour une
// app installée, après l'accord des notifications ; ailleurs, sans effet. Recalculée à chaque rendu, posée seulement si elle change.
import { deriveToday } from '../core/today.js';
import { A, S } from './state.js';
import { reglerCount } from './sheets/decisions.js';
let last = -1;
export function updateBadge() {
    const nav = navigator;
    if (!nav.setAppBadge || !nav.clearAppBadge)
        return;
    const n = A.demo || !S().hid ? 0 : reglerCount(deriveToday(A.r, A.now()));
    if (n === last)
        return;
    last = n;
    (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => { last = -1; }); // pas d'accord des notifications : on réessaiera
}
