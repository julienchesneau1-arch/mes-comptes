// EX-03 (dates), EX-04 (déplacement), EX-05 (incomplet et copie), propositions et écran Aujourd'hui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, MON, content } from './helpers.ts';
import { watchView, linkChecks, declVsDay } from '../src/core/watch.ts';
import type { WatchItem } from '../src/core/model.ts';
import { move, removeDish, eat, setDish } from '../src/core/commands.ts';
import { previewChange } from '../src/core/preview.ts';
import { problems } from '../src/core/status.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { proposeWeek, copyWeek, acceptDrafts, rank } from '../src/core/propose.ts';
import { deriveToday } from '../src/core/today.ts';
import { replay } from '../src/core/reduce.ts';
import { portions } from '../src/core/plan.ts';

const MON_SOIR = `${MON}|soir`, TUE_MIDI = '2026-10-06|midi';
const item = (over: Partial<WatchItem>): WatchItem => ({ id: 'poulet01', name: 'Poulet', qty: '', date: { kind: 'DLC', value: '2026-10-08' }, state: 'ferme',
  slot: null, closed: null, by: 'm1', at: '2026-10-04T10:00:00Z', ...over });

test('EX-03 : DLC déclarée face au repas lié ; rien de plus n\'est garanti', () => {
  const c9 = linkChecks(item({}), '2026-10-09|soir', '2026-10-04');
  assert.equal(c9[0]?.level, 'conflit');
  const c8 = linkChecks(item({}), '2026-10-08|soir', '2026-10-04');
  assert.equal(c8[0]?.level, 'info');
  assert.match(c8[0]!.text, /Seul contrôle effectué, pas une garantie/);
  assert.equal(linkChecks(item({ state: 'ouvert' }), '2026-10-08|soir', '2026-10-04')[0]?.level, 'manque');
  assert.equal(linkChecks(item({ date: null }), '2026-10-08|soir', '2026-10-04')[0]?.level, 'manque');
  // DDM « octobre 2026 » : précision mois conservée, pas de jour inventé au 31.
  const ddm = item({ date: { kind: 'DDM', value: '2026-10' } });
  assert.equal(declVsDay(ddm.date!, '2026-10-31'), 'meme');
  assert.equal(declVsDay(ddm.date!, '2026-11-01'), 'avant');
  assert.equal(watchView(ddm, '2026-10-31').checks.length, 0);
  assert.equal(watchView(item({}), '2026-10-09').checks[0]?.level, 'conflit');
  assert.equal(watchView(item({ date: null }), '2026-10-04').headline, 'Date à renseigner');
});

test('EX-03 : dans le planning, un produit lié à un repas après sa DLC est un problème visible', () => {
  const { a } = household();
  a.emit({ t: 'watch.save', p: { id: 'poulet01', name: 'Poulet', qty: '', date: { kind: 'DLC', value: '2026-10-08' }, state: 'ferme', slot: '2026-10-09|soir' } });
  assert.ok(problems(a.r, '2026-10-04', 12).some(p => p.level === 'conflit' && /après sa DLC/.test(p.text)));
});

