// Catalogue « à découvrir » : fichier statique chargé à la demande (et gardé hors ligne par sw.js), relu avant usage.
import { readCatalog } from '../core/catalog.js';
import { esc, nameKey } from '../core/text.js';
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
// Photo libre d'un plat : celle de la recette prête du même nom (un plat ajouté depuis le catalogue la garde).
let byName = new Map(), forCat = null;
export function photoFor(name) {
    if (!ready)
        return null;
    if (forCat !== ready) {
        byName = new Map(ready.recipes.flatMap(r => (r.photo ? [[nameKey(r.title), r.photo]] : [])));
        forCat = ready;
    }
    return byName.get(nameKey(name)) ?? null;
}
export const withPhoto = (l, name) => { const p = photoFor(name); return p ? { ...l, photo: p.src } : l; };
// Image décorative (le nom du plat est écrit à côté) ; l'emoji coloré reste dessous le temps du chargement, ou hors ligne.
export const photoImg = (l) => (l.photo ? `<img class="photo" src="${esc(l.photo)}" alt="" loading="lazy" decoding="async">` : '');
// En tête d'une fiche : la photo et son crédit (auteur, licence, page d'origine), exigé par les licences libres.
export const photoHero = (p) => (p ? `<figure class="photo-hero"><img src="${esc(p.src)}" alt="" decoding="async"><figcaption class="small muted">Photo : ${esc(p.author)} · ${esc(p.license)} · <a href="${esc(p.page)}" target="_blank" rel="noopener noreferrer">source</a></figcaption></figure>` : '');
