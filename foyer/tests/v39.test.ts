// V3.9 : produits de la maison (dentifrice, papier toilette…) remis aux courses au bon moment, rythme appris des achats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, MON } from './helpers.ts';
import { validEvent } from '../src/core/model.ts';
import { describeEvent } from '../src/core/describe.ts';
import { RESTOCK, estimate, RESTOCK_DEF, packOf, trips, rhythm, nextDue, restockFor, restockFromInvoice, later, rhythmText } from '../src/core/restock.ts';

const ev = (t: string, p: Record<string, unknown>) => ({ id: 'ev0000000001', lc: 1, dev: 'deva0001', by: 'm1', at: '2026-10-04T10:00:00.000Z', t, p });

test('estimation de départ : rapportée au foyer pour ce qui se partage, par personne pour ce qui est individuel', () => {
  assert.equal(estimate(RESTOCK_DEF['dentifrice'], 2), 25);           // 50 jours pour une personne, deux fois plus vite à deux
  assert.equal(estimate(RESTOCK_DEF['dentifrice'], 1), 50);
  assert.equal(estimate(RESTOCK_DEF['papiertoilette'], 4), 12);
  assert.equal(estimate(RESTOCK_DEF['brosseadents'], 4), 90);         // une brosse chacun tous les 3 mois
  assert.equal(packOf('brosseadents', 2), '2 (un par personne)');
  assert.equal(estimate(RESTOCK_DEF['eponges'], 6), 21);              // foyer : indépendant du nombre de personnes
  assert.equal(estimate(undefined, 2), null);
  assert.ok(RESTOCK.every(d => d.days >= 3 && d.why.length > 5), 'chaque produit porte son hypothèse');
  assert.equal(new Set(RESTOCK.map(d => d.id)).size, RESTOCK.length);
  assert.ok(RESTOCK.filter(d => d.on).length >= 12);
});