function ex04() {
  const h = household();
  h.a.emit(
    { t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'slot.presence', p: { slot: TUE_MIDI, member: 'm1', presence: 'boite' } },
    { t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prep0001', recipe: 'curry001', extra: 1 } },
    { t: 'slot.from', p: { slot: TUE_MIDI, prep: 'prep0001' } },
  );
  return h;
}

test('EX-04 : déplacer la préparation après la boîte qui en dépend → conflit affiché, deux résolutions explicites', () => {
  const { a } = ex04();
  const ctx = { dev: a.dev, by: a.by, lc: a.r.maxLc, now: new Date('2026-10-04T10:00:00Z') };
  const WED_SOIR = '2026-10-07|soir';
  // Garder : l'opération n'est pas présentée comme validée.
  const keep = previewChange(a.log, ctx, move(a.s, MON_SOIR, WED_SOIR, false, 'keep'), '2026-10-04', 12);
  assert.equal(keep.blocked, false);
  assert.ok(keep.impacts.some(i => i.level === 'conflit' && /dépend de Curry, prévu plus tard/.test(i.text)));
  // Décaler aussi la boîte : les deux modifications sont visibles avant validation.
  const follow = previewChange(a.log, ctx, move(a.s, MON_SOIR, WED_SOIR, false, 'follow'), '2026-10-04', 12);
  assert.ok(follow.impacts.some(i => /Mardi midi : Curry → rien/.test(i.text)));
  assert.ok(follow.impacts.some(i => /Jeudi midi : rien → Curry/.test(i.text)));
  assert.ok(!follow.impacts.some(i => i.level === 'conflit'));
  // Détacher : la boîte est vidée, le curry passe à 3 portions.
  const detach = previewChange(a.log, ctx, move(a.s, MON_SOIR, WED_SOIR, false, 'detach'), '2026-10-04', 12);
  assert.ok(detach.impacts.some(i => /préparer 4 → 3 portions/.test(i.text)));
});

test('imprévu : supprimer un repas n\'efface ni les portions préparées ni les articles déjà pris', () => {
  const { a } = ex04();
  const l = deriveShopping(a.s, MON).lines.find(x => x.name === 'Poulet')!;
  a.emit({ t: 'shop.check', p: { week: MON, key: l.key, needAt: l.needAt } });
  a.emit(...eat(a.s, MON_SOIR, 4) as never[]);
  const ctx = { dev: a.dev, by: a.by, lc: a.r.maxLc, now: new Date('2026-10-04T10:00:00Z') };
  const pv = previewChange(a.log, ctx, removeDish(a.s, TUE_MIDI), '2026-10-04', 12);
  assert.ok(!pv.blocked);
  a.log.push(...pv.events);
  const prep = a.s.preps['prep0001']!;
  assert.equal(portions(a.s, prep).free, 2); // 4 déclarées − 2 mangées ; la boîte libérée rend sa portion
  assert.ok(a.s.shop[MON]!.checked[l.key]); // la coche « pris » reste
});

test('cible occupée : échanger les deux repas, vérifié des deux côtés', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } }, { t: 'recipe.save', p: { recipe: 'tacos001', content: content('Tacos', null, []) } });
  a.emit(...setDish(a.s, MON_SOIR, 'curry001'));
  a.emit(...setDish(a.s, '2026-10-06|soir', 'tacos001'));
  const [mv] = a.emit(...move(a.s, MON_SOIR, '2026-10-06|soir', false));
  assert.match(a.r.rejected.get(mv!.id)!.reason, /occupé par Tacos/);
  a.emit(...move(a.s, MON_SOIR, '2026-10-06|soir', true));
  const names = (k: string) => { const d = a.s.slots[k]?.dish; return d?.kind === 'cook' ? a.s.recipes[a.s.preps[d.prep]!.recipe]!.versions[0]!.name : null; };
  assert.equal(names(MON_SOIR), 'Tacos');
  assert.equal(names('2026-10-06|soir'), 'Curry');
});

