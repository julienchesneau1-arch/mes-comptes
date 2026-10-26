// Semaine générée (spec « Approbation ») et budget tenu comme chez Pimzi, horloge fixée au lundi 5 octobre 2026, 12 h à Paris.
// Budget volontairement impossible (5 €) : des plats sont remplacés d'office par des moins chers ; veto ↻ et « pas de plat » ;
// le brouillon reste en attente (« À régler » : menu à approuver) et se retrouve tel quel ; « Tout approuver » → panier prêt.
// Catalogue réel du dépôt (catalogue.json), prix réels (prix.json, produits.json). axe WCAG 2.2 AA. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T10:00:00Z');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
});
await ctx.routeWebSocket(/^wss:\/\/[a-z0-9]+\.supabase\.co\//, ws => ws.onMessage(m => { const d = JSON.parse(String(m)); if (d.event === 'phx_join' || d.event === 'heartbeat') ws.send(JSON.stringify({ topic: d.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: d.ref })); })); // signal temps réel simulé (aucun réseau)
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(MON);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };
const axe = async name => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const dlg = page.locator('dialog[open]');
const titles = () => dlg.locator('.recap .title').allInnerTexts();
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');

await page.goto(URL);
await step('foyer créé, budget de 5 € par semaine demandé à l\'accueil (comme Pimzi)', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('le midi en boîte').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Budget courses par semaine, en euros').fill('5');
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByText(/budget 5,00\s€ par semaine/).waitFor();
});
let after = [];
await step('la semaine arrive prête, en liste : budget tenu d\'office, ou dépassement dit (jamais de prix inventé)', async () => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: /Proposer le menu/ }).click();
  await dlg.getByText('Tout est prêt : approuvez, ou changez un repas.').waitFor({ timeout: 15000 });
  const t = await text(dlg);
  const swapped = /remplacés? par un plat moins cher pour tenir le budget de 5,00\s€/.test(t), honest = /aucune alternative nettement moins chère dont le prix soit bien connu/.test(t);
  // Le catalogue réel change à chaque régénération : selon les plats tirés, les prix connus dépassent 5 € (dépassement dit, plats
  // remplacés ou explication), ou restent en dessous avec des articles sans prix (« au moins … · estimation incomplète » : rien affirmé).
  const over = /au-dessus du budget \(5,00\s€\)/.test(t), partial = /au moins [\d,]+\s€ de courses estimées · budget 5,00\s€ \(estimation incomplète\)/.test(t);
  if (!over && !partial) throw new Error('ni dépassement dit ni estimation déclarée incomplète : ' + t.slice(0, 400));
  if (over && !swapped && !honest) throw new Error('ni remplacement ni explication : ' + t.slice(0, 400));
  console.log('   budget :', !over ? 'estimation incomplète, sous 5 € connus : rien affirmé' : swapped ? 'plats remplacés d\'office' : 'dépassement expliqué (prix trop peu connus pour remplacer)');
  if (await dlg.getByText(/la portion au moins/).count()) throw new Error('coût par portion partiel affiché (trompeur)'); // seulement s'il est fiable
  console.log('   menu :', (await titles()).join(' · '));
  console.log('  ', await text(dlg.locator('.week-total')));
  await page.screenshot({ path: `${SHOTS}/semaine-liste.png`, fullPage: true });
  await axe('semaine-liste');
});
await step('veto ↻ : une autre idée pour ce repas ; ✕ : pas de plat', async () => {
  const before = await titles();
  await dlg.locator('.recap [data-a="listOther"]').first().click();
  await page.waitForFunction(t => document.querySelector('dialog[open] .recap .title')?.textContent !== t, before[0]);
  const n = (await titles()).length;
  await dlg.locator('.recap [data-a="listSkip"]').last().click();
  await page.waitForFunction(k => document.querySelectorAll('dialog[open] .recap .title').length < k, n);
  after = await titles();
  if (after[0] === before[0]) throw new Error('veto sans effet');
});
await step('brouillon en attente : « À régler » le propose, il se retrouve tel quel', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  const card = page.locator('li.exc', { hasText: /Menu de la semaine proposé : \d+ repas à approuver/ });
  await card.waitFor();
  if (await page.locator('li.exc', { hasText: /repas sans plat/ }).count()) throw new Error('« repas sans plat » encore affiché à côté du menu proposé');
  await card.getByRole('button', { name: 'Voir et approuver' }).click();
  await dlg.getByText('Tout est prêt : approuvez, ou changez un repas.').waitFor();
  const back = await titles();
  if (back.join('|') !== after.join('|')) throw new Error(`brouillon différent : ${back.join(' · ')} ≠ ${after.join(' · ')}`);
});
await step('« Tout approuver » : le planning, puis le panier prêt ; plus de menu en attente', async () => {
  await dlg.getByRole('button', { name: '✅ Tout approuver' }).click();
  await dlg.getByRole('heading', { name: /Panier prêt/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await page.locator('main').waitFor();
  if (await page.locator('li.exc', { hasText: /Menu de la semaine proposé/ }).count()) throw new Error('menu encore en attente après approbation');
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
