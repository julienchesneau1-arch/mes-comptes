// Synchro par relais contre un serveur local qui reproduit l'API REST de Supabase (PostgREST) et la règle RLS par en-tête.
// Prouve le protocole côté téléphones ; ne prouve pas le service Supabase réel (testé séparément une fois déployé).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { household, CURRY, MON } from './helpers.ts';
import { relayKeys, push, pull, type Fetch } from '../src/core/relay.ts';
import { merge, newCode } from '../src/core/sync.ts';
import { replay } from '../src/core/reduce.ts';
import { deriveShopping } from '../src/core/shopping.ts';

const KEY = 'cle-publique-test';
const rows: { seq: number; household: string; device: string; blob: string }[] = [];
const server = createServer((req, res) => {
  const tag = String(req.headers['x-foyer'] ?? '');
  const deny = (code: number, msg: string) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: msg })); };
  if (req.headers['apikey'] !== KEY) return deny(401, 'clé API invalide');
  const url = new URL(req.url ?? '', 'http://x');
  if (url.pathname !== '/rest/v1/foyer_relais') return deny(404, 'inconnu');
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const list = JSON.parse(body) as { household: string; device: string; blob: string }[];
      for (const r of list) {
        if (r.household !== tag) return deny(403, 'new row violates row-level security policy');
        if (!/^[0-9a-f]{64}$/.test(r.household) || !/^[a-z0-9]{8,24}$/.test(r.device) || r.blob.length < 20) return deny(400, 'check constraint');
      }
      for (const r of list) rows.push({ seq: rows.length + 1, ...r });
      res.writeHead(201); res.end();
    });
    return;
  }
  const gt = Number(/^gt\.(\d+)$/.exec(url.searchParams.get('seq') ?? '')?.[1] ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? 1000);
  const visible = rows.filter(r => r.household === tag && r.seq > gt).sort((a, b) => a.seq - b.seq).slice(0, limit).map(r => ({ seq: r.seq, blob: r.blob }));
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(visible));
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
after(() => server.close());
const conf = { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, key: KEY };
const f = fetch as unknown as Fetch;
const snap = (log: Parameters<typeof replay>[0]) => JSON.stringify(replay(log).state, (_, v) => (v instanceof Set ? [...v].sort() : v));

test('relais : un téléphone vierge rejoint le foyer avec le seul code, puis les deux convergent', async () => {
  const code = newCode();
  const k = await relayKeys(code);
  assert.match(k.tag, /^[0-9a-f]{64}$/);
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } }, { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prep0001', recipe: 'curry001', extra: 1 } });
  assert.equal(await push(conf, k, 'deva0001', a.log, f), 1);
  assert.ok(!rows.some(r => r.blob.includes('Curry'))); // chiffré

  // Téléphone B : rien d'autre que le code.
  const kb = await relayKeys(code.toLowerCase());
  const got = await pull(conf, kb, 0, f);
  assert.equal(got.unreadable, 0);
  let logB = merge([], null, { app: 'foyer', v: 1, hid: 'foyer0001', from: 'relais', sent: '', events: got.events }).log;
  assert.equal(snap(logB), snap(a.log));

  // B note une absence et la dépose ; A la relève : même liste de courses des deux côtés.
  const before = deriveShopping(replay(logB).state, MON).lines.find(l => l.name === 'Poulet')?.toBuy;
  const absent = { id: 'evb00001', lc: 999, dev: 'devb0002', by: 'm2', at: '2026-10-04T10:00:00.000Z', t: 'slot.presence' as const, p: { slot: `${MON}|soir`, member: 'm2', presence: 'dehors' as const } };
  logB = [...logB, absent];
  await push(conf, kb, 'devb0002', [absent], f);
  const back = await pull(conf, k, got.cursor - 1, f);
  const logA = merge(a.log, 'foyer0001', { app: 'foyer', v: 1, hid: 'foyer0001', from: 'relais', sent: '', events: back.events }).log;
  assert.equal(snap(logA), snap(logB));
  const after = deriveShopping(replay(logA).state, MON).lines.find(l => l.name === 'Poulet')?.toBuy;
  assert.notDeepEqual(after, before);
});

test('relais : un autre code ne voit rien ; un dépôt sous une autre étiquette est refusé ; un bloc altéré est ignoré', async () => {
  const k1 = await relayKeys(newCode()), k2 = await relayKeys(newCode());
  const { a } = household();
  await push(conf, k1, 'deva0001', a.log, f);
  const other = await pull(conf, k2, 0, f);
  assert.deepEqual([other.events.length, other.unreadable], [0, 0]);
  const forged = await f(`${conf.url}/rest/v1/foyer_relais`, { method: 'POST', headers: { apikey: KEY, 'x-foyer': k2.tag, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ household: k1.tag, device: 'pirate001', blob: 'x'.repeat(40) }]) });
  assert.equal(forged.status, 403);
  rows.push({ seq: rows.length + 1, household: k1.tag, device: 'pirate001', blob: 'A'.repeat(64) }); // bloc illisible glissé en base
  const mine = await pull(conf, k1, 0, f);
  assert.equal(mine.unreadable, 1);
  assert.equal(mine.events.length, a.log.length);
  await assert.rejects(pull({ ...conf, key: 'mauvaise' }, k1, 0, f), /lecture refusée \(401\)/);
});