test('EX-05 : plat sans ingrédients autorisé, liste explicitement partielle ; copie en brouillon sans états', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'tacos001', content: content('Tacos', null, []) } }, { t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } });
  a.emit(...setDish(a.s, MON_SOIR, 'tacos001'), ...setDish(a.s, '2026-10-06|soir', 'curry001'),
    { t: 'slot.presence', p: { slot: '2026-10-07|soir', member: 'm2', presence: 'dehors' } });
  const list = deriveShopping(a.s, MON);
  assert.deepEqual(list.incomplete.map(x => x.name), ['Tacos']);
  assert.equal(list.lines.length, 3);
  const poulet = list.lines.find(l => l.name === 'Poulet')!;
  a.emit({ t: 'shop.check', p: { week: MON, key: poulet.key, needAt: poulet.needAt } }, { t: 'shop.pantry', p: { week: MON, key: poulet.key, qty: 'all', needAt: poulet.needAt } });
  a.emit(...eat(a.s, MON_SOIR, null) as never[]);
  a.emit({ t: 'watch.save', p: { id: 'creme001', name: 'Crème', qty: '', date: { kind: 'DLC', value: '2026-10-09' }, state: 'ferme', slot: MON_SOIR } });
  const { proposals } = copyWeek(a.s, MON, '2026-10-12');
  assert.deepEqual(proposals.map(p => [p.slot, p.dish?.kind ?? null]), [['2026-10-12|soir', 'cook'], ['2026-10-13|soir', 'cook'], ['2026-10-14|soir', null]]);
  a.emit(...acceptDrafts(a.s, proposals));
  const s = a.s;
  const copied = s.slots['2026-10-12|soir']!;
  assert.equal(copied.eaten, null);
  const prep = s.preps[(copied.dish as { prep: string }).prep]!;
  assert.equal(prep.done, null);
  assert.equal(s.slots['2026-10-14|soir']!.presence['m2'], 'dehors');
  assert.equal(s.shop['2026-10-12'], undefined);
  assert.ok(!Object.values(s.watch).some(w => w.slot?.startsWith('2026-10-1') && w.slot >= '2026-10-12'));
});

test('proposer la semaine : vos plats seulement, rotation expliquée, boîtes reliées au dîner de la veille', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: { ...CURRY, tags: ['rapide'] } } },
    { t: 'recipe.save', p: { recipe: 'lasagn01', content: content('Lasagnes', 6, ['500 g de bœuf haché'], { tags: ['week-end'] }) } },
    { t: 'recipe.save', p: { recipe: 'soupe001', content: content('Soupe', 4, ['1 kg de carottes']) } },
    { t: 'slot.presence', p: { slot: TUE_MIDI, member: 'm1', presence: 'boite' } });
  const props = proposeWeek(a.s, MON, '2026-10-04', 12);
  const soirs = props.filter(p => p.slot.endsWith('soir'));
  assert.equal(soirs.length, 3); // trois plats, pas de doublon dans la semaine
  assert.equal(new Set(soirs.map(p => p.dish?.kind === 'cook' && p.dish.recipe)).size, 3);
  assert.equal(soirs[0]?.dish?.kind === 'cook' && soirs[0].dish.recipe, 'curry001'); // lundi soir : « rapide » en semaine
  const box = props.find(p => p.slot === TUE_MIDI)!;
  assert.deepEqual(box.dish, { kind: 'from', source: MON_SOIR, prep: null });
  a.emit(...acceptDrafts(a.s, props));
  assert.equal(portions(a.s, Object.values(a.s.preps).find(p => p.slot === MON_SOIR)!).planned, 3);
  // Produit surveillé à utiliser : le plat qui le contient remonte, avec la raison.
  a.emit({ t: 'watch.save', p: { id: 'carot001', name: 'Carottes', qty: '', date: { kind: 'DLC', value: '2026-10-13' }, state: 'ferme', slot: null } });
  const r = rank(a.s, '2026-10-12|soir', '2026-10-11');
  assert.equal(r[0]?.name, 'Soupe');
  assert.match(r[0]!.reason, /utilise carottes/);
});

