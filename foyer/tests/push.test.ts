// Rappels en notifications : heures exactes (changements d'heure), contenu chiffré lisible seulement avec la clé du foyer,
// même format dans l'app et dans le service worker, jeton VAPID valide, requêtes au relais sans texte en clair.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { household, CURRY, MON, NOW } from './helpers.ts';
import { parisToUtc } from '../src/core/dates.ts';
import { remindersFor, reminderId } from '../src/core/reminders.ts';
import { relayKeys, sealNote, openNote, depositReminders, type Fetch } from '../src/core/relay.ts';
import { newKeys, signingKey, vapidJwt, pushHeaders, PUSH_HOST, unb64u as decode64 } from '../supabase/functions/foyer-push/vapid.ts';
const unb64u = (s: string) => decode64(s) as Uint8Array<ArrayBuffer>; // vapid.ts reste lisible par Deno : type précisé ici
import { newCode } from '../src/core/sync.ts';

test('heure de Paris → instant exact, de part et d\'autre du changement d\'heure', () => {
  assert.equal(parisToUtc('2026-10-24', '1900').toISOString(), '2026-10-24T17:00:00.000Z'); // heure d'été
  assert.equal(parisToUtc('2026-10-26', '1900').toISOString(), '2026-10-26T18:00:00.000Z'); // heure d'hiver
  assert.equal(parisToUtc('2026-03-29', '1900').toISOString(), '2026-03-29T17:00:00.000Z'); // jour du passage à l'heure d'été
});

test('rappels : tâche de la veille, boîte, semaine suivante vide ; identifiants stables', () => {
  const { a } = household();
  a.emit(
    { t: 'recipe.save', p: { recipe: 'curry001', content: { ...CURRY, ahead: [{ label: 'Sortir le poulet du congélateur', when: 'veille' }] } } },
    { t: 'slot.presence', p: { slot: '2026-10-06|midi', member: 'm1', presence: 'boite' } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prep0001', recipe: 'curry001', extra: 1 } },
    { t: 'slot.from', p: { slot: '2026-10-06|midi', prep: 'prep0001' } },
  );
  const list = remindersFor(a.s, NOW);
  assert.deepEqual(list.map(r => [r.at, r.title]), [
    ['2026-10-04T17:00:00.000Z', '⏰ Sortir le poulet du congélateur'], // dimanche 19 h, veille du curry
    ['2026-10-05T19:00:00.000Z', '🥡 Boîte de Alex'],                     // lundi 21 h, pour mardi midi
    ['2026-10-11T16:00:00.000Z', '🗓️ La semaine prochaine est vide'],     // dimanche 18 h
  ]);
  assert.match(list[0]?.body ?? '', /^Pour Curry/);
  assert.deepEqual(remindersFor(a.s, NOW).map(r => r.rid), list.map(r => r.rid)); // même rappel, même identifiant
  assert.notEqual(reminderId('x', 'a', 't', 'b'), reminderId('x', 'a', 't2', 'b'));
  assert.ok(list.every(r => /^[0-9a-f]{16}$/.test(r.rid)));
  assert.deepEqual(remindersFor(a.s, new Date('2026-10-05T20:00:00Z')).map(r => r.title), ['🗓️ La semaine prochaine est vide']); // le passé n'est jamais renvoyé
});

test('rappel chiffré : lisible avec la clé du foyer, dans l\'app comme dans le service worker ; illisible sans', async () => {
  const k = await relayKeys(newCode()), other = await relayKeys(newCode());
  const blob = await sealNote(k.key, { title: '⏰ Sortir le poulet', body: 'Pour Curry (lun. 5 oct. soir)' });
  assert.match(blob, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await openNote(k.key, blob), { title: '⏰ Sortir le poulet', body: 'Pour Curry (lun. 5 oct. soir)' });
  assert.equal(await openNote(other.key, blob), null);
  // Le service worker tel qu'il est publié.
  const self: Record<string, unknown> = { addEventListener() {}, registration: {} };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, crypto, TextEncoder, TextDecoder, atob, indexedDB: {}, caches: {}, fetch });
  const swOpen = self['foyerOpenNote'] as (key: CryptoKey, blob: string) => Promise<unknown>;
  assert.equal(JSON.stringify(await swOpen(k.key, blob)), JSON.stringify({ title: '⏰ Sortir le poulet', body: 'Pour Curry (lun. 5 oct. soir)' })); // objet d'un autre contexte : comparé en texte
  assert.equal(await swOpen(other.key, blob), null);
});

