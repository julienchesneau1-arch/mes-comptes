// Synchro automatique de bout en bout, sans dépendre d'un vrai Supabase : on sert une copie de l'app dont la configuration
// pointe vers https://relais.test, et le navigateur voit un relais simulé (API REST + règle RLS par en-tête + fonction d'import).
// Lancer depuis foyer/ après `npm run build` : node e2e/synchro-auto.mjs
import { chromium } from 'playwright-core';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const SRC = new URL('..', import.meta.url).pathname;
const DIR = join(tmpdir(), 'foyer-relais-e2e');
rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true });
for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'js', 'fonts']) cpSync(join(SRC, f), join(DIR, f), { recursive: true });
cpSync(join(SRC, 'e2e/catalogue-essai.json'), join(DIR, 'catalogue.json')); // extrait fixe : résultats reproductibles
writeFileSync(join(DIR, 'js/ui/config.js'), "export const RELAY = { url: 'https://relais.test', key: 'cle-publique' };\n");
writeFileSync(join(DIR, 'index.html'), readFileSync(join(DIR, 'index.html'), 'utf8').replace("connect-src 'self'", "connect-src 'self' https://relais.test"));
const TYPES = { '.woff2': 'font/woff2', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const p = join(DIR, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/$/, '/index.html'));
  try { const b = readFileSync(p); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
});

// Accepter le menu proposé en cartes (tout garder, ou la seule carte), puis valider.
async function acceptMenu(P) {
  await P.getByRole('button', { name: /Proposer le menu/ }).click();
  const s = P.locator('dialog[open]');
  await s.locator('#deck-name').waitFor();
  const all = s.getByRole('button', { name: /Garder tout le menu/ });
  if (await all.count()) await all.click(); else await s.getByRole('button', { name: 'Je prends ce plat' }).click();
  await s.getByRole('button', { name: 'Valider la semaine' }).click();
}

await new Promise(r => server.listen(8767, '127.0.0.1', r));

// Relais simulé, partagé par les deux téléphones.
const rows = [];
let calls = 0;
async function relay(route) {
  const req = route.request(), url = new URL(req.url()), h = req.headers();
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  calls++;
  if (h['apikey'] !== 'cle-publique') return route.fulfill({ status: 401, headers: cors, body: '{}' });
  if (url.pathname === '/functions/v1/foyer-import') {
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Gratin dauphinois', yieldText: '6 personnes',
      ingredients: ['1,5 kg de pommes de terre', '50 cl de crème fraîche', '1 gousse d\'ail'], steps: ['Trancher.', 'Cuire 1 h.'], source: JSON.parse(req.postData()).url }) });
  }
  const tag = h['x-foyer'] ?? '';
  if (req.method() === 'POST') {
    const list = JSON.parse(req.postData());
    if (list.some(r => r.household !== tag)) return route.fulfill({ status: 403, headers: cors, body: '{}' });
    for (const r of list) rows.push({ seq: rows.length + 1, ...r });
    return route.fulfill({ status: 201, headers: cors });
  }
  const gt = Number(/gt\.(\d+)/.exec(url.searchParams.get('seq') ?? '')?.[1] ?? 0);
  const out = rows.filter(r => r.household === tag && r.seq > gt).map(r => ({ seq: r.seq, blob: r.blob }));
  return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const errors = [];
const phone = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route('https://relais.test/**', relay);
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror', e => errors.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  return p;
};
const step = async (l, fn) => { try { await fn(); console.log('✓', l); } catch (e) { console.log('✗', l, e.message.split('\n').slice(0, 4).join(' | ')); errors.push(l); } };
const A = await phone(), B = await phone();
const courses = async p => { await p.getByRole('link', { name: 'Courses', exact: true }).click(); await p.getByRole('heading', { name: 'Courses', level: 1 }).waitFor(); return (await p.locator('main section').allInnerTexts()).join(' ').replace(/\s+/g, ' '); };

