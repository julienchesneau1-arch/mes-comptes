// Lecteur de factures du drive : texte du PDF → lignes → produits et prix, rapprochement, prix payé dans le panier estimé.
// Deux factures fictives : un format générique, et le format réel d'Auchan drive (mise en page relevée sur trois vraies
// factures, lues avec les données personnelles masquées ; contenu entièrement inventé).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, MON } from './helpers.ts';
import { makePdf, SAMPLE_ROWS, AUCHAN_ROWS } from './pdf-fixture.ts';
import { type Paid, validEvent } from '../src/core/model.ts';
import { setRefPrices } from '../src/core/refprice.ts';
import { q } from '../src/core/rational.ts';
import { type PdfLib, type TextItem, toLines, parseInvoice, labelSize, matchKey, candidates, pdfItems } from '../src/core/invoice.ts';
import { cartEstimate, lineCost, paidCost } from '../src/core/budget.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { driveItems, searchUrl } from '../src/core/drive.ts';

// Rangées du PDF fictif → morceaux positionnés, comme pdf.js les rend (y décroissant de haut en bas).
const items = (rows: typeof SAMPLE_ROWS): TextItem[] => rows.flatMap((parts, r) => parts.map(([x, str]) => ({ str, x, y: 800 - r * 14 + (x % 3) * 0.5, page: 1 })));

test('lignes : morceaux d\'une même hauteur réunis de gauche à droite, pages dans l\'ordre', () => {
  const got = toLines([{ str: '2,50 €', x: 470, y: 700.4, page: 1 }, { str: 'Oignons', x: 40, y: 700, page: 1 }, { str: '2', x: 330, y: 699.6, page: 1 },
    { str: 'Total', x: 40, y: 500, page: 2 }, { str: 'Titre', x: 40, y: 780, page: 1 }, { str: '  ', x: 90, y: 780, page: 1 }]);
  assert.deepEqual(got, ['Titre', 'Oignons 2 2,50 €', 'Total']);
});

test('facture fictive : produits, quantités, pesée, date, total ; données personnelles jamais retenues', () => {
  const inv = parseInvoice(toLines(items(SAMPLE_ROWS)));
  assert.equal(inv.day, '2026-10-03');
  assert.equal(inv.total, 1300);
  assert.equal(inv.sum, 1300);                                                 // la somme des lignes fait le total : lecture complète
  assert.deepEqual(inv.lines.map(l => [l.label, l.n, l.unitCents, l.cents, l.loose, l.sure]), [
    ['Oignons jaunes filet 1 kg', 2, 125, 250, false, true],
    ['Tomates grappe', 1, 299, 249, true, true],                               // 0,834 kg × 2,99 €/kg = 2,49 €
    ['Œufs frais plein air x12', 1, 345, 345, false, true],                    // « frais » n'en fait pas des frais de service
    ['Crème dessert vanille 4x125g', 1, 189, 189, false, true],
    ['Pâtes spaghetti 500g', 3, 89, 267, false, true],
  ]);
  assert.deepEqual(inv.lines.map(l => [l.size, l.unit]), [['1', 'kg'], ['1', 'kg'], ['12', 'piece'], ['500', 'g'], ['500', 'g']]);
  const kept = inv.lines.map(l => l.label).join(' | ');
  for (const pii of ['Camille', 'Exemple', 'rue', '900000001', 'Villefictive']) assert.ok(!kept.includes(pii), `retenu à tort : ${pii}`);
});

test('facture Auchan drive : colonnes vérifiées par deux calculs, remise et cagnotte, nom sur deux lignes, date de commande, paiements écartés', () => {
  const inv = parseInvoice(toLines(items(AUCHAN_ROWS)));
  assert.equal(inv.day, '2026-10-08');                                         // date de commande, pas « Facture éditée le » (téléchargement)
  assert.equal(inv.total, 4677);                                               // « Total à payer », pas le total avant remises
  assert.equal(inv.sum, 4677);
  assert.deepEqual(inv.lines.map(l => [l.label, l.n, l.unitCents, l.cents, l.size, l.unit, l.sure]), [
    ['AUCHAN Beurre doux 250g', 1, 258, 258, '250', 'g', true],               // TTC net ; la cagnotte (0,25) n'est pas déduite
    ['AUCHAN Crème dessert au chocolat au lait 4x125g', 2, 138, 276, '500', 'g', true],
    ['MARQUE Thé glacé saveur pêche 4x1.25L', 4, 412, 1646, '5', 'l', true],  // (5,20 − 1,30 de remise) × 4 = 15,60 HT → 16,46 TTC
    ['AUCHAN TAVOLA Parmigiano Reggiano AOP râpé 60g', 2, 124, 248, '60', 'g', true], // suite en majuscule, gardée car elle porte une contenance
    ['PRIX BAS FILET PLT BLANC 600G', 2, 643, 1286, '600', 'g', true],
    ['AUCHAN Confiture extra de figue 50% de fruits 360g', 1, 168, 168, '360', 'g', true], // suite après le changement de page
    ['AUCHAN Légumes pour couscous 5 portions 1kg', 2, 206, 411, '1', 'kg', true],   // « 5 » du nom n'est pas la quantité
    ['MARQUE Déodorant fraîcheur 50ml', 2, 192, 384, '50', 'ml', true],      // TVA 20 %
  ]);                                                                          // « Vignettes » à 0,00 € : pas un achat
  const kept = inv.lines.map(l => l.label).join(' | ');
  for (const pii of ['Camille', 'EXEMPLE', 'rue', '900000001', 'VILLEFICTIVE', '0000000', 'WAAOH', 'CARTE']) assert.ok(!kept.includes(pii), `retenu à tort : ${pii}`);
});

