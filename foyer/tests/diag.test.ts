// Diagnostic du téléphone : version d'iOS lue sans deviner, chaque manque expliqué par sa conséquence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Env, diagnose, diagText, iosVersion } from '../src/core/diag.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const env = (over: Partial<Env> = {}): Env => ({ standalone: true, ios: '17.5', crypto: true, compression: true, dialog: true, serviceWorker: true,
  wakeLock: true, push: true, notifications: 'default', persisted: true, ...over });

test('version d\'iOS : lue dans le navigateur, jamais supposée', () => {
  assert.equal(iosVersion(IPHONE), '17.5');
  assert.equal(iosVersion('Mozilla/5.0 (iPad; CPU OS 16_3 like Mac OS X) AppleWebKit/605.1.15'), '16.3');
  assert.equal(iosVersion('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'), null); // iPad récent ou Mac : inconnu
  assert.equal(iosVersion('Mozilla/5.0 (X11; Linux x86_64) Chrome/130'), null);
});

test('diagnostic : tout va bien sur un iPhone installé, récent', () => {
  const c = diagnose(env());
  assert.ok(c.every(x => x.ok === true), diagText(c));
});

test('diagnostic : chaque manque dit ce qu\'il change', () => {
  const c = diagnose(env({ ios: '16.3', standalone: false, push: false, wakeLock: false, persisted: null, notifications: 'absent' }));
  const by = (l: string) => c.find(x => x.label === l)!;
  assert.equal(by('Version d\'iOS').ok, false);
  assert.match(by('Version d\'iOS').detail, /16\.4 ou plus récent/);
  assert.match(by('Installée sur l\'écran d\'accueil').detail, /Sur l'écran d'accueil/);
  assert.match(by('Notifications').detail, /une fois Foyer installée/);
  assert.equal(by('Stockage protégé').ok, null);
  assert.match(diagText(c), /^Diagnostic Foyer\n✗ Version d'iOS : iOS 16\.3/);
  assert.equal(diagnose(env({ ios: '16.4' }))[0]?.ok, true);
  assert.equal(diagnose(env({ ios: '17.0' }))[0]?.ok, true);
  assert.equal(diagnose(env({ notifications: 'denied' })).find(x => x.label === 'Notifications')?.ok, false);
});
