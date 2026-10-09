// Prix de référence (prix.json, Insee) et étude qualité-prix (produits.json, Open Food Facts + Open Prices) : chargés au démarrage,
// gardés hors ligne par sw.js, relus avant usage. Fichiers statiques régénérés chaque semaine par la CI : aucun appel pendant l'usage.
// Tant qu'ils ne sont pas là, les montants restent « non chiffrés » ; l'écran est redessiné dès qu'ils arrivent.
import { readRefPrices, setRefPrices } from '../core/refprice.ts';
import { readProducts, setProducts } from '../core/products.ts';
import { A } from './state.ts';

const load = <T>(file: string, read: (v: unknown) => T | null, set: (v: T) => void): void => {
  fetch(file).then(r => (r.ok ? r.json() : null)).then(read)
    .then(v => { if (v) { set(v); A.render(); } })
    .catch(() => undefined); // hors ligne au premier lancement : on réessaiera à la prochaine ouverture
};
export function loadRefPrices(): void {
  load('prix.json', readRefPrices, setRefPrices);
  load('produits.json', readProducts, setProducts);
}
