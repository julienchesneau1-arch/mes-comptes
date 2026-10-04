// Exemples de référence du PRD (§13), rejoués exactement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, MON, Device } from './helpers.ts';
import { deriveShopping, lineQty, checkSig } from '../src/core/shopping.ts';
import { portions, servings } from '../src/core/plan.ts';
import { openConflicts, replay } from '../src/core/reduce.ts';
import { q } from '../src/core/rational.ts';
import type { State } from '../src/core/model.ts';

const MON_SOIR = `${MON}|soir`, TUE_MIDI = '2026-10-06|midi';

// EX-01 : Curry préparé lundi soir pour 4 : 2 au dîner, 1 boîte mardi midi, 1 sans destination.
function ex01() {
  const h = household();
  h.a.emit(
    { t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'slot.presence', p: { slot: TUE_MIDI, member: 'm1', presence: 'boite' } }, // Alex emporte une boîte mardi midi
    { t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prep0001', recipe: 'curry001', extra: 1 } },
    { t: 'slot.from', p: { slot: TUE_MIDI, prep: 'prep0001' } },
  );
  return h;
}
const line = (s: State, name: string) => deriveShopping(s, MON).lines.find(l => l.name === name);

test('EX-01 : une seule ligne par ingrédient, portions comptées à la source', () => {
  const { a } = ex01();
  const s = a.s;
  assert.equal(servings(s, MON_SOIR), 2);
  assert.equal(servings(s, TUE_MIDI), 1);
  const pt = portions(s, s.preps['prep0001']!);
  assert.deepEqual([pt.planned, pt.serve, pt.linked, pt.extra, pt.declared, pt.free], [4, 2, 1, 1, null, null]); // rien de disponible avant déclaration
  const list = deriveShopping(s, MON);
  assert.equal(list.lines.length, 3); // aucune seconde ligne « curry » pour la boîte
  assert.equal(lineQty(line(s, 'Poulet')!), '600 g');
  assert.equal(lineQty(line(s, 'Riz')!), '300 g');
  assert.equal(line(s, 'Riz')!.form, 'cru');
  assert.equal(lineQty(line(s, 'Lait de coco')!), '400 ml');
  assert.equal(list.incomplete.length, 0);
});

test('EX-01 : vérification ponctuelle, invalidée si le besoin change, reconfirmée sans hériter', () => {
  const { a } = ex01();
  let l = line(a.s, 'Poulet')!;
  a.emit({ t: 'shop.pantry', p: { week: MON, key: l.key, qty: '200', needAt: l.needAt } });
  l = line(a.s, 'Poulet')!;
  assert.equal(lineQty(l), '400 g');
  assert.equal(l.pantry?.active, true);
  // Préparer 6 portions : 3 sans destination.
  a.emit({ t: 'prep.extra', p: { prep: 'prep0001', extra: 3 } });
  assert.equal(lineQty(line(a.s, 'Poulet')!, 'need'), '900 g');
  assert.equal(lineQty(line(a.s, 'Riz')!, 'need'), '450 g');
  assert.equal(lineQty(line(a.s, 'Lait de coco')!, 'need'), '600 ml');
  l = line(a.s, 'Poulet')!;
  assert.equal(l.pantry?.active, false); // « à revérifier » : n'est plus déduite
  assert.equal(lineQty(l), '900 g');
  a.emit({ t: 'shop.pantry', p: { week: MON, key: l.key, qty: '200', needAt: l.needAt } });
  assert.equal(lineQty(line(a.s, 'Poulet')!), '700 g');
  // Semaine suivante : aucune déduction héritée.
  const next = deriveShopping(a.s, '2026-10-12');
  assert.equal(next.lines.length, 0);
});

test('EX-01 : « pris » couvre le besoin coché ; un besoin qui grandit montre seulement l\'écart', () => {
  const { a } = ex01();
  let l = line(a.s, 'Poulet')!;
  a.emit({ t: 'shop.check', p: { week: MON, key: l.key, needAt: checkSig(l) } });
  assert.equal(line(a.s, 'Poulet')!.done, true);
  a.emit({ t: 'prep.extra', p: { prep: 'prep0001', extra: 3 } });
  l = line(a.s, 'Poulet')!;
  assert.equal(l.done, false);
  assert.deepEqual(l.check?.delta, q(300));
  a.emit({ t: 'prep.extra', p: { prep: 'prep0001', extra: 0 } }); // besoin réduit : reste coché
  assert.equal(line(a.s, 'Poulet')!.done, true);
});

test('EX-02 : rendement réel 3 au lieu de 4, réservations tenues, plus de portion libre', () => {
  const { a } = ex01();
  a.emit({ t: 'prep.done', p: { prep: 'prep0001', yield: 3, planned: 4, version: 1 } });
  let pt = portions(a.s, a.s.preps['prep0001']!);
  assert.deepEqual([pt.declared, pt.reserved, pt.free], [3, 3, 0]);
  const eaten = a.emit({ t: 'slot.eaten', p: { slot: MON_SOIR, n: 2 } });
  pt = portions(a.s, a.s.preps['prep0001']!);
  assert.deepEqual([pt.remaining, pt.reserved, pt.free], [1, 1, 0]); // la dernière est réservée à la boîte
  // Même commande rejouée : aucun second mouvement.
  a.log.push(...eaten);
  assert.equal(portions(a.s, a.s.preps['prep0001']!).eaten, 2);
  // Nouvelle déclaration du même repas : ignorée sans conflit.
  a.emit({ t: 'slot.eaten', p: { slot: MON_SOIR, n: 2 } });
  assert.equal(portions(a.s, a.s.preps['prep0001']!).eaten, 2);
  assert.equal(openConflicts(a.r).length, 0);
});

test('EX-02 : deux personnes prennent la dernière portion : une seule réservation valide, la même sur les deux téléphones', () => {
  const { a, b } = ex01();
  a.emit({ t: 'prep.done', p: { prep: 'prep0001', yield: 4, planned: 4, version: 1 } });
  b.receive(a);
  assert.equal(portions(b.s, b.s.preps['prep0001']!).free, 1);
  a.emit({ t: 'slot.presence', p: { slot: '2026-10-07|midi', member: 'm1', presence: 'boite' } },
    { t: 'slot.from', p: { slot: '2026-10-07|midi', prep: 'prep0001' } });
  b.emit({ t: 'slot.presence', p: { slot: '2026-10-08|midi', member: 'm2', presence: 'boite' } },
    { t: 'slot.from', p: { slot: '2026-10-08|midi', prep: 'prep0001' } });
  a.receive(b); b.receive(a);
  const ra = a.r, rb = b.r;
  assert.deepEqual(Object.keys(ra.state.slots).sort(), Object.keys(rb.state.slots).sort());
  const conflicts = openConflicts(ra);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0]!.reason, /plus assez de portions libres/);
  assert.equal(portions(ra.state, ra.state.preps['prep0001']!).free, 0); // jamais négatif
  assert.deepEqual(openConflicts(rb).map(c => c.id), conflicts.map(c => c.id));
});