let code = '';
await step('A crée le foyer : le code s\'affiche pour inviter, rien d\'autre à faire', async () => {
  await A.goto('http://127.0.0.1:8767/');
  await A.getByRole('button', { name: 'Créer notre foyer' }).click();
  await A.getByLabel('Prénom de la personne 1').fill('Alex');
  await A.getByLabel('Prénom de la personne 2 (facultatif)').fill('Sam');
  await A.getByRole('button', { name: 'Continuer' }).click();
  await A.getByText('le midi en boîte').click();
  await A.getByRole('button', { name: 'Continuer' }).click();
  await A.getByRole('button', { name: /Créer le foyer/ }).click();
  await A.getByRole('link', { name: "Aujourd'hui", exact: true }).click();
  code = (await A.locator('.banner .kbd').innerText()).trim();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) throw new Error('code ' + code);
});
await step('A importe une recette depuis une adresse web, la relit et l\'enregistre', async () => {
  await A.getByRole('link', { name: 'Maison', exact: true }).click();
  await A.getByRole('button', { name: 'Coller une recette' }).first().click();
  await A.getByLabel(/Adresse de la page/).fill('https://www.exemple-recettes.fr/gratin');
  await A.getByRole('button', { name: 'Importer depuis le site' }).click();
  await A.getByText(/Importé de www.exemple-recettes.fr : 3 ingrédient/).waitFor();
  await A.getByRole('button', { name: 'plat entier' }).click();
  await A.getByRole('button', { name: 'Enregistrer' }).click();
  await A.getByRole('link', { name: 'Semaine', exact: true }).click();
  await acceptMenu(A);
  await A.waitForTimeout(1500);
});
await step('B rejoint avec le seul code (aucun lien à copier)', async () => {
  await B.goto('http://127.0.0.1:8767/');
  await B.getByRole('button', { name: "L'autre téléphone a déjà Foyer" }).click();
  await B.getByLabel(/Code du foyer/).fill(code.toLowerCase());
  await B.getByRole('button', { name: 'Rejoindre' }).click();
  await B.getByRole('heading', { name: 'Membres du foyer' }).waitFor();
  await B.getByRole('radio', { name: 'Sam' }).check();
  await B.getByRole('button', { name: 'Enregistrer' }).click();
});
await step('mêmes courses sur les deux téléphones', async () => {
  const a = await courses(A), b = await courses(B);
  if (a !== b || !/Pommes de terre/.test(a)) throw new Error(`A: ${a.slice(0, 160)}\nB: ${b.slice(0, 160)}`);
  console.log('   ', a.slice(0, 140));
});
await step('B coche un article ; A le voit coché sans rien faire d\'autre que revenir dans l\'app', async () => {
  const key = await B.locator('input[data-c="shopCheck"]').first().getAttribute('data-key'); // clé figée : voir parcours.mjs
  await B.locator(`input[data-c="shopCheck"][data-key="${key}"]`).check({ force: true });
  await B.waitForTimeout(1500); // dépôt automatique après le changement
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.waitForTimeout(1500);
  const checked = await A.locator('input[data-c="shopCheck"]:checked').count();
  if (checked !== 1) throw new Error(`${checked} ligne(s) cochée(s) chez A, 1 attendue`);
});
await step('le relais ne contient aucun texte en clair', async () => {
  // Un bloc chiffré n'est que du base64url ; du JSON en clair aurait des guillemets, espaces ou accolades.
  // (Chercher « Sam » sans casse dans du base64 trouverait des coïncidences dès que les données grossissent.)
  const bad = rows.filter(r => !/^[A-Za-z0-9_-]+$/.test(r.blob) || /Gratin dauphinois|"name"/.test(r.blob));
  if (bad.length || !rows.length) throw new Error(`fuite en clair dans ${bad.length} bloc(s)`);
  console.log(`    ${rows.length} blocs chiffrés, ${calls} appels au relais`);
});
console.log('\n--- erreurs ---\n' + (errors.join('\n') || 'aucune'));
await browser.close(); server.close();
