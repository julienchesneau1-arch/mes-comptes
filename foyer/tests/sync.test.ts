import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, MON } from './helpers.ts';
import { seal, open, merge, newCode, validCode, extractSealed, exportBackup, readBackup, SyncError } from '../src/core/sync.ts';
import { replay } from '../src/core/reduce.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { portions } from '../src/core/plan.ts';

const snapshot = (log: Parameters<typeof replay>[0]) => JSON.stringify(replay(log).state, (_, v) => (v instanceof Set ? [...v].sort() : v));

function planned() {
  const h = household();
  h.a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'slot.presence', p: { slot: '2026-10-06|midi', member: 'm1', presence: 'boite' } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prep0001', recipe: 'curry001', extra: 1 } },
    { t: 'slot.from', p: { slot: '2026-10-06|midi', prep: 'prep0001' } },
    { t: 'prep.done', p: { prep: 'prep0001', yield: 4, planned: 4, version: 1 } });
  return h;
}

test('lien chiffré : aller-retour, mauvais code refusé, autre foyer refusé', async () => {
  const { a } = planned();
  const code = newCode();
  assert.ok(validCode(code));
  const sealed = await seal({ app: 'foyer', v: 1, hid: 'foyer0001', from: a.dev, sent: '', events: a.log }, code);
  assert.ok(!sealed.includes('Curry') && !sealed.includes('poulet'));
  assert.equal(extractSealed(`🔄 Foyer\nhttps://exemple.github.io/foyer/#s=${sealed}`), sealed);
  const b = await open(sealed, code.toLowerCase().replace(/-/g, ' '));
  assert.equal(b.events.length, a.log.length);
  await assert.rejects(open(sealed, newCode()), (e: unknown) => e instanceof SyncError && e.code === 'code');
  await assert.rejects(open(sealed.slice(0, 60), code), (e: unknown) => e instanceof SyncError);
  assert.throws(() => merge(a.log, 'autre0001', b), (e: unknown) => e instanceof SyncError && e.code === 'foyer');
});

test('fusion : union idempotente, événements invalides écartés, un nouveau téléphone rejoint le foyer', async () => {
  const { a } = planned();
  const bundle = { app: 'foyer' as const, v: 1 as const, hid: 'foyer0001', from: a.dev, sent: '', events: [...a.log, { id: 'x', t: 'slot.cook' }, { ...a.log[1], p: { recipe: 'curry001', content: { name: '<img src=x onerror=alert(1)>'.repeat(20) } } }] };
  const fresh = merge([], null, bundle as never);
  assert.equal(fresh.added, a.log.length);
  assert.equal(fresh.invalid, 2);
  const again = merge(fresh.log, 'foyer0001', bundle as never);
  assert.equal(again.added, 0);
  assert.equal(snapshot(again.log), snapshot(a.log));
});

test('restauration : export puis import sur un appareil vierge → mêmes liens, quantités et portions', () => {
  const { a } = planned();
  const l = deriveShopping(a.s, MON).lines[0]!;
  a.emit({ t: 'shop.pantry', p: { week: MON, key: l.key, qty: '200', needAt: l.needAt } }, { t: 'slot.eaten', p: { slot: `${MON}|soir`, n: 2 } });
  const file = exportBackup(a.log, 'foyer0001', a.dev, new Date('2026-10-05T20:00:00Z'));
  const restored = merge([], null, readBackup(file));
  assert.equal(snapshot(restored.log), snapshot(a.log));
  const s = replay(restored.log).state;
  assert.deepEqual(deriveShopping(s, MON).lines.map(x => [x.name, x.toBuy]), deriveShopping(a.s, MON).lines.map(x => [x.name, x.toBuy]));
  assert.deepEqual(portions(s, s.preps['prep0001']!), portions(a.s, a.s.preps['prep0001']!));
  assert.throws(() => readBackup('{"app":"autre"}'), SyncError);
});
