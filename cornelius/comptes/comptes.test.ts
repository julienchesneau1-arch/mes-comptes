// Module « comptes » : résumé produit par le core.js de Mes Comptes, lu par le cœur réel de Cornelius.
// Vérifie surtout ce qui protège la tablette partagée : jamais au nom du foyer, jamais à une autre personne.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import type { AddonHttpClient } from '#cornelius/addons';
import { AddonRepository, AddonRuntime, createTestModule, openDatabase, validateAddonDefinition } from '#cornelius/testing';
import { validators } from '#cornelius/validation';
import addon from './index.ts';

const C = createRequire(import.meta.url)('../../core.js');
const NOW = Date.parse('2026-10-20T10:00:00Z');
const CODE: string = C.newCode();
const noNetwork: AddonHttpClient = { fetch: async () => { throw new Error('aucun appel réseau attendu'); } };

async function resume(code = CODE, who = 'p1'): Promise<string> {
  const state = C.demoState('2026-10-20');
  state.budgets.p1 = { restos: 60, courses: 400 };
  state.pots.push({ id: 'velo', owner: 'p1', name: 'Vélo', emoji: '🚲', target: 900, moves: [{ date: '2026-10-02', amount: 150 }] });
  return 'cornelius:' + (await C.sealSummary(C.cornSummary(state, who, '2026-10', new Date(NOW)), code));
}

function personal(t: { after(fn: () => void): void }, config: Record<string, unknown>, secrets: Record<string, string> = { code: CODE }, at = NOW) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  for (const [id, name] of [['alex', 'Alex'], ['sam', 'Sam']] as const) db.prepare('INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)').run(id, name, 0);
  const instances = new AddonRepository(db);
  instances.createInstance({ addonId: addon.id, profileId: 'alex', ref: 'comptes', label: 'Mes comptes', config: { ...addon.configDefaults, ...config }, configVersion: addon.configVersion });
  const runtime = new AddonRuntime({ addons: [addon], instances, http: noNetwork, now: () => at, timeZone: 'Europe/Paris', secrets });
  return (profile: string | null) => runtime.read(addon.id, profile, 'comptes', new AbortController().signal);
}

test('définition acceptée par le chargeur de Cornelius', () => {
  assert.equal(validateAddonDefinition(addon), null);
});

test('source personnelle : reste, budgets, objectifs ; carte conforme ; aucun réseau', async t => {
  const read = personal(t, { resume: await resume() });
  const outcome = await read('alex');
  assert.ok(outcome.ok, !outcome.ok ? outcome.error.message : '');
  assert.ok(validators.moduleCard(outcome.card), JSON.stringify(validators.moduleCard.errors));
  assert.match(outcome.presentation.primaryValue ?? '', /^(Reste|Dépassement de) .+ ce mois-ci$/);
  assert.match(outcome.presentation.summary, /Vélo, 150 € sur 900 €/);
  assert.ok(outcome.card.items.some(i => i.label === 'Restaurants' || i.label === 'Alimentation'));
  assert.doesNotMatch(JSON.stringify(outcome), /CARREFOUR|AUCHAN|NETFLIX|DEMO-|Compte de/); // ni libellé, ni marchand, ni compte
});

test('jamais lue pour une autre personne ni sans personne reconnue', async t => {
  const read = personal(t, { resume: await resume() });
  for (const other of ['sam', null]) {
    const outcome = await read(other);
    assert.equal(outcome.ok, false, `profil ${other} : la source d'Alex ne doit pas être lue`);
  }
});

test('source du foyer : refusée, même avec un résumé valide', async t => {
  const f = createTestModule(t, addon, { at: NOW, config: { resume: await resume() }, secrets: { code: CODE } });
  const outcome = await f.read();
  assert.equal(!outcome.ok && outcome.error.code, 'config_invalid');
  assert.match(!outcome.ok ? outcome.error.message : '', /personnelle/);
});

test('code absent, autre code, résumé abîmé ou étranger : refus explicites', async t => {
  const good = await resume();
  const cases: [Record<string, unknown>, Record<string, string>, string][] = [
    [{ resume: good }, {}, 'config_invalid'],
    [{ resume: good }, { code: C.newCode() }, 'auth'],
    [{ resume: good.slice(0, -8) + 'AAAAAAAA' }, { code: CODE }, 'auth'],
    [{ resume: 'cornelius:mcr1.' + 'A'.repeat(80) }, { code: CODE }, 'auth'],
    [{ resume: 'bonjour, pas un résumé' }, { code: CODE }, 'config_invalid'],
  ];
  for (const [config, secrets, code] of cases) {
    const outcome = await personal(t, config, secrets)('alex');
    assert.equal(!outcome.ok && outcome.error.code, code, JSON.stringify(config).slice(0, 40));
  }
});

test('résumé d’un autre mois ou ancien : dit comme tel', async t => {
  const read = personal(t, { resume: await resume() }, { code: CODE }, Date.parse('2026-11-20T10:00:00Z'));
  const outcome = await read('alex');
  assert.ok(outcome.ok);
  assert.match(outcome.presentation.summary, /Résumé d’octobre 2026, pas du mois en cours/);
  assert.match(outcome.presentation.summary, /date de 31 jours/);
});
