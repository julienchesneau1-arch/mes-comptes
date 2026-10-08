// Rituel batch (courses le samedi, batch le dimanche) et budget : tout vient de ce que le foyer déclare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, MON, NOW } from './helpers.ts';
import { validEvent } from '../src/core/model.ts';
import { DEFAULT_RITUAL, batchView, batchDrafts, defaultIn, miseEnPlace, sharedIngredients, ritualNow, batchStreak, batchDayFor, shopDayFor } from '../src/core/batch.ts';
import { remindersFor } from '../src/core/reminders.ts';
import { deriveToday } from '../src/core/today.ts';
import { weekItems } from '../src/core/ics.ts';
import { slotView } from '../src/core/status.ts';
import { rank } from '../src/core/propose.ts';
import { cartEstimate, weekReport } from '../src/core/budget.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { parseSize, sizeDraft } from '../src/core/drive.ts';
import { eur, parseEuros } from '../src/core/money.ts';

const SUN = '2026-10-04', SAT = '2026-10-03';
const CURRY = content('Curry', 4, ['600 g de poulet', '2 oignons', '300 g riz cru'], { ahead: [{ label: 'Sortir le poulet du congélateur', when: 'veille' }] });
const CHILI = content('Chili', 4, ['500 g de boeuf haché', '2 oignons', '1 poivron'], { tags: ['batch'] });
const GRATIN = content('Gratin', 4, ['1 kg de pommes de terre']);