test('Aujourd\'hui : ce soir, demain midi, tâches renseignées, courses manquantes, idées si rien de prévu', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: { ...CURRY, ahead: [{ label: 'Sortir le poulet du congélateur', when: 'veille' }] } } },
    { t: 'recipe.save', p: { recipe: 'omelet01', content: content('Omelette', 2, ['6 œufs'], { tags: ['rapide'] }) } },
    { t: 'slot.presence', p: { slot: TUE_MIDI, member: 'm1', presence: 'boite' } },
    { t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prep0001', recipe: 'curry001', extra: 1 } },
    { t: 'slot.from', p: { slot: TUE_MIDI, prep: 'prep0001' } });
  const sunday = deriveToday(a.r, new Date('2026-10-04T16:00:00Z')); // dimanche 18 h
  assert.equal(sunday.cards[0]?.label, 'Ce soir');
  assert.equal(sunday.cards[0]?.view.status, 'vide');
  assert.ok(sunday.ideas);
  assert.deepEqual(sunday.ideas?.recipes.map(x => x.name), ['Omelette']); // le curry, déjà prévu demain, n'est pas reproposé ce soir
  assert.deepEqual(sunday.tasks.map(t => t.text), ['Sortir le poulet du congélateur']);
  const monday = deriveToday(a.r, new Date('2026-10-05T16:00:00Z')); // lundi 18 h
  assert.deepEqual(monday.cards.map(c => c.label), ['Ce soir', 'Demain midi']);
  assert.equal(monday.cards[0]?.detail, 'Préparer 4 portions : 2 ce soir, 1 pour demain midi (boîte Alex), 1 en plus');
  assert.ok(monday.tasks.some(t => t.text === 'Préparer la boîte de Alex'));
  assert.deepEqual(monday.toBuy[0]?.names.sort(), ['Lait de coco', 'Poulet', 'Riz']);
  // Rien n'est confirmé parce que le temps passe : mardi, le dîner de lundi est « passé, non confirmé ».
  const tuesday = deriveToday(a.r, new Date('2026-10-06T08:00:00Z'));
  assert.equal(tuesday.cards[0]?.view.status, 'attend');
  assert.equal(replay(a.log).state.slots[MON_SOIR]!.eaten, null);
});

test('échanger un dîner avec la boîte qui en dépend : rien n\'est décalé en douce, le problème est visible', () => {
  const { a } = ex04();
  const ctx = { dev: a.dev, by: a.by, lc: a.r.maxLc, now: new Date('2026-10-04T10:00:00Z') };
  const drafts = move(a.s, MON_SOIR, TUE_MIDI, true, 'follow');
  assert.equal(drafts.filter(d => d.t === 'slot.move').length, 1);
  const pv = previewChange(a.log, ctx, drafts, '2026-10-04', 12);
  assert.ok(pv.impacts.some(i => i.level === 'conflit' && /dépend de Curry, prévu plus tard/.test(i.text)));
  // Déplacer vers mercredi soir en décalant la boîte : mardi midi → jeudi midi.
  const follow = move(a.s, MON_SOIR, '2026-10-07|soir', false, 'follow');
  assert.deepEqual(follow.map(d => d.t === 'slot.move' ? [d.p.from, d.p.to] : d.t), [[MON_SOIR, '2026-10-07|soir'], [TUE_MIDI, '2026-10-08|midi']]);
});

test('« plat entier » : on prépare toute la recette, le surplus est compté en plus (pas 0,33 boîte de tomates)', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'lasagn01', content: content('Lasagnes', 6, ['500 g de bœuf haché', '1 boîte de tomates'], { tags: ['plat entier'] }) } });
  a.emit(...setDish(a.s, '2026-10-10|soir', 'lasagn01'));
  const prep = Object.values(a.s.preps)[0]!;
  assert.deepEqual([portions(a.s, prep).serve, prep.extra, portions(a.s, prep).planned], [2, 4, 6]);
  const l = deriveShopping(a.s, MON).lines.map(x => [x.name, x.need && x.need.n / x.need.d]);
  assert.deepEqual(l.sort(), [['Bœuf haché', 500], ['Tomates', 1]]);
  // Par proposition, avec une boîte le lendemain : 6 = 2 + 1 + 3 en plus.
  const { a: b } = household();
  b.emit({ t: 'recipe.save', p: { recipe: 'lasagn01', content: content('Lasagnes', 6, ['500 g de bœuf haché'], { tags: ['plat entier'] }) } },
    { t: 'slot.presence', p: { slot: '2026-10-06|midi', member: 'm1', presence: 'boite' } });
  b.emit(...acceptDrafts(b.s, [
    { slot: MON_SOIR, dish: { kind: 'cook', recipe: 'lasagn01', extra: 0 }, reason: '', presence: {}, guests: 0 },
    { slot: TUE_MIDI, dish: { kind: 'from', source: MON_SOIR, prep: null }, reason: '', presence: {}, guests: 0 }]));
  const p2 = Object.values(b.s.preps)[0]!;
  assert.deepEqual([portions(b.s, p2).serve, portions(b.s, p2).linked, p2.extra], [2, 1, 3]);
});

