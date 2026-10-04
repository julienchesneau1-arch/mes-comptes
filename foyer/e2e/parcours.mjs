// Parcours complet sur téléphone (390×844) puis ordinateur : création du foyer, recette, proposition, courses, rechargement, découverte, zoom 200 %, contrôle axe WCAG 2.2 AA.
// Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
import AxeBuilder from '@axe-core/playwright';
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
// Relais réel configuré dans l'app : remplacé ici par un relais muet (aucun appel réseau sortant pendant le scénario).
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
});
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const shot = async name => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const axe = async name => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n')[0]); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); } };

await page.goto(URL);
await step('accueil', async () => { await page.getByRole('button', { name: 'Créer notre foyer' }).waitFor(); await shot('01-accueil'); await axe('accueil'); });
await step('prénoms', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Alex');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Sam');
  await page.getByRole('button', { name: 'Continuer' }).click();
});
await step('rythme', async () => {
  await page.getByText('le midi en boîte').click();
  await shot('02-rythme'); await axe('rythme');
  await page.getByRole('button', { name: 'Continuer' }).click();
});
await step('classiques', async () => {
  for (const c of ['Curry de poulet', 'Lasagnes', 'Omelette', 'Soupe de légumes']) await page.getByRole('button', { name: c, exact: true }).click();
  await shot('03-classiques');
  await page.getByRole('button', { name: /Créer le foyer avec 4 plats/ }).click();
  await page.getByRole('heading', { name: 'Semaine', level: 1 }).waitFor();
});
await step('compléter le curry', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: /Curry de poulet/ }).click();
  await page.getByLabel(/pour combien de portions/).fill('4');
  await page.getByLabel(/^Ingrédients/).fill('600 g de poulet\n300 g riz cru\n400 ml de lait de coco\n1 oignon\nsel');
  await page.getByRole('button', { name: 'rapide', exact: true }).click();
  await page.getByText('Étapes et choses à faire avant').click();
  await page.getByLabel(/À faire la veille/).fill('Sortir le poulet du congélateur');
  await shot('04-recette'); await axe('recette');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
});
await step('proposer la semaine', async () => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: 'Proposer les repas vides' }).click();
  await page.getByRole('heading', { name: /Proposer la semaine/ }).waitFor();
  await shot('05-propositions'); await axe('propositions');
  await page.getByRole('button', { name: /Accepter \d+ proposition/ }).click();
  await page.waitForTimeout(300);
  await shot('06-semaine'); await axe('semaine');
});
await step('toute la semaine', async () => { await page.getByRole('button', { name: 'Toute la semaine' }).click(); await shot('07-semaine-liste'); });
await step('courses', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('heading', { name: 'Courses', level: 1 }).waitFor();
  await shot('08-courses'); await axe('courses');
  const txt = await page.locator('main').innerText();
  console.log('   courses:', txt.replace(/\s+/g, ' ').slice(0, 400));
});
await step('ajout manuel + coche', async () => {
  await page.getByPlaceholder(/Ajouter : café/).fill('2 paquets de café');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const first = page.locator('input[data-c="shopCheck"]').first();
  if (await first.count()) await first.check({ force: true });
  await shot('09-courses-coche');
});
await step('aujourd\'hui', async () => {
  await page.getByRole('link', { name: "Aujourd'hui" }).click();
  await page.waitForTimeout(200);
  await shot('10-aujourdhui'); await axe('aujourdhui');
  console.log('   aujourd\'hui:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500));
});
await step('feuille créneau', async () => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.locator('button.slot').filter({ hasText: /Curry|Lasagnes|Omelette|Soupe/ }).first().click();
  await page.locator('dialog[open]').waitFor();
  await shot('11-creneau'); await axe('creneau');
  await page.keyboard.press('Escape');
});
await step('persistance après rechargement', async () => {
  const before = await page.evaluate(() => localStorage.getItem('foyer:journal')?.length ?? 0);
  await page.reload();
  await page.getByRole('heading', { name: 'Semaine', level: 1 }).waitFor();
  const after = await page.evaluate(() => localStorage.getItem('foyer:journal')?.length ?? 0);
  console.log('   journal octets', before, after);
  if (!before || before !== after) throw new Error('journal différent après rechargement');
});
await step('mode découverte', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await shot('12-reglages'); await axe('reglages');
  await page.getByRole('button', { name: /Mode découverte/ }).click();
  await page.waitForTimeout(200);
  await shot('13-demo-aujourdhui'); await axe('demo');
  await page.getByRole('link', { name: 'Courses', exact: true }).click(); await shot('14-demo-courses');
  await page.getByRole('link', { name: 'Semaine', exact: true }).click(); await shot('15-demo-semaine');
  await page.getByRole('link', { name: 'Maison', exact: true }).click(); await page.getByRole('button', { name: 'Portions', exact: true }).click(); await shot('16-demo-portions');
  await page.getByRole('button', { name: 'À surveiller', exact: true }).click(); await shot('17-demo-surveiller');
  await page.getByRole('button', { name: 'Quitter' }).click();
});
await step('ordinateur (grille 7 colonnes)', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.waitForTimeout(200);
  await shot('18-ordinateur-semaine'); await axe('desktop');
});
await step('zoom 200 %', async () => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.getByRole('link', { name: "Aujourd'hui" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('   débordement horizontal à 200 % :', overflow);
  await shot('19-zoom200');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
});
console.log('\n--- erreurs ---\n' + (errors.join('\n') || 'aucune'));
await browser.close();