test('VAPID : clé publique P-256, jeton ES256 vérifiable, seuls les services de notification connus', async () => {
  const keys = await newKeys();
  assert.equal(unb64u(keys.pub).length, 65);
  const jwt = await vapidJwt('https://web.push.apple.com/QGuQyavXutnMbzTdzpZ8n', await signingKey(keys.priv), 'https://exemple.fr/', Date.parse('2026-10-04T10:00:00Z'));
  const [h, b, s] = jwt.split('.') as [string, string, string];
  assert.deepEqual(JSON.parse(new TextDecoder().decode(unb64u(h))), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(new TextDecoder().decode(unb64u(b))), { aud: 'https://web.push.apple.com', exp: Date.parse('2026-10-04T22:00:00Z') / 1000, sub: 'https://exemple.fr/' });
  const pub = await crypto.subtle.importKey('raw', unb64u(keys.pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(s), new TextEncoder().encode(`${h}.${b}`)));
  assert.equal(pushHeaders(jwt, keys.pub)['Content-Length'], '0'); // notification vide
  for (const ok of ['https://web.push.apple.com/x', 'https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://db5p.notify.windows.com/w/x']) assert.ok(PUSH_HOST.test(ok), ok);
  for (const bad of ['https://exemple.fr/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com.exemple.fr/x', 'https://169.254.169.254/']) assert.ok(!PUSH_HOST.test(bad), bad);
});

test('dépôt des rappels : remplace les rappels à venir sauf les 10 prochaines minutes, sans aucun texte en clair', async () => {
  const k = await relayKeys(newCode());
  const calls: { url: string; method?: string; headers?: Record<string, string>; body?: string }[] = [];
  const f: Fetch = async (url, init) => { calls.push({ url, ...init }); return { ok: true, status: 201, json: async () => ({}) }; };
  const list = [{ rid: '0123456789abcdef', at: '2026-10-05T17:00:00.000Z', title: '⏰ Sortir le poulet', body: 'Pour Curry' }];
  await depositReminders({ url: 'https://relais.test', key: 'cle' }, k, list, new Date('2026-10-04T10:00:00Z'), f);
  assert.equal(calls[0]?.method, 'DELETE');
  assert.equal(calls[0]?.url, 'https://relais.test/rest/v1/foyer_rappel?sent_at=is.null&at=gt.2026-10-04T10%3A10%3A00.000Z&rid=not.in.(0123456789abcdef)');
  assert.equal(calls[0]?.headers?.['x-foyer'], k.tag);
  assert.equal(calls[1]?.method, 'POST');
  assert.match(calls[1]?.headers?.['Prefer'] ?? '', /resolution=ignore-duplicates/);
  const rows = JSON.parse(calls[1]?.body ?? '[]') as { household: string; rid: string; at: string; blob: string }[];
  assert.deepEqual(rows.map(r => [r.household, r.rid, r.at]), [[k.tag, '0123456789abcdef', '2026-10-05T17:00:00.000Z']]);
  assert.ok(!/poulet|Curry/i.test(calls[1]?.body ?? ''));
  assert.deepEqual(await openNote(k.key, rows[0]?.blob ?? ''), { title: '⏰ Sortir le poulet', body: 'Pour Curry' });
});
