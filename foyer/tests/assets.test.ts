// Garde-fous sur les fichiers servis : contraste des couleurs (WCAG 2.2 AA) et liste hors ligne complète.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1] as string, (m[2] as string).toLowerCase()]));
}
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const darkStart = css.indexOf(':root[data-theme="dark"]');
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf('}', darkStart))) };

const lum = (hex: string): number => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
};
const ratio = (a: string, b: string): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

// Paires texte / fond réellement utilisées dans l'interface.
const PAIRS: [string, string][] = [
  ['ink', 'bg'], ['ink', 'paper'], ['ink', 'shade'], ['ink-2', 'bg'], ['ink-2', 'paper'], ['ink-2', 'shade'],
  ['on-apricot', 'apricot'], ['apricot', 'apricot-bg'], ['apricot', 'paper'], ['blue', 'blue-bg'], ['blue', 'paper'], ['blue', 'bg'],
  ['sage', 'sage-bg'], ['amber', 'amber-bg'], ['plum', 'plum-bg'], ['paper', 'ink'], ['paper', 'sage'],
];

for (const [name, t] of [['clair', light], ['sombre', dark]] as const) {
  test(`contraste du thème ${name} ≥ 4,5:1 pour chaque texte`, () => {
    for (const [fg, bg] of PAIRS) {
      const a = t[fg], b = t[bg];
      assert.ok(a && b, `jeton manquant ${fg}/${bg}`);
      const r = ratio(a, b);
      assert.ok(r >= 4.5, `${name} : ${fg} sur ${bg} = ${r.toFixed(2)}:1`);
    }
  });
}

test('le service worker met hors ligne tous les fichiers de l\'app', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const root = new URL('..', import.meta.url).pathname;
  const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap(f => (statSync(join(root, d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of [...walk('js'), 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']) {
    assert.ok(sw.includes(`'${f}'`), `absent de sw.js : ${f}`);
  }
  assert.match(sw, /k\.startsWith\('foyer-'\)/); // ne supprime jamais les caches de Mes Comptes
});

test('page : aucune connexion sortante, aucun script en ligne', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /script-src 'self';/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(html, /style="/);
});

test('chaque bouton, champ et formulaire de l\'interface est relié à une action', () => {
  const root = new URL('../src/ui/', import.meta.url).pathname;
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const src = walk(root).map(f => readFileSync(f, 'utf8')).join('\n');
  const kinds: [string, string][] = [['a', 'CLICK'], ['c', 'CHANGE'], ['i', 'INPUT'], ['f', 'SUBMIT']];
  let n = 0;
  for (const [attr, reg] of kinds) {
    const used = new Set([...src.matchAll(new RegExp(`data-${attr}="([a-zA-Z]+)"`, 'g'))].map(m => m[1] as string));
    const defined = new Set([...src.matchAll(new RegExp(`${reg}\\['([a-zA-Z]+)'\\]\\s*=`, 'g'))].map(m => m[1] as string));
    for (const u of used) assert.ok(defined.has(u), `data-${attr}="${u}" sans ${reg}['${u}']`);
    n += used.size;
  }
  assert.ok(n > 80, `${n} actions seulement`);
});
