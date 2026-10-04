// Catalogue « à découvrir » : fichier statique chargé à la demande (et gardé hors ligne par sw.js), relu avant usage.
import { type Catalog, readCatalog } from '../core/catalog.ts';

let pending: Promise<Catalog | null> | null = null;
export function loadCatalog(): Promise<Catalog | null> {
  pending ??= fetch('catalogue.json').then(r => (r.ok ? r.json() : null)).then(readCatalog).catch(() => null)
    .then(c => { if (!c) pending = null; return c; }); // échec (hors ligne, fichier absent) : on réessaiera plus tard
  return pending;
}
