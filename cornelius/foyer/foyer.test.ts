// Module « foyer » contre un relais simulé : même table, même règle d'accès par étiquette (x-foyer),
// blocs chiffrés par le code de Foyer lui-même. Prouve le module ; ne prouve pas le service Supabase réel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddonHttpRequest } from '#cornelius/addons';
import { createTestModule, validateAddonDefinition } from '#cornelius/testing';
import addon from './index.ts';
import { relayKeys, sealEvents } from '../../foyer/src/core/relay.ts';
import { demoLog } from '../../foyer/src/ui/demo.ts';
import { RELAY } from '../../foyer/src/ui/config.ts';

const CODE = 'ABCD-EFGH-JKLM';
const TABLE = `${RELAY!.url}/rest/v1/foyer_relais?`;
const NOW = Date.parse('2026-10-21T16:00:00Z'); // 18 h à Paris : « ce soir », puis « demain midi »
type Row = { seq: number; blob: string };

async function relay(code = CODE): Promise<{ tag: string; rows: Row[] }> {
  const k = await relayKeys(code);
  const log = demoLog(new Date(NOW));
  // Deux téléphones, deux blocs ; un événement en double dans le second (union idempotente).
  return { tag: k.tag, rows: [{ seq: 1, blob: await sealEvents(k, log.slice(0, 12)) }, { seq: 2, blob: await sealEvents(k, log.slice(11)) }] };
}
const served = (tag: string, rows: Row[]) => (request: AddonHttpRequest) => {
  if (!request.url.startsWith(TABLE)) return { status: 404, body: '' };
  if (request.headers?.['x-foyer'] !== tag) return []; // règle RLS : autre étiquette, aucune ligne
  const q = new URL(request.url).searchParams;
  const after = Number(q.get('seq')?.replace('gt.', '') ?? '0');
  return rows.filter(r => r.seq > after).slice(0, Number(q.get('limit') ?? Infinity)); // pages, comme PostgREST
};
// Le journal en deux temps : un premier événement, puis tout le reste (dont le curry de ce soir).
async function split(code = CODE): Promise<{ tag: string; first: string; rest: string }> {
  const k = await relayKeys(code);
  const log = demoLog(new Date(NOW));
  return { tag: k.tag, first: await sealEvents(k, log.slice(0, 1)), rest: await sealEvents(k, log.slice(1)) };
}

test('définition acceptée par le chargeur de Cornelius', () => {
  assert.equal(validateAddonDefinition(addon), null);
});

test('lit ce soir, demain midi, les tâches et les achats manquants', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  const outcome = await f.read();
  assert.deepEqual(f.contract(outcome), []);
  assert.ok(outcome.ok);
  assert.match(outcome.presentation.summary, /Ce soir : Curry de poulet/);
  assert.match(outcome.presentation.summary, /sortir le poulet du congélateur/);
  assert.match(outcome.presentation.summary, /Pas encore acheté/);
  assert.equal(outcome.presentation.primaryValue, 'Ce soir : Curry de poulet');
});

test('lecture seule : uniquement des GET vers la table du relais, sans écriture', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  await f.read();
  assert.ok(f.calls.length >= 1);
  for (const c of f.calls) {
    assert.equal(c.method ?? 'GET', 'GET');
    assert.equal(c.body, undefined);
    assert.ok(c.url.startsWith(TABLE));
  }
});

test('au-delà de 10 000 blocs : les plus récents sont lus aussi, jamais un vieux menu', async t => {
  const { tag, first, rest } = await split();
  const rows: Row[] = Array.from({ length: 10_000 }, (_, i) => ({ seq: i + 1, blob: first }));
  rows.push({ seq: 10_001, blob: rest });
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  const outcome = await f.read();
  assert.ok(outcome.ok);
  assert.match(outcome.presentation.summary, /Ce soir : Curry de poulet/);
});

