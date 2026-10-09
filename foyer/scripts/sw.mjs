// Après compilation : met à jour la liste des fichiers mis hors ligne par sw.js (tous les fichiers de js/, la page et le catalogue).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const walk = d => readdirSync(join(root, d)).flatMap(f => (statSync(join(root, d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = ['./', 'index.html', 'styles.css', 'fonts/nunito.woff2', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', ...(existsSync(join(root, 'catalogue.json')) ? ['catalogue.json'] : []), ...['prix.json', 'produits.json'].filter(f => existsSync(join(root, f))), ...walk('js').sort()];
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const next = sw.replace(/const FILES = \[[\s\S]*?\n\];/, `const FILES = [\n${files.map(f => `  '${f}',`).join('\n')}\n];`);
if (next !== sw) writeFileSync(join(root, 'sw.js'), next);