test('colonnes Auchan : une ligne qui ne tombe pas juste n\'est pas lue comme telle', () => {
  const one = (l: string) => parseInvoice([l]).lines[0];
  assert.equal(one('3000000000011 AUCHAN Beurre doux 2,41 1 2,41 5,50 2,54')?.cents, 254);
  assert.equal(one('3000000000011 AUCHAN Beurre doux 2,41 1 2,41 5,50 2,99'), undefined);     // 2,41 HT × 1,055 ≠ 2,99 : rien n'est deviné
  assert.equal(one('3000000000011 AUCHAN Beurre doux 2,41 3 2,41 5,50 2,54'), undefined);     // 3 × 2,41 ≠ 2,41
  assert.equal(one('3000000000011 AUCHAN Beurre doux 2,41 1 2,41 7,00 2,58'), undefined);     // 7 % : pas un taux de TVA français
});

test('formats de ligne : quantité en tête, montant seul, deux montants sans rapport, remise, taxes', () => {
  const inv = parseInvoice(['2 Oignons jaunes 1kg 1,25 2,50', '1 Baguette tradition 1,10', 'Beurre doux 250g 1 2,35', 'Lait 6x1L 5,94 5,94 B',
    'Crème fraîche 20cl 1,15', '3 Yaourts nature 4x125g 3,60', 'Lait entier 1 l 0,99', 'Article bizarre 1,99 7,45', 'Remise fidélité -1,00', 'TVA 5,5 % 1,62', 'Sous-total 12,34', 'Net à payer 20,00 €']);
  assert.deepEqual(inv.lines.map(l => [l.label, l.n, l.unitCents, l.sure]), [
    ['Oignons jaunes 1kg', 2, 125, true], ['Baguette tradition', 1, 110, true], ['Beurre doux 250g', 1, 235, true], ['Lait 6x1L', 1, 594, true],
    ['Crème fraîche 20cl', 1, 115, false],                                     // un seul montant : rien pour le vérifier
    ['Yaourts nature 4x125g', 3, 120, false],                                   // 3 articles, prix unitaire déduit, non vérifiable
    ['Lait entier 1 l', 1, 99, false],                                          // « 1 l » : contenance, pas une quantité
  ]);
  assert.deepEqual([inv.lines.at(-1)?.size, inv.lines.at(-1)?.unit], ['1', 'l']);                                                                          // « Article bizarre » : deux montants incohérents, écarté
  assert.equal(inv.total, 2000);
  assert.equal(inv.ignored, 2);                                                // TVA, sous-total ; la remise négative n'est pas un produit
});

test('contenance lue dans le nom : lot, masse, volume, nombre ; rien sinon', () => {
  assert.deepEqual(labelSize('Steaks hachés 5% MG 4x100g'), { size: '400', unit: 'g' });
  assert.deepEqual(labelSize('Lait demi-écrémé 6 x 1 L'), { size: '6', unit: 'l' });
  assert.deepEqual(labelSize('Crème liquide 20cl'), { size: '20', unit: 'cl' });
  assert.deepEqual(labelSize('Farine T45 1,5kg'), { size: '3/2', unit: 'kg' });
  assert.deepEqual(labelSize('Œufs plein air x 12'), { size: '12', unit: 'piece' });
  assert.equal(labelSize('Baguette tradition'), null);
});

