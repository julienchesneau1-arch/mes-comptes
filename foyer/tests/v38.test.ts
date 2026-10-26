// V3.8 : photos libres des plats (filtre de licence, crédit), signal temps réel (messages Phoenix), rappel « Ce soir ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, NOW } from './helpers.ts';
import { photoFrom, validPhoto, plainText } from '../src/core/photos.ts';
import { readCatalog } from '../src/core/catalog.ts';
import { realtimeUrl, nudgeTopic, joinMsg, nudgeMsg, hear, backoff } from '../src/core/nudge.ts';
import { remindersFor } from '../src/core/reminders.ts';
import { validEvent } from '../src/core/model.ts';

// Réponse « imageinfo » telle que l'API MediaWiki la renvoie pour un fichier de Commons (forme abrégée).
const info = (over: Record<string, unknown> = {}, meta: Record<string, string> = {}) => ({ title: 'Fichier:Blanquette de veau.jpg', imagerepository: 'shared', imageinfo: [{
  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Blanquette.jpg/500px-Blanquette.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Blanquette_de_veau.jpg',
  mime: 'image/jpeg', width: 2048, height: 1536,
  extmetadata: Object.fromEntries(Object.entries({ Artist: '<a href="//commons.wikimedia.org/wiki/User:Exemple">Exemple</a> &amp; Co', LicenseShortName: 'CC BY-SA 4.0', ...meta }).map(([k, v]) => [k, { value: v }])),
  ...over }] });

test('photo : retenue si libre, assez grande, avec auteur ; crédit en texte seul ; sinon rien', () => {
  const got = photoFrom('wb123', info());
  assert.ok(got.ok);
  assert.deepEqual(got.photo, { src: 'img/plats/wb123.jpg', author: 'Exemple & Co', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Blanquette_de_veau.jpg' });
  assert.match(got.thumb, /^https:\/\/upload\.wikimedia\.org\//);
  const why = (r: ReturnType<typeof photoFrom>) => (r.ok ? 'retenue' : r.why);
  assert.equal(why(photoFrom('wb123', info({ mime: 'image/svg+xml' }))), 'format');           // dessin
  assert.equal(why(photoFrom('wb123', info({ width: 120, height: 120 }))), 'petite image');   // icône
  assert.equal(why(photoFrom('wb123', info({}, { LicenseShortName: 'Fair use' }))), 'licence'); // non libre
  assert.equal(why(photoFrom('wb123', info({}, { Artist: '', Credit: '' }))), 'auteur inconnu');
  const credit = photoFrom('wb123', info({}, { Artist: '', Credit: 'Travail personnel' }));
  assert.equal(credit.ok && credit.photo.author, 'Travail personnel');
  assert.equal(why(photoFrom('../x', info())), 'pas de réponse');
  assert.equal(why(photoFrom('wb123', { title: 'Fichier:X.jpg', missing: true })), 'pas de réponse');
  assert.equal(plainText('<span>Jean&#160;Dupont</span>'), 'Jean Dupont');
});

test('catalogue relu : une photo douteuse est retirée, la recette reste', () => {
  const r = { id: 'wb1', title: 'Blanquette', yield: 4, minutes: null, ingredients: ['1 kg de veau', '2 carottes', '1 oignon'], steps: ['Couper.', 'Cuire.'], tags: [], main: 'viande', url: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine/Blanquette', rev: 1 };
  const ok = { src: 'img/plats/wb1.jpg', author: 'Exemple', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:B.jpg' };
  const cat = readCatalog({ license: 'CC BY-SA 4.0', recipes: [{ ...r, photo: ok }, { ...r, id: 'wb2', photo: { ...ok, src: 'https://ailleurs.example/x.jpg' } }] });
  assert.equal(cat?.recipes.length, 2);
  assert.deepEqual(cat?.recipes[0]?.photo, ok);
  assert.equal(cat?.recipes[1]?.photo, undefined);                                            // image hors de l'app : jamais chargée
  assert.equal(validPhoto({ ...ok, license: 'Tous droits réservés' }), false);
});

test('signal temps réel : adresse, canal, messages Phoenix ; seul le signal du canal compte ; reprise plafonnée', () => {
  assert.equal(realtimeUrl('https://abc.supabase.co', 'sb_publishable_x'), 'wss://abc.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0');
  const topic = nudgeTopic('a'.repeat(64));
  assert.equal(topic, `realtime:foyer-${'a'.repeat(32)}`);
  assert.equal(JSON.parse(joinMsg(topic, '1')).event, 'phx_join');
  const n = JSON.parse(nudgeMsg(topic, '2', '1'));
  assert.deepEqual(n.payload, { type: 'broadcast', event: 'nudge', payload: {} });             // vide : aucune donnée du foyer
  assert.equal(hear(JSON.stringify({ topic, event: 'phx_reply', ref: '1', payload: { status: 'ok' } }), topic, '1'), 'joined');
  assert.equal(hear(JSON.stringify({ topic, event: 'phx_reply', ref: '1', payload: { status: 'error' } }), topic, '1'), 'refused');
  assert.equal(hear(JSON.stringify({ topic, event: 'broadcast', ref: null, payload: n.payload }), topic, '1'), 'nudge');
  assert.equal(hear(JSON.stringify({ topic: 'realtime:autre', event: 'broadcast', payload: n.payload }), topic, '1'), null);
  assert.equal(hear('pas du json', topic, '1'), null);
  assert.deepEqual([backoff(0), backoff(3), backoff(20)], [2000, 16000, 60000]);
});

test('rappel « Ce soir » : plat prévu, ou rien de prévu ; réglable, coupable ; rien si personne ne mange', () => {
  const { a } = household();                                                                 // soir à la maison, NOW = dimanche 12 h
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 2, ['600 g de poulet']) } },
    { t: 'slot.cook', p: { slot: '2026-10-04|soir', prep: 'pcurry01', recipe: 'curry001', extra: 0 } });
  const soir = (s = a.s) => remindersFor(s, NOW).filter(r => r.title.startsWith('🍽️'));
  const list = soir();
  assert.equal(list[0]?.title, '🍽️ Ce soir : Curry');
  assert.equal(list[0]?.at, '2026-10-04T15:30:00.000Z');                                     // 17 h 30 à Paris (heure d'été)
  assert.equal(list[0]?.body, '2 portions à préparer · la recette est dans Foyer');
  assert.equal(list[1]?.title, '🍽️ Ce soir : rien de prévu');
  a.emit({ t: 'settings.set', p: { evening: '1800' } });
  assert.equal(soir()[0]?.at, '2026-10-04T16:00:00.000Z');
  a.emit({ t: 'settings.set', p: { evening: null } });
  assert.equal(soir().length, 0);
  const base = { id: 'evt000000001', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'settings.set' };
  assert.equal(validEvent({ ...base, p: { evening: '2500' } }), null);
});