function planned() {
  const h = household();
  h.a.emit(
    { t: 'settings.set', p: { ritual: DEFAULT_RITUAL } },
    { t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'recipe.save', p: { recipe: 'chili001', content: CHILI } },
    { t: 'recipe.save', p: { recipe: 'gratin01', content: GRATIN } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepcurr', recipe: 'curry001', extra: 0 } },
    { t: 'slot.presence', p: { slot: '2026-10-06|midi', member: 'm1', presence: 'boite' } },
    { t: 'slot.from', p: { slot: '2026-10-06|midi', prep: 'prepcurr' } },
    { t: 'slot.cook', p: { slot: '2026-10-06|soir', prep: 'prepchil', recipe: 'chili001', extra: 0 } },
    { t: 'slot.cook', p: { slot: '2026-10-10|soir', prep: 'prepgrat', recipe: 'gratin01', extra: 0 } },
  );
  return h;
}

test('rituel et batch : événements validés strictement', () => {
  const ev = (t: string, p: unknown) => validEvent({ id: 'evt00001', lc: 1, dev: 'deva0001', by: null, at: NOW.toISOString(), t, p });
  assert.ok(ev('settings.set', { ritual: DEFAULT_RITUAL }));
  assert.ok(ev('settings.set', { ritual: null, budget: 9000 }));
  assert.equal(ev('settings.set', { ritual: { ...DEFAULT_RITUAL, cook: 7 } }), null);
  assert.equal(ev('settings.set', { ritual: { ...DEFAULT_RITUAL, shopAt: '2460' } }), null);
  assert.equal(ev('settings.set', { budget: 0 }), null);
  assert.ok(ev('prep.batch', { prep: 'prepcurr', day: SUN }));
  assert.equal(ev('prep.batch', { prep: 'prepcurr', day: '2026-13-01' }), null);
  assert.ok(ev('shop.spent', { week: MON, cents: 6430 }));
  assert.equal(ev('shop.spent', { week: MON, cents: 12.5 }), null);
  assert.ok(ev('product.set', { key: 'poulet', url: 'https://www.auchan.fr/poulet/pr-C1', label: 'x', size: null, unit: null, price: 499 }));
  assert.equal(ev('product.set', { key: 'poulet', url: 'https://www.auchan.fr/poulet/pr-C1', label: 'x', size: null, unit: null, price: -1 }), null);
});

test('jours du rituel : batch le dimanche avant la semaine, courses le samedi avant le batch', () => {
  assert.equal(batchDayFor(DEFAULT_RITUAL, MON), SUN);
  assert.equal(shopDayFor(DEFAULT_RITUAL, SUN), SAT);
  assert.equal(shopDayFor({ ...DEFAULT_RITUAL, shop: 6 }, SUN), SUN); // drive le matin même
  assert.equal(defaultIn(SUN, MON), true);
  assert.equal(defaultIn(SUN, '2026-10-09'), true);   // vendredi
  assert.equal(defaultIn(SUN, '2026-10-10'), false);  // samedi : cuisiné le jour même par défaut
});

test('batch : plats, portions, contenants, J+n ; un batch après le repas est refusé', () => {
  const { a } = planned();
  const before = batchView(a.s, SUN);
  assert.deepEqual(before.candidates.map(d => d.name), ['Curry', 'Chili', 'Gratin']);
  assert.deepEqual(before.candidates.filter(d => defaultIn(SUN, d.prep.slot?.slice(0, 10) ?? '')).map(d => d.name), ['Curry', 'Chili']);
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr', 'prepchil'], true));
  const v = batchView(a.s, SUN);
  assert.deepEqual(v.dishes.map(d => [d.name, d.portions]), [['Curry', 3], ['Chili', 2]]);
  assert.deepEqual(v.dishes[0]?.serves.map(x => [x.slot, x.n, x.offset, x.boxes, x.containers]), [[`${MON}|soir`, 2, 1, [], 1], ['2026-10-06|midi', 1, 2, ['Alex'], 1]]);
  assert.equal(v.portions, 5);
  assert.equal(v.containers, 3);
  assert.deepEqual(v.candidates.map(d => d.name), ['Gratin']);
  assert.equal(slotView(a.s, `${MON}|soir`, SUN, 12).batch, SUN);
  // Refus : batch après le repas ; plat déjà préparé.
  const [late] = a.emit({ t: 'prep.batch', p: { prep: 'prepgrat', day: '2026-10-11' } });
  assert.match(a.r.rejected.get(late!.id)?.reason ?? '', /avant le repas/);
  // Déplacé avant son batch : le plat sort du batch (il sera cuisiné le jour même).
  a.emit({ t: 'slot.move', p: { from: '2026-10-06|soir', to: '2026-10-03|soir', swap: false } });
  assert.equal(a.s.preps['prepchil']?.batch, null);
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr'], false));
  assert.equal(batchView(a.s, SUN).dishes.length, 0);
});

test('mise en place commune et ingrédients partagés', () => {
  const { a } = planned();
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr', 'prepchil'], true));
  const v = batchView(a.s, SUN);
  // Oignons : 2 pour 4 × 3 portions de curry + 2 pour 4 × 2 portions de chili ; viandes et riz ne sont pas de la mise en place.
  assert.deepEqual(miseEnPlace(a.s, v.dishes), [{ name: 'Oignons', qty: '2,5 pièces', dishes: ['Curry', 'Chili'] }, { name: 'Poivron', qty: '0,5 pièce', dishes: ['Chili'] }]);
  assert.deepEqual(sharedIngredients(a.s, v.dishes), ['oignons']);
});

test('ce que demande le rituel, jour par jour', () => {
  const { a } = planned();
  assert.equal(ritualNow(a.s, '2026-10-01'), null);                       // jeudi : trop tôt
  assert.equal(ritualNow(a.s, '2026-10-02')?.kind, 'choose');             // vendredi : plats prévus, batch pas choisi
  const sat = ritualNow(a.s, SAT);
  assert.equal(sat?.kind, 'courses');
  assert.equal(sat?.kind === 'courses' && sat.menuEmpty, false);
  assert.equal(ritualNow(a.s, SUN)?.kind, 'choose');
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr', 'prepchil'], true));
  assert.equal(ritualNow(a.s, SUN)?.kind, 'batch');
  const empty = household().a;
  empty.emit({ t: 'settings.set', p: { ritual: DEFAULT_RITUAL } });
  assert.equal(ritualNow(empty.s, '2026-10-02')?.kind, 'menu');
  assert.equal(ritualNow(household().a.s, SAT), null);                    // pas de rituel : rien
});

test('rappels du rituel : samedi 17 h les courses, dimanche 9 h le batch ; tâche « la veille » rapportée au batch', () => {
  const { a } = planned();
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr', 'prepchil'], true));
  const sat8 = new Date('2026-10-03T06:00:00Z');
  const list = remindersFor(a.s, sat8).map(r => [r.at, r.title]);
  assert.deepEqual(list.slice(0, 3), [
    ['2026-10-03T15:00:00.000Z', '🛒 Courses du batch à commander'],       // samedi 17 h
    ['2026-10-03T17:00:00.000Z', '⏰ Sortir le poulet du congélateur'],    // samedi 19 h : veille du batch, pas du repas
    ['2026-10-04T07:00:00.000Z', '👩‍🍳 Batch cooking aujourd\'hui'],         // dimanche 9 h
  ]);
  assert.ok(!list.some(([, t]) => /semaine prochaine est vide/.test(t ?? '')));
  assert.match(remindersFor(a.s, sat8).find(r => r.title.startsWith('👩‍🍳'))?.body ?? '', /^2 plats · 5 portions/);
  const ahead = weekItems(a.s, MON, false).find(x => x.title.startsWith('⏰'));
  assert.equal(ahead?.day, SAT);
  assert.match(ahead?.text ?? '', /batch du dim\. 4 oct\./);
  const r = a.r;
  const t = deriveToday(r, new Date('2026-10-03T08:00:00Z'));
  assert.ok(t.tasks.some(x => x.text === 'Sortir le poulet du congélateur' && /batch demain/.test(x.hint)));
  assert.equal(t.ritual?.kind, 'courses');
  const sun = deriveToday(r, new Date('2026-10-04T08:00:00Z'));
  assert.equal(sun.ritual?.kind, 'batch');
  assert.ok(sun.toBuy.some(x => x.label === 'Batch d\'aujourd\'hui' && x.names.includes('Poulet')), JSON.stringify(sun.toBuy));
  a.emit({ t: 'prep.done', p: { prep: 'prepcurr', yield: 3, planned: 3, version: 1 } }, { t: 'prep.done', p: { prep: 'prepchil', yield: 2, planned: 2, version: 1 } });
  assert.deepEqual(deriveToday(a.r, new Date('2026-10-04T15:00:00Z')).toBuy, []); // batch fait : plus rien « pas encore pris » pour ces plats
});

test('propositions : un plat étiqueté « batch » passe devant pour les repas du batch, pas pour les autres', () => {
  const { a } = household();
  a.emit({ t: 'settings.set', p: { ritual: DEFAULT_RITUAL } },
    { t: 'recipe.save', p: { recipe: 'blanq001', content: content('Blanquette', 4, []) } },
    { t: 'recipe.save', p: { recipe: 'chili001', content: CHILI } });
  const wed = rank(a.s, '2026-10-07|soir', SUN)[0];
  assert.equal(wed?.name, 'Chili');
  assert.match(wed?.reason ?? '', /se prépare à l'avance/);
  assert.equal(rank(a.s, '2026-10-10|soir', SUN)[0]?.name, 'Blanquette'); // samedi : hors batch par défaut, ordre alphabétique à égalité
  a.emit({ t: 'settings.set', p: { ritual: null } });
  assert.equal(rank(a.s, '2026-10-07|soir', SUN)[0]?.name, 'Blanquette'); // sans rituel, l'étiquette ne compte pas
});

test('série de batchs réussis', () => {
  const { a } = planned();
  a.emit(...batchDrafts(a.s, SUN, ['prepcurr'], true), { t: 'prep.done', p: { prep: 'prepcurr', yield: 3, planned: 3, version: 1 } });
  assert.equal(batchStreak(a.s, '2026-10-05'), 1);
  assert.equal(batchStreak(a.s, SUN), 1);
  assert.equal(batchStreak(a.s, '2026-10-12'), 0); // dimanche 11 sans batch : série cassée
});

test('budget : panier estimé avec les prix notés seulement, montant payé, coût par portion', () => {
  const { a } = planned();
  const size = parseSize('300 g');
  a.emit({ t: 'product.set', p: { key: 'poulet', url: 'https://www.auchan.fr/poulet-blanc/pr-C1', label: 'Poulet', ...(size ? sizeDraft(size) : { size: null, unit: null }), price: 499 } },
    { t: 'shop.item', p: { week: MON, id: 'item0001', name: 'Café', qty: '1 paquet', aisle: 'epicerie-salee', checked: false, removed: false } });
  const list = deriveShopping(a.s, MON);
  const cart = cartEstimate(a.s, list);
  assert.equal(cart.cents, 2 * 499);          // 450 g de poulet → 2 × 300 g
  assert.equal(cart.priced, 1);
  assert.equal(cart.unpriced, list.lines.length - 1 + 1); // le reste, et le café ajouté à la main
  assert.equal(cart.portions, 3 + 2 + 2);     // curry (3), chili (2), gratin (2)
  assert.equal(cart.perPortion, Math.round(998 / 7));
  // Mise à jour du produit par un téléphone qui ne connaît pas encore le prix : le prix est gardé.
  a.emit({ t: 'product.set', p: { key: 'poulet', url: 'https://www.auchan.fr/poulet-blanc/pr-C1', label: 'Poulet fermier', size: null, unit: null } });
  assert.equal(a.s.products['poulet']?.price, 499);
  a.emit({ t: 'shop.spent', p: { week: MON, cents: 6430 } });
  const rep = weekReport(a.r, MON);
  assert.equal(rep.spent, 6430);
  assert.equal(rep.home, 2 + 1 + 2 + 2);       // lundi soir, mardi midi (boîte), mardi soir, samedi soir
  assert.equal(rep.perPortion, Math.round(6430 / 7));
  a.emit({ t: 'shop.spent', p: { week: MON, cents: null } });
  assert.equal(a.s.shop[MON]?.spent, undefined);
});

test('jeté compté dans la semaine où il est déclaré', () => {
  const { a } = planned();
  a.emit({ t: 'prep.done', p: { prep: 'prepcurr', yield: 3, planned: 3, version: 1 } }, { t: 'prep.discard', p: { prep: 'prepcurr', n: 1, reason: 'jeté' } },
    { t: 'prep.discard', p: { prep: 'prepcurr', n: 1, reason: 'mangé hors planning' } });
  assert.equal(weekReport(a.r, '2026-09-28').thrown, 1); // déclaré le dimanche 4 octobre
});

test('euros : centimes exacts, saisie française', () => {
  assert.equal(eur(123456), '1 234,56 €');
  assert.equal(eur(5), '0,05 €');
  assert.equal(parseEuros('64,3'), 6430);
  assert.equal(parseEuros('64.30 €'), 6430);
  assert.equal(parseEuros(' 12 euros'), 1200);
  assert.equal(parseEuros('0'), null);
  assert.equal(parseEuros('douze'), null);
  assert.equal(parseEuros('12,345'), null);
});