test('rapprochement : le plus précis gagne, garde-fou de groupe, égalité laissée à la personne', () => {
  const c = [{ key: 'oignon', name: 'oignon' }, { key: 'tomate', name: 'tomate' }, { key: 'sauce tomate', name: 'sauce tomate' },
    { key: 'creme fraiche', name: 'crème fraîche', not: /dessert/ }, { key: 'pomme', name: 'pomme' }, { key: 'pomme de terre', name: 'pommes de terre' },
    { key: 'petit pois|surgele', name: 'petits pois surgelé' }, { key: 'petit pois', name: 'petits pois' }];
  const m = (l: string) => matchKey(l, c)?.key ?? null;
  assert.equal(m('Sauce tomate basilic 400g'), 'sauce tomate');
  assert.equal(m('Oignons jaunes filet 1 kg'), 'oignon');
  assert.equal(m('Crème fraîche dessert vanille'), null);
  assert.equal(m('Crème fraîche épaisse 20cl'), 'creme fraiche');
  assert.equal(m('Pommes de terre 2,5 kg'), 'pomme de terre');
  assert.equal(m('Petits pois extra-fins surgelés 1kg'), 'petit pois|surgele');
  assert.equal(m('Petits pois très fins 800g'), 'petit pois');
  assert.equal(matchKey('Tomate et oignon', [{ key: 'b', name: 'oignon' }, { key: 'a', name: 'tomate' }])?.key, 'a'); // le premier mot du nom l'emporte
  assert.equal(matchKey('Tomates cerises', [{ key: 'a', name: 'tomate' }, { key: 'b', name: 'tomates' }]), null);   // vraie égalité : la personne choisit
  assert.equal(matchKey('Poivrons', c), null);
});

test('prix payé : validation stricte, le plus récent reste, oubli', () => {
  const base = { id: 'evt000000001', lc: 1, dev: 'deva0001', by: 'm1', at: '2026-10-04T10:00:00.000Z', t: 'price.paid' };
  const ok = { key: 'tomate', label: 'Tomates grappe', cents: 299, size: '1', unit: 'kg', loose: true, day: '2026-10-03' };
  assert.ok(validEvent({ ...base, p: ok }));
  assert.equal(validEvent({ ...base, p: { ...ok, unit: 'g' } }), null);       // pesé : prix au kg ou au litre seulement
  assert.equal(validEvent({ ...base, p: { ...ok, cents: 0 } }), null);
  assert.equal(validEvent({ ...base, p: { ...ok, day: '03/10/2026' } }), null);
  const { a } = household();
  a.emit({ t: 'price.paid', p: { ...ok, cents: 320, day: '2026-10-10' } }, { t: 'price.paid', p: ok });
  assert.equal(a.s.paid['tomate']?.cents, 320);                                // facture plus ancienne lue après : ignorée
  assert.equal(a.r.rejected.size, 1);
  a.emit({ t: 'price.paid', p: { ...ok, cents: null } });
  assert.equal(a.s.paid['tomate'], undefined);
});

test('panier : prix payé d\'abord (au poids ou en articles entiers), recherche Auchan sur le produit déjà acheté', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'gratin01', content: content('Gratin', 2, ['600 g de tomates', '750 g de pâtes', '3 œufs', '2 poivrons']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepgra1', recipe: 'gratin01', extra: 0 } },
    { t: 'price.paid', p: { key: 'tomate', label: 'Tomates grappe', cents: 299, size: '1', unit: 'kg', loose: true, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'pate', label: 'Pâtes spaghetti 500g', cents: 89, size: '500', unit: 'g', loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'oeuf', label: 'Œufs frais plein air x12', cents: 345, size: '12', unit: 'piece', loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'poivron', label: 'Poivrons rouges', cents: 150, size: null, unit: null, loose: false, day: '2026-10-03' } });
  const list = deriveShopping(a.s, MON), line = (n: string) => list.lines.find(l => l.name.toLowerCase().startsWith(n));
  const tom = line('tomate'), pat = line('pâte'), oeu = line('œuf'), poi = line('poivron');
  assert.ok(tom && pat && oeu && poi);
  assert.deepEqual([lineCost(a.s, tom)?.how, lineCost(a.s, tom)?.cents], ['facture', Math.round(299 * 0.6)]); // 0,6 kg au prix du kg
  assert.equal(lineCost(a.s, pat)?.cents, 2 * 89);                             // 750 g → 2 paquets de 500 g
  assert.equal(lineCost(a.s, oeu)?.cents, 345);                                // 3 œufs → une boîte de 12
  assert.equal(paidCost({ cents: 150, size: null, unit: null, loose: false }, poi), null); // contenance inconnue : on ne devine pas
  assert.notEqual(lineCost(a.s, poi)?.how, 'facture');
  setRefPrices({ source: '', sourceUrl: '', license: '', weights: '', weightsUrl: '', generated: '', period: '2026-08',
    refs: [{ id: 'oignon', label: 'Oignons', keys: ['oignon'], per: 'kg', cents: 285, period: '2026-08', series: 'x', method: 'mesuré', pieceG: 110 }] });
  a.emit({ t: 'price.paid', p: { key: 'oignon', label: 'Oignons jaunes filet 1 kg', cents: 125, size: '1', unit: 'kg', loose: false, day: '2026-10-03' } });
  const oig = { ...poi, name: 'oignon', key: 'oignon|piece', toBuy: q(12) };
  assert.equal(paidCost(a.s.paid['oignon'] as Paid, oig), 2 * 125);           // 12 oignons × 110 g = 1,32 kg → 2 filets de 1 kg
  setRefPrices(null);
  assert.equal(cartEstimate(a.s, list).paid, 3);
  const drive = driveItems(a.s, list).find(i => i.name.toLowerCase().startsWith('pâte'));
  assert.equal(drive?.url, searchUrl('Pâtes spaghetti 500g'));                 // « le même que la dernière fois »
  assert.equal(drive?.packs && drive.packs.n, 2);
});

