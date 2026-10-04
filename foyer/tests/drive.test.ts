// Drive Auchan assisté : lien produit, contenance, nombre de paquets exact, rien de deviné, partagé entre les deux téléphones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, MON } from './helpers.ts';
import { productLink, parseSize, packsFor, driveItems, searchUrl, sizeDraft, sizeText } from '../src/core/drive.ts';
import { deriveShopping, checkSig } from '../src/core/shopping.ts';
import { validEvent } from '../src/core/model.ts';
import { qStr } from '../src/core/rational.ts';

const POULET = 'https://www.auchan.fr/le-gaulois-filet-de-poulet-blanc/pr-C1158275';

test('lien produit : adresse Auchan normalisée, libellé tiré de l\'adresse, tout autre lien refusé', () => {
  assert.deepEqual(productLink(`Regarde : ${POULET}?utm_source=app&x=1 !`), { url: POULET, label: 'Le gaulois filet de poulet blanc' });
  assert.equal(productLink('http://auchan.fr/le-gaulois-filet-de-poulet-blanc/pr-C1158275#avis')?.url, POULET);
  assert.equal(productLink('https://www.auchan.fr/recherche?text=poulet'), null);           // pas une page produit
  assert.equal(productLink('https://auchan.fr.exemple.com/x/pr-C1'), null);                  // autre site
  assert.equal(productLink('https://www.carrefour.fr/p/poulet-123'), null);
  assert.equal(searchUrl(' blanc de poulet '), 'https://www.auchan.fr/recherche?text=blanc%20de%20poulet');
});

test('contenance : unités connues seulement, lots multipliés, jamais devinée', () => {
  const t = (s: string) => { const r = parseSize(s); return r ? `${qStr(r.size)} ${r.unit.id}` : null; };
  assert.equal(t('300 g'), '300 g');
  assert.equal(t('1,5 kg'), '3/2 kg');
  assert.equal(t('4 x 125 g'), '500 g');
  assert.equal(t('4×125g'), '500 g');
  assert.equal(t('6'), '6 piece');
  assert.equal(t('6 pièces'), '6 piece');
  assert.equal(t('40 cl'), '40 cl');
  assert.equal(t('2 tonnes'), null);
  assert.equal(t('0 g'), null);
  assert.equal(t('beaucoup'), null);
  assert.equal(sizeText({ size: '3/2', unit: 'kg' }), '1,5 kg');
});

function planned() {
  const h = household();
  h.a.emit(
    { t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prep0001', recipe: 'curry001', extra: 1 } }, // 3 portions : 450 g de poulet
  );
  return h;
}
const product = (key: string, url: string, size: string) => {
  const s = parseSize(size);
  return { t: 'product.set' as const, p: { key, url, label: 'x', ...(s ? sizeDraft(s) : { size: null, unit: null }) } };
};

test('paquets : arrondi au supérieur en valeurs exactes, conversion dans la même dimension seulement', () => {
  const { a } = planned();
  a.emit(
    product('poulet', POULET, '300 g'),
    product('lait de coco', 'https://www.auchan.fr/auchan-lait-de-coco/pr-C1000001', '40 cl'),
    product('riz', 'https://www.auchan.fr/auchan-riz-long/pr-C1000002', '1'),
  );
  const list = deriveShopping(a.s, MON);
  const line = (n: string) => list.lines.find(l => l.name === n)!;
  assert.deepEqual(packsFor(line('Poulet'), a.s.products['poulet']!), { n: 2, text: '2 × 300 g · 600 g pour 450 g' });
  assert.deepEqual(packsFor(line('Lait de coco'), a.s.products['lait de coco']!), { n: 1, text: '1 × 400 ml · 400 ml pour 300 ml' });
  const riz = packsFor(line('Riz'), a.s.products['riz']!);
  assert.equal(riz.n, null); // besoin en grammes, contenance en pièces : pas de nombre inventé
  // Besoin exactement couvert : pas de surplus affiché.
  a.emit(product('poulet', POULET, '450 g'));
  assert.deepEqual(packsFor(deriveShopping(a.s, MON).lines.find(l => l.name === 'Poulet')!, a.s.products['poulet']!), { n: 1, text: '1 × 450 g' });
});

test('commande guidée : page du produit retenu sinon recherche ; « ajouté au panier » sort l\'article, sur les deux téléphones', () => {
  const { a, b } = planned();
  a.emit(product('poulet', POULET, '300 g'));
  let items = driveItems(a.s, deriveShopping(a.s, MON));
  assert.deepEqual(new Set(items.map(i => i.name)), new Set(['Poulet', 'Riz (cru)', 'Lait de coco']));
  const poulet = items.find(i => i.name === 'Poulet')!;
  assert.equal(poulet.url, POULET);
  assert.equal(items.find(i => i.name === 'Lait de coco')!.url, searchUrl('Lait de coco'));
  const l = deriveShopping(a.s, MON).lines.find(x => x.name === 'Poulet')!;
  a.emit({ t: 'shop.check', p: { week: MON, key: l.key, needAt: checkSig(l) } });
  items = driveItems(a.s, deriveShopping(a.s, MON));
  assert.ok(!items.some(i => i.name === 'Poulet'));
  b.receive(a);
  assert.equal(b.s.products['poulet']?.url, POULET);                 // produit retenu une fois pour le foyer
  assert.ok(!driveItems(b.s, deriveShopping(b.s, MON)).some(i => i.name === 'Poulet'));
});

test('événement produit : seules les pages produit Auchan passent ; oublier un produit inconnu ne fait rien', () => {
  const base = { id: 'ev000001', lc: 1, dev: 'deva0001', by: 'm1', at: '2026-10-04T10:00:00Z', t: 'product.set' };
  const ok = { key: 'poulet', url: POULET, label: 'Poulet', size: '300', unit: 'g' };
  assert.ok(validEvent({ ...base, p: ok }));
  assert.ok(validEvent({ ...base, p: { ...ok, size: null, unit: null } }));
  assert.ok(validEvent({ ...base, p: { ...ok, url: null } }));
  assert.equal(validEvent({ ...base, p: { ...ok, url: 'https://www.auchan.fr.exemple.com/x/pr-C1' } }), null);
  assert.equal(validEvent({ ...base, p: { ...ok, url: 'javascript:alert(1)' } }), null);
  assert.equal(validEvent({ ...base, p: { ...ok, unit: null } }), null);       // contenance sans unité
  assert.equal(validEvent({ ...base, p: { ...ok, unit: 'tonne' } }), null);
  const { a } = household();
  const [e] = a.emit({ t: 'product.set', p: { key: 'poulet', url: null, label: '', size: null, unit: null } });
  assert.equal(a.r.rejected.get(e!.id)?.severity, 'noop');
});