test('relevé suivant : seuls les blocs nouveaux sont demandés', async t => {
  const { tag, first, rest } = await split();
  const rows: Row[] = [{ seq: 1, blob: first }];
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  assert.ok((await f.read()).ok);
  rows.push({ seq: 2, blob: rest });
  f.advance(11 * 60_000);
  const before = f.calls.length;
  const outcome = await f.read();
  assert.ok(outcome.ok && !outcome.stale);
  assert.match(outcome.presentation.summary, /Curry de poulet/);
  assert.ok(f.calls.length > before);
  for (const c of f.calls.slice(before)) assert.doesNotMatch(c.url, /seq=gt\.0&/);
});

test('vue courses à la demande : liste de la semaine', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  const { outcome, tool } = await f.invoke('read', { vue: 'courses' });
  assert.deepEqual(f.contract(outcome), []);
  assert.equal(tool.status, 'succeeded');
  assert.match(tool.summary, /articles? à prendre cette semaine|Tout est pris/);
  assert.ok(outcome.ok && outcome.card.items.length <= 5);
});

test('affichage permanent : trois lignes au plus', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: served(tag, rows) });
  await f.read();
  const display = f.ambient();
  assert.equal(display.status, 'ready');
  assert.ok(display.content && display.content.items.length <= 3);
  assert.equal(display.content?.items[0]?.label, 'Ce soir');
});

test('code absent ou mal formé : réglage incomplet, aucune requête', async t => {
  const cases: Record<string, string>[] = [{}, { code: 'pas-un-code' }];
  for (const secrets of cases) {
    const f = createTestModule(t, addon, { at: NOW, secrets, routes: () => [] });
    const outcome = await f.read();
    assert.equal(outcome.ok, false);
    assert.equal(!outcome.ok && outcome.error.code, 'config_invalid');
    assert.equal(f.calls.length, 0);
  }
});

test('autre code : « introuvable », jamais « rien de prévu »', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: 'ZZZZ-ZZZZ-ZZZZ' }, routes: served(tag, rows) });
  const outcome = await f.read();
  assert.equal(!outcome.ok && outcome.error.code, 'not_found');
  assert.doesNotMatch(!outcome.ok ? outcome.summary : '', /rien de prévu/i);
});

test('blocs illisibles avec ce code : identifiants refusés', async t => {
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: () => [{ seq: 1, blob: 'AAAAAAAAAAAAAAAAAAAAAAAA' }] });
  const outcome = await f.read();
  assert.equal(!outcome.ok && outcome.error.code, 'auth');
});

test('relais en panne : échec au premier relevé, dernier relevé daté ensuite', async t => {
  const { tag, rows } = await relay();
  const down = { status: 503, body: '' };
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: () => down });
  const first = await f.read();
  assert.equal(!first.ok && first.error.code, 'upstream');
  f.route(served(tag, rows));
  assert.ok((await f.read()).ok);
  f.advance(11 * 60_000);
  f.route(() => down);
  const later = await f.read();
  assert.ok(later.ok && later.stale, 'le dernier succès est resservi comme tel');
});

test('réponse coupée : illisible, jamais une liste partielle', async t => {
  const f = createTestModule(t, addon, { at: NOW, secrets: { code: CODE }, routes: () => ({ status: 200, body: '[]', truncated: true }) });
  const outcome = await f.read();
  assert.equal(!outcome.ok && outcome.error.code, 'malformed');
});

test('semaine sans menu : « rien de prévu », dit comme un fait et non comme une panne', async t => {
  const { tag, rows } = await relay();
  const f = createTestModule(t, addon, { at: NOW + 60 * 864e5, secrets: { code: CODE }, routes: served(tag, rows) });
  const outcome = await f.read();
  assert.deepEqual(f.contract(outcome), []);
  assert.ok(outcome.ok);
  assert.match(outcome.presentation.summary, /rien de prévu|Aucun repas prévu/i);
});
