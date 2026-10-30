// Mes Comptes sur téléphone : iPhone (WebKit, le moteur de Safari) et Android (Chromium), données fictives seulement.
// Local :  node e2e/parcours.mjs            (playwright installé ; MOTEUR=webkit ou MOTEUR=chromium pour un seul)
// CI :     job « telephones » de .github/workflows/tests.yml (gratuit : dépôt public). STRICT=1 : un moteur absent est une erreur.
// Le script sert lui-même l'app (aucun serveur à lancer) et fige l'heure : mercredi 28 octobre 2026, 19 h à Paris.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');

const ROOT = new URL('..', import.meta.url).pathname, SHOTS = process.env.SHOTS || join(ROOT, 'captures');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(ROOT, path.endsWith('/') ? path + 'index.html' : path)); res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0); // localhost (une clé d'accès refuse une adresse IP)
await new Promise(r => server.once('listening', r));
const URL0 = `http://localhost:${server.address().port}/index.html`;
await mkdir(SHOTS, { recursive: true });

// Relevé fictif au format Banque Populaire, sous un nom de fichier réaliste (accent, apostrophe, « (1) »).
const CSV = ['Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation',
  '15/09/2026;CARREFOUR MARKET;CB CARREFOUR MARKET 13/09;1;;Carte;Alimentation;Supermarché;-54,20;;13/09/2026;15/09/2026;0',
  '16/09/2026;SALAIRE;VIR SEPA SOCIETE XYZ SALAIRE;2;;Virement;Revenus;Salaire;;+2 100,00;16/09/2026;16/09/2026;0',
  '18/09/2026;RESTAURANT;CB RESTAURANT LE ZINC 17/09;3;;Carte;Loisirs;Restaurant;-38,50;;17/09/2026;18/09/2026;0'].join('\n');
const FILE = { name: "Relevé d'août (1).csv", mimeType: 'text/csv', buffer: Buffer.from(CSV) };
const PIN = '482915';

const fails = [];
let tag = '';
const ok = (cond, what) => { console.log(`  ${cond ? '✔' : '✘'} ${what}`); if (!cond) fails.push(`${tag} : ${what}`); };
const NOW = new Date('2026-10-28T18:00:00Z');

async function phone(engine, device) {
  const ctx = await engine.newContext({ ...devices[device], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|service ?worker|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await page.clock.setFixedTime(NOW);
  return { ctx, page, errs };
}
// Face ID / empreinte (Chromium : authentificateur virtuel avec clé d'accès et PRF ; sur iPhone, seule la vraie biométrie peut le faire).
async function bio(engine, device) {
  const { ctx, page, errs } = await phone(engine, device);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  const n = await newVault(page);
  await page.click('.gear');
  await page.click('[data-a="bioSheet"]');
  await page.fill('form[data-f="bioOn"] [name="pin"]', PIN);
  await page.click('form[data-f="bioOn"] button:not([type])');
  await page.click('[data-a="bioCreate"]');                                   // un toucher par étape, comme Safari l'exige
  if (await page.locator('[data-a="bioConfirm"]').count()) await page.click('[data-a="bioConfirm"]');
  await page.waitForFunction(() => !!localStorage.getItem('mescomptes-bio'), null, { timeout: 20000 }).catch(() => {});
  const stored = await page.evaluate(() => localStorage.getItem('mescomptes-bio') || '');
  ok(!!stored && !stored.includes(PIN), 'activée : code gardé chiffré, jamais en clair');
  await page.click('[data-a="lockNow"]');
  await page.waitForSelector('#lock [data-a="bioUnlock"]', { timeout: 10000 }).catch(() => {});
  ok(await page.locator('#lock [data-a="bioUnlock"]').count() === 1, 'écran verrouillé : bouton biométrie');
  await page.click('#lock [data-a="bioUnlock"]');
  await page.waitForFunction(() => booted && S.tx.length > 0, null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => S.tx.length) === n, 'ouverte par la biométrie, sans taper le code : données intactes');
  await page.click('.gear');
  await page.click('[data-a="pinChange"]');
  await page.fill('[name="cur"]', PIN); await page.fill('#sheet [name="pin"]', '739264'); await page.fill('#sheet [name="pin2"]', '739264');
  await page.click('form[data-f="changepin"] button:not([type])');
  await page.waitForFunction(() => !localStorage.getItem('mescomptes-bio'), null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => !localStorage.getItem('mescomptes-bio')), 'code changé : biométrie désactivée (elle gardait l\'ancien)');
  ok(!errs.length, `aucune erreur dans la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
// Rien ne dépasse en largeur : pas de défilement horizontal sur un téléphone.
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
// Toucher le milieu d'une part du camembert, sur l'anneau (là où le doigt se pose vraiment).
const slicePoint = (page, id) => page.evaluate(id => {
  const el = document.querySelector(`#where circle[data-p="${id}"]:not(.bg)`); if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const box = el.ownerSVGElement.getBoundingClientRect(), k = box.width / 240, [L] = el.getAttribute('stroke-dasharray').split(' ').map(Number);
  const a = (-+el.getAttribute('stroke-dashoffset') + L / 2) / (2 * Math.PI * 96) * 2 * Math.PI - Math.PI / 2;
  return { x: box.left + (120 + 96 * Math.cos(a)) * k, y: box.top + (120 + 96 * Math.sin(a)) * k };
}, id);

