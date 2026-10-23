// Reprises Pimzi, horloge fixée au lundi 5 octobre 2026, 12 h à Paris : budget et allergies demandés à l'accueil (gluten, lait, porc
// refusé), menu proposé et approuvé sans aucun plat qui en contienne (catalogue réel du dépôt), courses sans pâtes, farine, lait ni
// beurre, « étiquette à vérifier » sur un produit transformé, fiche d'un plat qui en contient. axe WCAG 2.2 AA. Lancer : voir e2e/README.md
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
// Ingrédients qui sont le gluten ou le lait (jamais dans la liste d'un foyer qui les exclut).
const FORBIDDEN = /^(farine|pâtes?|spaghettis?|tagliatelles?|pain|semoule|chapelure|couscous|lait|beurre|crème|fromage|gruyère|parmesan|emmental|mozzarella|yaourt)\b/i;

await page.goto(URL);
await step('accueil : budget facultatif, allergies (gluten, lait) et un aliment refusé (porc)', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('le midi en boîte').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('heading', { name: 'Budget et allergies' }).waitFor();
  await page.getByText('Étape 4 sur 4').waitFor();
  await page.getByRole('checkbox', { name: 'Gluten' }).check();
  await page.getByRole('checkbox', { name: 'Lait' }).check();
  await page.getByLabel('Aliments refusés').fill('porc');
  await page.screenshot({ path: `${SHOTS}/pimzi-accueil.png`, fullPage: true });
  await axe('accueil-allergies');
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByText('Jamais proposé : gluten, lait, porc').waitFor();
});
await step('menu proposé et approuvé : aucun ingrédient qui est du gluten ou du lait dans les courses', async () => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: /Proposer le menu/ }).click();
  await dlg.getByText('Tout est prêt : approuvez, ou changez un repas.').waitFor({ timeout: 15000 });
  console.log('   menu :', (await dlg.locator('.recap .title').allInnerTexts()).join(' · '));
  await dlg.getByRole('button', { name: '✅ Tout approuver' }).click();
  await dlg.getByRole('heading', { name: /Panier prêt/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.locator('main li .item-btn .title').first().waitFor();
  const titles = await page.locator('main li .item-btn .title').allInnerTexts();
  if (titles.length < 3) throw new Error(`liste trop courte : ${titles.join(', ')}`);
  const bad = titles.filter(t => FORBIDDEN.test(t.trim()));
  if (bad.length) throw new Error(`ingrédients exclus dans les courses : ${bad.join(', ')}`);
  const alerts = await page.locator('main li .sub.alert').allInnerTexts();
  console.log(`   ${titles.length} lignes ; alertes : ${alerts.length ? alerts.join(' · ') : 'aucune'}`);
  if (alerts.some(a => /exclu chez vous|refusé chez vous/.test(a))) throw new Error(`plat exclu au menu : ${alerts.join(' · ')}`);
  await page.screenshot({ path: `${SHOTS}/pimzi-courses.png`, fullPage: true });
  await axe('courses-allergies');
});
await step('fiche d\'un plat : « contient » et « à vérifier sur l\'étiquette », exclu des propositions', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Crêpes');
  await dlg.getByLabel(/^Ingrédients/).fill('250 g de farine\n50 cl de lait\n1 cube de bouillon');
  const t = await text(dlg.locator('#ing-preview'));
  if (!/Gluten \(farine\) : ce plat n'est plus proposé/.test(t)) throw new Error('bandeau d\'exclusion absent : ' + t.slice(0, 300));
  if (!/Allergènes d'après les ingrédients : gluten \(exclu chez vous\), lait \(exclu chez vous\)\./.test(t)) throw new Error('allergènes : ' + t.slice(0, 300));
  if (!/à vérifier sur l'étiquette : céleri\./.test(t)) throw new Error('à vérifier : ' + t.slice(0, 300));
  await axe('fiche-allergenes');
  await page.keyboard.press('Escape');
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