import { weekIcs, weekItems } from '../src/core/ics.ts';
import { aisleRank } from '../src/core/shopping.ts';
test('propositions : varier la viande d\'un jour à l\'autre, réutiliser les produits frais déjà achetés', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'recipe.save', p: { recipe: 'poulet02', content: content('Poulet rôti', 4, ['1 poulet', '1 kg de pommes de terre']) } },
    { t: 'recipe.save', p: { recipe: 'tarte001', content: content('Tarte poireaux', 4, ['3 poireaux', '20 cl de crème fraîche']) } },
    { t: 'recipe.save', p: { recipe: 'gratin01', content: content('Gratin', 4, ['1 kg de pommes de terre', '20 cl de crème fraîche']) } });
  a.emit(...setDish(a.s, MON_SOIR, 'curry001'));
  // Mardi soir : pas de poulet deux jours de suite.
  const tue = rank(a.s, '2026-10-06|soir', '2026-10-04');
  assert.notEqual(tue[0]?.recipe, 'poulet02');
  assert.ok(tue.findIndex(x => x.recipe === 'poulet02') > tue.findIndex(x => x.recipe === 'gratin01'));
  // Mercredi : la tarte prévue utilise de la crème ; le gratin, qui en reprend, remonte avec la raison.
  a.emit(...setDish(a.s, '2026-10-07|soir', 'tarte001'));
  const thu = rank(a.s, '2026-10-08|soir', '2026-10-04');
  assert.equal(thu[0]?.recipe, 'gratin01');
  assert.match(thu[0]!.reason, /réutilise crème fraîche/);
});

test('qui cuisine, ordre des rayons du magasin, rappels agenda (.ics)', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: { ...CURRY, ahead: [{ label: 'Sortir le poulet du congélateur', when: 'veille' }] } } },
    { t: 'slot.presence', p: { slot: TUE_MIDI, member: 'm1', presence: 'boite' } },
    { t: 'slot.cook', p: { slot: MON_SOIR, prep: 'prep0001', recipe: 'curry001', extra: 0 } },
    { t: 'slot.from', p: { slot: TUE_MIDI, prep: 'prep0001' } },
    { t: 'slot.chef', p: { slot: MON_SOIR, member: 'm2' } },
    { t: 'settings.set', p: { aisleOrder: ['epicerie', 'boucherie'] } });
  assert.equal(a.s.slots[MON_SOIR]!.chef, 'm2');
  const [bad] = a.emit({ t: 'slot.chef', p: { slot: MON_SOIR, member: 'inconnu' } });
  assert.match(a.r.rejected.get(bad!.id)!.reason, /membre inconnu/);
  assert.deepEqual(deriveShopping(a.s, MON).lines.map(l => l.aisle), ['epicerie', 'epicerie', 'boucherie']);
  assert.equal(aisleRank(a.s).get('fruits-legumes'), 2);
  const items = weekItems(a.s, MON, true);
  assert.deepEqual(items.map(x => [x.day, x.time, x.title]), [
    ['2026-10-04', '1900', '⏰ Sortir le poulet du congélateur'],
    ['2026-10-05', '1930', '🍽️ Curry'],
    ['2026-10-05', '2100', '🥡 Boîte de Alex'],
    ['2026-10-06', '1230', '🍽️ Restes : Curry']]);
  const ics = weekIcs(a.s, MON, false, new Date('2026-10-04T10:00:00Z'), 'https://exemple/foyer/');
  assert.match(ics, /DTSTART:20261004T190000\r\n/);
  assert.match(ics, /UID:foyer-tache-prep0001-0@foyer/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.doesNotMatch(ics, /Restes : Curry/); // rappels seulement
  assert.ok(ics.split('\r\n').every(l => l.length < 300));
});