async function demo(engine, device) {
  const { ctx, page, errs } = await phone(engine, device);
  await page.goto(URL0);
  await page.click('[data-a="demo"]');
  await page.evaluate(() => { S.seen = { home: 1, ops: 1, save: 1, accounts: 1, trends: 1 }; render(); });
  ok(await page.locator('#where circle[data-p]:not(.bg)').count() >= 5, 'accueil : camembert d\'au moins 5 pôles');
  ok(await page.locator('#where .pl').count() >= 5, 'accueil : légende chiffrée');
  ok(await noOverflow(page), 'accueil : rien ne dépasse en largeur');
  await page.screenshot({ path: join(SHOTS, `${tag}-accueil.png`) });

  await page.click('.pl[data-p="manger"]');
  ok(/Courses & restos/.test(await page.locator('.dn-c').innerText()), 'ligne touchée : le centre montre le pôle');
  const center = await page.locator('.dn-c b').innerText();
  const pt = await slicePoint(page, 'logement');
  await page.evaluate(() => { window.__ev = []; for (const t of ['touchend', 'pointerup', 'click']) document.addEventListener(t, e => __ev.push(`${t}:${e.target.tagName}`), true); });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForFunction(() => /Logement/.test(document.querySelector('.dn-c').textContent), null, { timeout: 2000 }).catch(() => {});
  ok(/Logement/.test(await page.locator('.dn-c').innerText()), `part du camembert touchée du doigt : le centre suit (${(await page.evaluate(() => __ev)).join(', ')})`);
  await page.click('[data-a="pole"][data-p=""]'); // ‹ Tous les pôles
  await page.click('.pl[data-p="manger"]');
  await page.click('[data-a="goCat"][data-c="pole:manger"]');
  const listTotal = await page.locator('#list .row b').first().innerText();
  ok(Math.abs(Math.round(Math.abs(parseFloat(listTotal.replace(/[^\d,-]/g, '').replace(',', '.')))) - parseInt(center.replace(/\D/g, ''), 10)) <= 1, `opérations du pôle : même total que le camembert (${center} / ${listTotal.trim()})`);

  await page.selectOption('select[data-c="cat"]', '');
  await page.fill('#q', 'carrefour');
  await page.click('[data-a="allOps"][data-v="1"]');
  ok(/opérations sur \d+ mois/.test(await page.locator('#list .note').innerText()), 'recherche dans tout l\'historique');
  ok(await noOverflow(page), 'opérations : rien ne dépasse en largeur');
  await page.locator('#list .op').first().click();
  ok(await page.locator('#sheet >> text=Chez ce marchand').count() === 1, 'fiche : « Chez ce marchand »');
  await page.click('[data-a="merchantOps"]');
  ok(await page.locator('[data-a="mkClear"]').count() === 1, 'toutes ses opérations : filtre marchand affiché');
  await page.screenshot({ path: join(SHOTS, `${tag}-marchand.png`) });

  await page.click('#tabs [data-t="accounts"]');
  ok(await page.locator('svg.fcc').count() >= 1, 'comptes : courbe du solde prévu');
  const hit = await page.locator('svg.fcc .hit').first().boundingBox();
  await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.waitForFunction(() => /solde/.test(document.querySelector('.fcd').textContent), null, { timeout: 2000 }).catch(() => {});
  ok(/solde/.test(await page.locator('.fcd').first().innerText()), 'point de la courbe touché du doigt : détail du jour');
  // Un seul toucher = une seule action (pas de double bascule si un clic suit le doigt levé).
  await page.evaluate(() => { ui.pole = ''; ui.tab = 'home'; render(); });
  await page.waitForTimeout(1200);                                            // fin du tracé animé du camembert
  const p2 = await slicePoint(page, 'manger'), states = [];
  for (let i = 0; i < 2; i++) { await page.touchscreen.tap(p2.x, p2.y); await page.waitForTimeout(400); states.push(await page.evaluate(() => ui.pole)); }
  ok(states.join(',') === 'manger,', `un toucher = une action : sélection puis désélection (${states.map(x => x || '—').join(' → ')})`);
  await page.click('#tabs [data-t="accounts"]');
  await page.click('[data-a="tab"][data-t="trends"]');
  ok(await page.locator('.stk .stack').count() === 12, 'tendances : 12 mois par pôle');

  await page.click('#tabs [data-t="home"]');
  await page.click('#where .flexg');
  await page.fill('[name="v"]', '700');
  await page.click('form[data-f="flex"] button:not([type])');
  ok(/au-delà/.test(await page.locator('#where .flexg').innerText()), 'enveloppe vie courante : dépassement dit en clair');
  for (const w of await page.evaluate(() => profiles())) {
    await page.evaluate(w => { ui.who = w; render(); }, w);
    ok(await page.locator('#where').count() === 1 && await noOverflow(page), `profil ${w} : accueil affiché`);
  }
  ok(!errs.length, `aucune erreur dans la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

// Un téléphone neuf : code d'entrée, prénoms, import du relevé fictif.
async function newVault(page) {
  await page.goto(URL0);
  if (await page.locator('[data-a="lockHere"]').count()) await page.click('[data-a="lockHere"]'); // iPhone dans Safari : l'app propose l'icône d'abord
  await page.fill('#lock [name="pin"]', PIN); await page.fill('#lock [name="pin2"]', PIN);
  await page.click('#lock form button');
  await page.waitForSelector('form[data-f="setup"]', { timeout: 20000 });
  await page.fill('[name="p1"]', 'Alex'); await page.fill('[name="p2"]', 'Sam');
  await page.click('form[data-f="setup"] button:not([type="button"])');
  await page.locator('#file').setInputFiles(FILE);
  await page.waitForFunction(() => S.tx.length >= 3, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => saving);
  return page.evaluate(() => S.tx.length);
}
// Le vrai parcours : code d'entrée, prénoms, import d'un relevé, rechargement, mauvais code, bon code, données intactes.
async function real(engine, device) {
  const { ctx, page, errs } = await phone(engine, device);
  const n = await newVault(page);
  ok(n === 3, `import de « ${FILE.name} » : ${n} opérations lues`);
  await page.evaluate(() => saving);
  ok(await page.evaluate(() => !!localStorage.getItem('mescomptes-coffre') && !/CARREFOUR/.test(localStorage.getItem('mescomptes-coffre'))), 'coffre enregistré, chiffré (aucun libellé en clair)');
  await page.reload();
  await page.waitForSelector('#lock form[data-f="unlock"]');
  await page.fill('#lock [name="pin"]', '000111'); await page.click('#lock form button');
  await page.waitForFunction(() => /incorrect/.test(document.querySelector('#lockMsg')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  ok(/incorrect/.test(await page.locator('#lockMsg').innerText()), 'mauvais code refusé');
  await page.fill('#lock [name="pin"]', PIN); await page.click('#lock form button');
  await page.waitForFunction(() => booted && S.tx.length > 0, null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => S.tx.length) === n, 'après rechargement et bon code : les opérations sont là');
  ok(await page.locator('#where').count() === 1 && await noOverflow(page), 'accueil réel : camembert, rien ne dépasse');
  await page.screenshot({ path: join(SHOTS, `${tag}-reel.png`) });
  ok(!errs.length, `aucune erreur dans la page${errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

const WANT = (process.env.MOTEUR || 'webkit,chromium').split(',');
const RUNS = [['webkit', webkit, 'iPhone 13'], ['chromium', chromium, 'Pixel 7']].filter(([n]) => WANT.includes(n));
for (const [name, type, device] of RUNS) {
  let browser;
  try { browser = await type.launch(name === 'chromium' && !process.env.CI ? { executablePath: process.env.CHROMIUM_PATH || undefined } : {}); }
  catch (e) { console.log(`— ${name} absent ici${process.env.STRICT ? '' : ' : ignoré'} (${e.message.split('\n')[0]})`); if (process.env.STRICT) fails.push(`${name} : navigateur absent`); continue; }
  for (const [label, run] of [['exemple', demo], ['parcours réel', real], ...(name === 'chromium' ? [['Face ID / empreinte', bio]] : [])]) {
    tag = `${name === 'webkit' ? 'iphone' : 'android'}-${{ exemple: 'exemple', 'parcours réel': 'reel' }[label] || 'biometrie'}`;
    console.log(`\n${device} (${name}) · ${label}`);
    try { await run(browser, device); } catch (e) { ok(false, `arrêt inattendu : ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
}
server.close();
if (fails.length) { console.log(`\n${fails.length} échec(s) :\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('\nOK — parcours téléphone');
