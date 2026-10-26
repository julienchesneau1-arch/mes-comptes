// Catalogue « à découvrir » : fichier statique chargé à la demande (et gardé hors ligne par sw.js), relu avant usage.
import { type Catalog, readCatalog } from '../core/catalog.ts';
import type { Photo } from '../core/photos.ts';
import type { Look } from '../core/visual.ts';
import { esc, nameKey } from '../core/text.ts';

let pending: Promise<Catalog | null> | null = null;
let ready: Catalog | null = null;
export function loadCatalog(): Promise<Catalog | null> {
  pending ??= fetch('catalogue.json').then(r => (r.ok ? r.json() : null)).then(readCatalog).catch(() => null)
    .then(c => { if (!c) pending = null; ready = c ?? ready; return c; }); // échec (hors ligne, fichier absent) : on réessaiera plus tard
  return pending;
}
// Déjà chargé (pour les écrans dessinés d'un coup : choix d'un plat, idées d'Aujourd'hui) ; null tant qu'il ne l'est pas.
export const catalogNow = (): Catalog | null => ready;

// Photo libre d'un plat : celle de la recette prête du même nom (un plat ajouté depuis le catalogue la garde).
let byName = new Map<string, Photo>(), forCat: Catalog | null = null;
export function photoFor(name: string): Photo | null {
  if (!ready) return null;
  if (forCat !== ready) { byName = new Map(ready.recipes.flatMap(r => (r.photo ? [[nameKey(r.title), r.photo] as const] : []))); forCat = ready; }
  return byName.get(nameKey(name)) ?? null;
}
export const withPhoto = (l: Look, name: string): Look => { const p = photoFor(name); return p ? { ...l, photo: p.src } : l; };
// Image décorative (le nom du plat est écrit à côté) ; l'emoji coloré reste dessous le temps du chargement, ou hors ligne.
export const photoImg = (l: Look): string => (l.photo ? `<img class="photo" src="${esc(l.photo)}" alt="" loading="lazy" decoding="async">` : '');
// En tête d'une fiche : la photo et son crédit (auteur, licence, page d'origine), exigé par les licences libres.
export const photoHero = (p: Photo | undefined | null): string => (p ? `<figure class="photo-hero"><img src="${esc(p.src)}" alt="" decoding="async"><figcaption class="small muted">Photo : ${esc(p.author)} · ${esc(p.license)} · <a href="${esc(p.page)}" target="_blank" rel="noopener noreferrer">source</a></figcaption></figure>` : '');
