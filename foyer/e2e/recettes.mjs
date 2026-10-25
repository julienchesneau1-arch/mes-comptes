// Recettes prêtes comme chez Jow, horloge fixée au lundi 5 octobre 2026, 12 h à Paris, catalogue réel du dépôt (catalogue.json) :
// foyer neuf sans aucun plat → idées d'Aujourd'hui tirées des recettes prêtes, prévue d'un toucher ; choix d'un plat avec section
// « Recettes prêtes » et recherche ; fiche « Prévoir » sur un repas libre ; page sans nombre de personnes : le foyer le choisit, puis
// « Ajouter à nos plats ». Rien saisi à la main. axe WCAG 2.2 AA. Lancer : voir e2e/README.md
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
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');

await page.goto(URL);
await step('foyer neuf, aucun plat : les idées du repas viennent des recettes prêtes, prévue d\'un toucher', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  const idea = page.locator('.idea[data-a="pickCatalog"]').first();
  await idea.waitFor();
  const title = (await idea.locator('.title').innerText()).trim();
  await page.screenshot({ path: `${SHOTS}/recettes-idees.png`, fullPage: true });
  await idea.click();
  await page.getByText(new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} prévu ce midi · ajouté à vos plats`)).first().waitFor();
  console.log('   prévu :', title);
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('heading', { name: 'Courses', level: 1 }).waitFor();
  const lines = page.locator('main li .item-btn .title');
  await lines.nth(1).waitFor({ timeout: 3000 }).catch(async () => { throw new Error('courses vides après une recette prête : ' + (await text(page.locator('main'))).slice(0, 300)); });
});
await step('choix d\'un plat : « Recettes prêtes » pour ce repas, et la recherche', async () => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  const slot = page.locator('[data-a="slot"][data-k="2026-10-06|soir"]');
  if (!(await slot.count())) await page.getByRole('button', { name: /mardi/i }).first().click();
  await slot.first().click();
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('heading', { name: 'Recettes prêtes' }).waitFor();
  const n = await dlg.locator('[data-a="pickCatalog"]').count();
  if (n < 1) throw new Error('aucune recette prête proposée');
  await axe('choix-recettes-pretes');
  await dlg.getByLabel('Chercher ou créer un plat').fill('poulet');
  await dlg.locator('[data-a="pickCatalog"]', { hasText: /poulet/i }).first().waitFor();
  await dlg.locator('li', { has: page.locator('[data-a="pickCatalog"]', { hasText: /poulet/i }) }).first().getByRole('button', { name: /^Voir la recette/ }).click();
  await dlg.getByRole('heading', { name: 'Prévoir' }).waitFor();
  const t = await text(dlg);
  if (!/Ingrédients pour \d+/.test(t) || !/Étapes/.test(t) || !/licence CC BY-SA 4\.0/.test(t)) throw new Error('fiche : ' + t.slice(0, 300));
  await page.screenshot({ path: `${SHOTS}/recettes-fiche.png`, fullPage: true });
  await axe('fiche-recette-prete');
  const chip = dlg.locator('[data-a="pickCatalog"]').first(), when = (await chip.innerText()).trim();
  if (when !== 'Demain soir') throw new Error('le repas d\'où la fiche est ouverte doit venir en premier : ' + when);
  await chip.click();
  await page.getByText(new RegExp(`prévu ${when.toLowerCase()}`)).first().waitFor();
});
await step('Nos plats : « N recettes prêtes » ; page sans nombre de personnes : le foyer le dit, puis « Ajouter »', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  const promo = await text(page.locator('.ready-promo'));
  const count = Number(/(\d+) recettes prêtes/.exec(promo)?.[1] ?? 0);
  if (count < 400) throw new Error('catalogue : ' + promo);
  await page.getByRole('button', { name: 'Parcourir les recettes prêtes' }).click();
  await dlg.locator('[data-a="discoverOpen"]', { hasText: 'nombre de personnes à préciser' }).first().click();
  await dlg.getByRole('heading', { name: 'Ces quantités sont pour combien de personnes ?' }).waitFor();
  if (await dlg.getByRole('button', { name: 'Ajouter à nos plats' }).count()) throw new Error('ajout possible sans nombre de personnes');
  await dlg.getByRole('group', { name: 'Nombre de personnes' }).getByRole('button', { name: '4', exact: true }).click();
  await dlg.getByRole('button', { name: 'Ajouter à nos plats' }).click();
  await page.getByText(/ajouté à vos plats/).first().waitFor();
  console.log(`   ${count} recettes prêtes au catalogue`);
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
