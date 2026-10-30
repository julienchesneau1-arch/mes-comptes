// Foyer sur téléphone : iPhone (WebKit, le moteur de Safari) et Android (Chromium), même grille que Mes Comptes (e2e/parcours.mjs).
// Local :  npm i --no-save playwright @axe-core/playwright ; node foyer/e2e/telephones.mjs   (MOTEUR=webkit ou chromium pour un seul)
// CI :     job « telephones » de .github/workflows/tests.yml (gratuit : dépôt public). STRICT=1 : un moteur ou axe absent est une erreur.
// Le script sert lui-même le site (Foyer sous /foyer/, comme GitHub Pages), fige l'heure (lundi 5 octobre 2026, 12 h à Paris)
// et remplace le relais par un relais muet : aucun appel réseau sortant.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');
let AxeBuilder = null;
try { AxeBuilder = require('@axe-core/playwright').default; } catch { /* facultatif en local, exigé par STRICT */ }

const ROOT = new URL('../..', import.meta.url).pathname, SHOTS = process.env.SHOTS || join(ROOT, 'captures');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
let OFF = false; // hors ligne : toute connexion est coupée
const server = createServer(async (req, res) => {
  if (OFF) { req.socket.destroy(); return; }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(ROOT, path.endsWith('/') ? path + 'index.html' : path)); res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => server.once('listening', r));
const URL0 = `http://localhost:${server.address().port}/foyer/index.html`;
await mkdir(SHOTS, { recursive: true });

const fails = [];
let tag = '', phase = 'début'; // étape en cours, jointe aux erreurs de la page
const ok = (cond, what) => { console.log(`  ${cond ? '✔' : '✘'} ${what}`); if (!cond) fails.push(`${tag} : ${what}`); };
const NOW = new Date('2026-10-05T10:00:00Z');
const TABS = ['Aujourd\'hui', 'Semaine', 'Courses', 'Maison'];