test('rythme appris : estimation, puis moyenne avec le premier intervalle, puis médiane des 3 derniers ; un même passage compte une fois', () => {
  const { a } = household();
  a.emit({ t: 'restock.set', p: { id: 'dentifrice', on: true, day: '2026-10-04' } });
  assert.equal(nextDue(a.s, 'dentifrice'), '2026-10-17');           // jamais acheté : supposé à moitié entamé (25 / 2 ≈ 13 jours)
  assert.equal(rhythm(a.s, 'dentifrice')?.basis, 'estimation');
  a.emit({ t: 'restock.bought', p: { id: 'dentifrice', day: '2026-10-01', bought: true } },
    { t: 'restock.bought', p: { id: 'dentifrice', day: '2026-10-03', bought: true } });  // coche puis facture : un seul passage
  assert.deepEqual(trips(a.s.restock['dentifrice']?.bought ?? []), ['2026-10-01']);
  assert.equal(nextDue(a.s, 'dentifrice'), '2026-10-26');
  a.emit({ t: 'restock.bought', p: { id: 'dentifrice', day: '2026-10-29', bought: true } });
  assert.deepEqual([rhythm(a.s, 'dentifrice')?.days, rhythm(a.s, 'dentifrice')?.basis], [27, 'achats']); // (25 + 28) / 2
  a.emit({ t: 'restock.bought', p: { id: 'dentifrice', day: '2026-11-20', bought: true } });
  assert.equal(rhythm(a.s, 'dentifrice')?.days, 25);                  // médiane de 28 et 22
  a.emit({ t: 'restock.bought', p: { id: 'dentifrice', day: '2027-01-10', bought: true } }); // un achat oublié entre-temps
  assert.equal(rhythm(a.s, 'dentifrice')?.days, 28);                  // médiane de 28, 22, 51 : l'oubli ne fausse pas tout
  assert.match(rhythmText(rhythm(a.s, 'dentifrice') ?? { days: 0, basis: 'estimation', gaps: [] }), /d'après vos 3 derniers intervalles/);
  a.emit({ t: 'restock.set', p: { id: 'dentifrice', on: true, day: '2027-01-10', days: 30 } });
  assert.deepEqual([rhythm(a.s, 'dentifrice')?.days, rhythm(a.s, 'dentifrice')?.basis], [30, 'choisi']);
});

test('« il en faut » et « il en reste » : date forcée jusqu\'au prochain achat noté ; coche retirée, la date forcée revient', () => {
  const { a } = household();
  a.emit({ t: 'restock.set', p: { id: 'lessive', on: true, day: '2026-09-01' } },
    { t: 'restock.bought', p: { id: 'lessive', day: '2026-09-01', bought: true } });
  assert.equal(nextDue(a.s, 'lessive'), '2026-10-24');               // 105 / 2 ≈ 53 jours
  a.emit({ t: 'restock.due', p: { id: 'lessive', due: '2026-10-05', day: '2026-10-04' } });
  assert.equal(nextDue(a.s, 'lessive'), '2026-10-05');
  a.emit({ t: 'restock.bought', p: { id: 'lessive', day: '2026-10-06', bought: true } });
  assert.equal(nextDue(a.s, 'lessive'), '2026-11-19');               // achat noté : retour au rythme (premier intervalle 35 j, (53 + 35) / 2 = 44)
  a.emit({ t: 'restock.bought', p: { id: 'lessive', day: '2026-10-06', bought: false } });
  assert.equal(nextDue(a.s, 'lessive'), '2026-10-05');
  assert.equal(later(53), 13);
  assert.equal(later(13), 7);
  assert.equal(a.r.rejected.size, 0);
  a.emit({ t: 'restock.bought', p: { id: 'lessive', day: '2026-09-01', bought: true } });
  assert.equal([...a.r.rejected.values()].at(-1)?.reason, 'achat déjà noté');
});

test('liste de la semaine : seulement ce qui manque, la catégorie n\'apparaît pas chaque semaine', () => {
  const { a } = household();
  a.emit({ t: 'restock.set', p: { id: 'dentifrice', on: true, day: '2026-09-01' } },
    { t: 'restock.bought', p: { id: 'dentifrice', day: '2026-09-12', bought: true } },          // + 25 j : 7 octobre
    { t: 'restock.set', p: { id: 'lessive', on: true, day: '2026-09-01' } },
    { t: 'restock.bought', p: { id: 'lessive', day: '2026-09-25', bought: true } },             // + 53 j : 17 novembre
    { t: 'restock.set', p: { id: 'eponges', on: true, day: '2026-09-01' } },
    { t: 'restock.bought', p: { id: 'eponges', day: '2026-10-03', bought: true } },             // acheté samedi pour cette semaine
    { t: 'restock.set', p: { id: 'papiertoilette', on: true, day: '2026-09-01' } },
    { t: 'restock.bought', p: { id: 'papiertoilette', day: '2026-09-04', bought: true } },      // + 24 j : 28 septembre, en retard
    { t: 'restock.set', p: { id: 'geldouche', on: false, day: '2026-09-01' } });
  const now = restockFor(a.s, MON, MON, MON);
  assert.deepEqual(now.map(l => [l.id, l.done, l.late]), [['papiertoilette', false, true], ['dentifrice', false, false], ['eponges', true, false]]);
  assert.deepEqual(restockFor(a.s, '2026-10-12', MON, MON).map(l => l.id), []);                // semaine suivante : rien de nouveau
  assert.deepEqual(restockFor(a.s, '2026-10-19', MON, MON).map(l => l.id), ['eponges']);        // éponges : 3 octobre + 21 j = 24 octobre
  assert.deepEqual(restockFor(a.s, '2026-10-26', MON, MON).map(l => l.id), []);                 // une seule semaine, pas les suivantes
  assert.deepEqual(restockFor(a.s, '2026-11-16', MON, MON).map(l => l.id), ['lessive']);
  assert.deepEqual(restockFor(a.s, '2026-09-28', MON, MON), []);                                // semaine passée : rien
});

test('facture du drive : produits suivis reconnus sur le libellé, sans confusion papier WC / nettoyant WC', () => {
  const { a } = household();
  for (const id of ['dentifrice', 'papiertoilette', 'gelwc', 'lessive']) a.emit({ t: 'restock.set', p: { id, on: true, day: MON } });
  const labels = ['AUCHAN Dentifrice protection caries 75ml', 'PAPIER WC DOUX x12', 'Lait demi-écrémé 1L', 'GEL WC JAVEL 750ML', 'Brosse à dents souple'];
  assert.deepEqual(restockFromInvoice(a.s, labels).sort(), ['dentifrice', 'gelwc', 'papiertoilette']);
  assert.deepEqual(restockFromInvoice(a.s, ['PAPIER WC DOUX x12']), ['papiertoilette']);
  assert.deepEqual(restockFromInvoice(a.s, ['Lessive liquide 30 lavages']), ['lessive']);
});

test('événements validés strictement ; produit ajouté par le foyer : nom et fréquence obligatoires', () => {
  assert.ok(validEvent(ev('restock.set', { id: 'dentifrice', on: true, day: MON })));
  assert.ok(validEvent(ev('restock.set', { id: 'pab12cd34', on: true, day: MON, name: 'Croquettes du chat', days: 30 })));
  assert.equal(validEvent(ev('restock.set', { id: 'dentifrice', on: true, day: MON, days: 2 })), null);
  assert.equal(validEvent(ev('restock.set', { id: 'dentifrice', on: true, day: MON, days: 400 })), null);
  assert.equal(validEvent(ev('restock.set', { id: 'Dents!', on: true, day: MON })), null);
  assert.equal(validEvent(ev('restock.set', { id: 'pab12cd34', on: true, day: MON, name: 'x'.repeat(61), days: 30 })), null);
  assert.equal(validEvent(ev('restock.bought', { id: 'dentifrice', day: '2026-13-01', bought: true })), null);
  assert.equal(validEvent(ev('restock.due', { id: 'dentifrice', due: 'demain', day: MON })), null);
  const { a } = household();
  a.emit({ t: 'restock.set', p: { id: 'pab12cd34', on: true, day: MON } },
    { t: 'restock.set', p: { id: 'pab12cd35', on: true, day: MON, name: 'Croquettes', days: null } },
    { t: 'restock.set', p: { id: 'pab12cd36', on: true, day: MON, name: 'Croquettes du chat', days: 30 } },
    { t: 'restock.bought', p: { id: 'inconnu', day: MON, bought: true } });
  assert.deepEqual([...a.r.rejected.values()].map(x => x.reason), ['produit inconnu', 'fréquence à choisir pour un produit ajouté', 'produit non suivi']);
  assert.equal(nextDue(a.s, 'pab12cd36'), '2026-10-20');
  assert.deepEqual(restockFor(a.s, '2026-10-19', MON, MON).map(l => [l.name, l.qty]), [['Croquettes du chat', '']]);
  const [e] = a.emit({ t: 'restock.due', p: { id: 'pab12cd36', due: '2026-10-08', day: MON } });
  assert.equal(describeEvent(a.s, e as never), 'prévoir Croquettes du chat vers le jeu. 8 oct.');
});

test('synchro : deux téléphones, mêmes achats → même date ; l\'achat noté sur l\'un compte pour l\'autre', () => {
  const { a, b } = household();
  a.emit({ t: 'restock.set', p: { id: 'essuietout', on: true, day: '2026-09-01' } });
  b.receive(a);
  b.emit({ t: 'restock.bought', p: { id: 'essuietout', day: '2026-10-01', bought: true } });
  a.receive(b);
  assert.equal(nextDue(a.s, 'essuietout'), nextDue(b.s, 'essuietout'));
  assert.equal(nextDue(a.s, 'essuietout'), '2026-10-21');           // 40 / 2 personnes = 20 jours
});
