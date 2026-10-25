// Catalogue « à découvrir » : fichier statique chargé à la demande (et gardé hors ligne par sw.js), relu avant usage.
import { readCatalog } from '../core/catalog.js';
let pending = null;
let ready = null;
export function loadCatalog() {
    pending ??= fetch('catalogue.json').then(r => (r.ok ? r.json() : null)).then(readCatalog).catch(() => null)
        .then(c => { if (!c)
        pending = null; ready = c ?? ready; return c; }); // échec (hors ligne, fichier absent) : on réessaiera plus tard
    return pending;
}
// Déjà chargé (pour les écrans dessinés d'un coup : choix d'un plat, idées d'Aujourd'hui) ; null tant qu'il ne l'est pas.
export const catalogNow = () => ready;