async function phone(engine, device) {
  const ctx = await engine.newContext({ ...devices[device], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  // Relais réel configuré dans l'app : remplacé par un relais muet (REST et signal temps réel).
  await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
    const m = route.request().method();
    return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'GET' ? { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' } : { status: 201, headers: cors });
  });
  await ctx.routeWebSocket(/^wss:\/\/[a-z0-9]+\.supabase\.co\//, ws => ws.onMessage(m => { const d = JSON.parse(String(m)); if (d.event === 'phx_join' || d.event === 'heartbeat') ws.send(JSON.stringify({ topic: d.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: d.ref })); }));
  const outside = [];
  ctx.on('request', r => { const u = r.url(); if (!u.startsWith('http://localhost') && !/^(data|blob):/.test(u) && !/\.supabase\.co\//.test(u)) outside.push(u); });
  const page = await ctx.newPage(), errs = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errs.push(`[${phase}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|service ?worker|Failed to load resource|ERR_INTERNET_DISCONNECTED/i.test(m.text())) {
    // Capture d'écran sous WebKit : Playwright injecte un style que la CSP stricte de Foyer refuse (prouvé : seulement pendant
    // les captures, sans fichier source). Ce cas seul est écarté ; toute autre erreur reste bloquante.
    if (phase.startsWith('capture') && /style-src/.test(m.text())) return;
    errs.push(`[${phase}] ${m.text()}`);
  } });
  // Violation de CSP : d'où vient-elle (extrait du style ou du script refusé, fichier, ligne) ?
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP ${e.violatedDirective} ${e.sourceFile || '-'}:${e.lineNumber} « ${e.sample} »`)));
  await page.clock.setFixedTime(NOW);
  return { ctx, page, errs, outside };
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
// WCAG 2.2 A et AA (axe-core), une fois les animations finies.
async function a11y(page, where) {
  if (!AxeBuilder) { if (process.env.STRICT) ok(false, `accessibilité (${where}) : @axe-core/playwright absent`); return; }
  await page.waitForTimeout(500);
  const was = phase; phase = `axe ${where}`;
  await page.emulateMedia({ reducedMotion: 'reduce' }); // état final, sans animation en cours (WebKit mesurait une couleur à mi-fondu)
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  phase = was;
  ok(!r.violations.length, `accessibilité WCAG 2.2 AA : ${where}${r.violations.length ? ' → ' + r.violations.slice(0, 3).map(v => `${v.id} ${v.nodes[0].target.join(' ')} (${(v.nodes[0].any[0]?.message || '').slice(0, 140)})`).join(' | ') : ''}`);
}
// Nombre d'articles du panier (« 🛒 Commander au drive · N articles »).
const basket = async page => +((await page.getByText(/Commander au drive · \d+ articles?/).first().innerText()).match(/(\d+) article/)?.[1] ?? 0);
const tab = async (page, name) => { await page.getByRole('link', { name, exact: true }).click(); await page.locator('main').waitFor(); };

async function run(engine, device) {
  const { ctx, page, errs, outside } = await phone(engine, device);
  const t0 = Date.now();
  await page.goto(URL0);
  await page.getByRole('button', { name: 'Créer notre foyer' }).waitFor();
  console.log(`  · premier affichage : ${Date.now() - t0} ms`);
  await a11y(page, 'accueil');

  // Le vrai parcours d'un foyer neuf : prénoms, rythme, classiques, création.
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Alex');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Sam');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('le midi en boîte').click();
  await a11y(page, 'rythme');
  await page.getByRole('button', { name: 'Continuer' }).click();
  for (const c of ['Curry de poulet', 'Lasagnes', 'Omelette', 'Soupe de légumes']) await page.getByRole('button', { name: c, exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer avec 4 plats/ }).click();
  await page.getByRole('heading', { name: 'Semaine', level: 1 }).waitFor();
  ok(true, 'foyer créé en 4 étapes');

  // La semaine arrive prête : tout approuver → panier prêt → courses remplies.
  await page.getByRole('button', { name: /Proposer le menu/ }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByText('Tout est prêt : approuvez, ou changez un repas.').waitFor();
  await a11y(page, 'menu proposé');
  await dlg.getByRole('button', { name: '✅ Tout approuver' }).click();
  await dlg.getByRole('heading', { name: /Panier prêt/ }).waitFor();
  ok(true, 'menu proposé puis approuvé : panier prêt');
  await page.keyboard.press('Escape');
  await tab(page, 'Courses');
  const lines = await basket(page);
  ok(lines >= 5, `courses : ${lines} articles à acheter`);

  // Chaque onglet, en clair puis en sombre : rien ne dépasse, accessibilité.
  for (const scheme of ['light', 'dark']) {
    phase = `thème ${scheme}`;
    await page.emulateMedia({ colorScheme: scheme });
    for (const t of TABS) {
      await tab(page, t);
      ok(await noOverflow(page), `${t} (${scheme === 'light' ? 'clair' : 'sombre'}) : rien ne dépasse en largeur`);
      await a11y(page, `${t} (${scheme === 'light' ? 'clair' : 'sombre'})`);
    }
    phase = `capture ${scheme}`;
    await page.screenshot({ path: join(SHOTS, `${tag}-${scheme}.png`), caret: 'initial' }); // sans style injecté (CSP stricte de Foyer)
    phase = 'après capture';
  }
  await page.emulateMedia({ colorScheme: 'light' });

  // Rechargement : tout est là, sans refaire l'accueil.
  phase = 'rechargement';
  await page.reload();
  await page.locator('main').waitFor();
  ok(await page.getByRole('button', { name: 'Créer notre foyer' }).count() === 0, 'rechargement : le foyer est retrouvé');
  await tab(page, 'Courses');
  ok(await basket(page) === lines, 'rechargement : mêmes courses');

  // Hors ligne (au supermarché sans réseau) : l'app s'ouvre et garde les courses.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => new Promise(r => navigator.serviceWorker.controller ? r() : navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))));
  OFF = true; phase = 'hors ligne';
  await page.reload();
  await page.locator('main').waitFor();
  await tab(page, 'Courses');
  ok(await basket(page) === lines, 'hors ligne : l\'app s\'ouvre, courses intactes');
  OFF = false;

  ok(!outside.length, `aucun appel hors de l'app${outside.length ? ' : ' + outside.slice(0, 3).join(' | ') : ''}`);
  ok(!errs.length, `aucune erreur dans la page${errs.length ? ' : ' + errs.slice(0, 6).join(' | ') : ''}`);
  await ctx.close();
}

const WANT = (process.env.MOTEUR || 'webkit,chromium').split(',');
const RUNS = [['webkit', webkit, 'iPhone 13'], ['chromium', chromium, 'Pixel 7']].filter(([n]) => WANT.includes(n));
for (const [name, type, device] of RUNS) {
  let browser;
  try { browser = await type.launch(name === 'chromium' && !process.env.CI ? { executablePath: process.env.CHROMIUM_PATH || undefined } : {}); }
  catch (e) { console.log(`— ${name} absent ici${process.env.STRICT ? '' : ' : ignoré'} (${e.message.split('\n')[0]})`); if (process.env.STRICT) fails.push(`${name} : navigateur absent`); continue; }
  tag = `foyer-${name === 'webkit' ? 'iphone' : 'android'}`;
  console.log(`\nFoyer · ${device} (${name})`);
  try { await run(browser, device); } catch (e) { ok(false, `arrêt inattendu : ${e.message.split('\n')[0]}`); }
  await browser.close();
}
server.close();
if (fails.length) { console.log(`\n${fails.length} échec(s) :\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('\nOK — Foyer sur téléphone');
