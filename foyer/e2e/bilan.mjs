// V3.18, horloge fixée au lundi 5 octobre 2026, 12 h à Paris : bilan de la semaine. Foyer neuf (tout le monde à la maison) :
// « Pas assez de plats : il manque 14 repas » ; un plat posé lundi soir → le message dit ce qui manque encore ; « 2 portions en
// plus » → « il y a du trop » et « ♻️ Pâtes demain midi » reprend les portions d'un toucher, rien de plus à cuisiner ; axe WCAG 2.2 AA.
// Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T10:00:00Z'), TUE = new Date('2026-10-06T10:00:00Z');
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
const card = page.locator('section[aria-labelledby="cov-h"]');
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');
const openSlot = async (k, day) => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  const slot = page.locator(`[data-a="slot"][data-k="${k}"]`);
  if (!(await slot.count())) await page.getByRole('button', { name: day }).first().click();
  await slot.first().click();
};

await page.goto(URL);
await step('foyer neuf, tout le monde à la maison : « Pas assez de plats : il manque 14 repas »', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Pâtes');
  await dlg.getByLabel(/pour combien de portions/).fill('2');
  await dlg.getByLabel(/^Ingrédients/).fill('200 g de pâtes');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await card.getByText('Pas assez de plats : il manque 14 repas pour finir la semaine').waitFor();
  if (!(await card.getByRole('button', { name: '✨ Compléter la semaine' }).count())) throw new Error('« Compléter » absent');
  await page.screenshot({ path: `${SHOTS}/bilan-manque.png` });
  await axe('bilan-manque');
});
await step('un plat posé lundi soir : le message dit ce qui manque encore ; 2 portions en plus : « il y a du trop »', async () => {
  await openSlot('2026-10-05|soir', /lundi/i);
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Pâtes/ }).first().click();
  await page.getByText(/Pâtes prévu ce soir · encore 13 repas sans plat cette semaine/).first().waitFor();
  await dlg.getByRole('button', { name: 'Une portion en plus', exact: true }).click();
  await dlg.getByRole('button', { name: 'Une portion en plus', exact: true }).click();
  await dlg.locator('output', { hasText: '2' }).waitFor();
  await page.keyboard.press('Escape');
  await card.getByText(/Il manque 13 repas pour finir la semaine, mais il y a du trop/).waitFor();
  if (!/En trop : Pâtes : 2 portions en plus\. De quoi couvrir 1 repas sans rien cuisiner de plus\./.test(await text(card))) throw new Error('détail : ' + await text(card));
  await axe('bilan-trop');
});
await step('« ♻️ Pâtes demain midi » : les portions en plus reprises d\'un toucher, rien de plus à cuisiner', async () => {
  await card.getByRole('button', { name: '♻️ Pâtes demain midi' }).click();
  await page.getByText(/Pâtes demain midi · encore 12 repas sans plat cette semaine/).first().waitFor();
  await card.getByText('Pas assez de plats : il manque 12 repas pour finir la semaine').waitFor();
  const midi = page.locator('[data-a="slot"][data-k="2026-10-06|midi"]');
  if (!(await midi.count())) await page.getByRole('button', { name: /mardi/i }).first().click();
  if (!/Pâtes/.test(await midi.first().innerText())) throw new Error('mardi midi : ' + await midi.first().innerText());
  await page.screenshot({ path: `${SHOTS}/bilan-repris.png` });
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