test('portions : jamais de stock négatif ; correction incompatible refusée', () => {
  const { a } = ex01();
  a.emit({ t: 'prep.done', p: { prep: 'prep0001', yield: 2, planned: 4, version: 1 } });
  const pt = portions(a.s, a.s.preps['prep0001']!);
  assert.equal(pt.free, -1); // il manque une portion : signalé, l'utilisateur choisit quel repas modifier
  a.emit({ t: 'slot.eaten', p: { slot: MON_SOIR, n: 2 } });
  const [bad] = a.emit({ t: 'slot.eaten', p: { slot: TUE_MIDI, n: 1 } });
  assert.match(a.r.rejected.get(bad!.id)!.reason, /il ne reste que 0/);
  const [corr] = a.emit({ t: 'prep.correct', p: { prep: 'prep0001', yield: 1, reason: 'erreur' } });
  assert.match(a.r.rejected.get(corr!.id)!.reason, /incompatible/);
});

test('annuler rejoue sans l\'événement ; un plat retiré après préparation garde ses portions', () => {
  const { a } = ex01();
  const [done] = a.emit({ t: 'prep.done', p: { prep: 'prep0001', yield: 4, planned: 4, version: 1 } });
  a.emit({ t: 'undo', p: { event: done!.id } });
  assert.equal(a.s.preps['prep0001']!.done, null);
  a.emit({ t: 'prep.done', p: { prep: 'prep0001', yield: 4, planned: 4, version: 1 } });
  a.emit({ t: 'slot.clear', p: { slot: MON_SOIR } });
  const prep = a.s.preps['prep0001']!;
  assert.equal(prep.slot, null);
  assert.equal(portions(a.s, prep).free, 3); // 4 déclarées − 1 réservée pour la boîte
});

test('concurrence d\'édition : deux plats posés sur le même créneau, pas de « dernier clic gagnant »', () => {
  const { a, b } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } });
  b.receive(a);
  a.emit({ t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prepaaaa', recipe: 'curry001', extra: 0 } });
  b.emit({ t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prepbbbb', recipe: 'curry001', extra: 0 } });
  a.receive(b); b.receive(a);
  assert.equal(a.s.slots[MON_SOIR]!.dish?.kind, 'cook');
  assert.equal(openConflicts(a.r).length, 1);
  assert.match(openConflicts(a.r)[0]!.reason, /déjà occupé par Curry/);
  assert.deepEqual(openConflicts(b.r).map(x => x.id), openConflicts(a.r).map(x => x.id));
});

test('rejeu indépendant de l\'ordre de réception', () => {
  const { a, b } = ex01();
  b.receive(a);
  b.emit({ t: 'slot.guests', p: { slot: MON_SOIR, guests: 2 } });
  a.emit({ t: 'prep.extra', p: { prep: 'prep0001', extra: 2 } });
  const c = new Device('devc0003', null);
  c.log = [...b.log, ...a.log].reverse();
  a.receive(b);
  assert.deepEqual(JSON.stringify(replay(c.log).state, (_, v) => (v instanceof Set ? [...v] : v)),
    JSON.stringify(a.s, (_, v) => (v instanceof Set ? [...v] : v)));
});