test('candidats : ingrédients de la semaine (avec leur forme), génériques, déjà payés', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'soupe001', content: content('Soupe', 2, ['300 g de petits pois surgelés', '1 oignon']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepsou1', recipe: 'soupe001', extra: 0 } });
  const c = candidates(a.s, [MON]), keys = new Set(c.map(x => x.key));
  assert.ok(keys.has('petit pois|surgele') && keys.has('petit pois') && keys.has('oignon'));
  assert.ok(keys.has('creme fraiche') && keys.has('tomate'));                  // noms génériques (étude qualité-prix, Insee)
  assert.ok(c.find(x => x.key === 'creme fraiche')?.not);                      // garde-fou « crème dessert »
  assert.equal(matchKey('Petits pois extra-fins surgelés 1kg', c)?.key, 'petit pois|surgele');
});

test('rapprochement sur les libellés Auchan : produit nommé en tête, marque ignorée, abréviations', () => {
  const c = ['crème', 'pomme', 'lait', 'avocat', 'brioche', 'filet de poulet', 'poulet', 'pommes de terre', 'saucisse de Toulouse', 'fromage frais', 'parmesan', 'cabillaud']
    .map(n => ({ key: n, name: n }));
  const m = (l: string) => matchKey(l, c)?.name ?? null;
  assert.equal(m('KIRI Fromage fondu à la crème en portion 216g'), null);           // fromage fondu, pas de la crème
  assert.equal(m('PITCH Brioche goût pomme poire 8 pièces'), 'brioche');            // « goût pomme » ne fait pas une pomme
  assert.equal(m('AUCHAN BARRE FOURRE LAIT 125G'), null);
  assert.equal(m('AUCHAN Tartinable guacamole morceaux d\'avocat 200g'), null);
  assert.equal(m('PRIX BAS FILET PLT BLANC 600G'), 'filet de poulet');              // « PLT » : poulet
  assert.equal(m('PDT 2,5KG FOUR'), 'pommes de terre');
  assert.equal(m('AUCHAN SCISSE TOULOUSE 4X100G'), 'saucisse de Toulouse');
  assert.equal(m('AUCHAN FROM FRAIS 3,7% X4'), 'fromage frais');
  assert.equal(m('MON POISSONNIER Filet de cabillaud 1 pièce 200g'), 'cabillaud'); // marque en capitales ignorée
  assert.equal(m('AUC CREME 15% POT 20CL'), 'crème');
});

test('PDF réel : texte extrait par pdf.js embarqué (sur l\'appareil), puis lu', async () => {
  const lib = await import(new URL('../vendor/pdfjs/pdf.min.js', import.meta.url).href) as PdfLib & { GlobalWorkerOptions: { workerSrc: string } };
  lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
  const inv = parseInvoice(toLines(await pdfItems(lib, makePdf(SAMPLE_ROWS))));
  assert.equal(inv.total, 1300);
  assert.equal(inv.sum, 1300);
  const auchan = parseInvoice(toLines(await pdfItems(lib, makePdf(AUCHAN_ROWS)))); // même chemin que sur le téléphone
  assert.deepEqual([auchan.day, auchan.total, auchan.sum, auchan.lines.length], ['2026-10-08', 4677, 4677, 8]);
  assert.equal(inv.lines.length, 5);
  assert.equal(inv.lines[2]?.label, 'Œufs frais plein air x12');              // accents et « Œ » : encodage WinAnsi rendu fidèlement
  await assert.rejects(pdfItems(lib, new TextEncoder().encode('pas un pdf')), (e: Error) => e.name === 'InvalidPDFException');
});
