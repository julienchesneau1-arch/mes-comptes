// « Déjà au placard ? » sur deux semaines, horloge fixée au lundi 28 septembre 2026 puis au lundi 5 octobre, 12 h à Paris :
// spaghetti prévus mardi, paquet de 500 g retenu au drive et pris pour 300 g ; la semaine suivante en redemande : « À régler »
// propose le reste (200 g), « On en a » le déduit de la liste. axe WCAG 2.2 AA. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const WEEK1 = new Date('2026-09-28T10:00:00Z'), WEEK2 = new Date('2026-10-05T10:00:00Z');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
});
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(WEEK1);
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
const spaghetti = page.locator('main li', { has: page.locator('[data-key="spaghetti|masse"]') });
// Prévoir le plat sur un créneau de la semaine affichée (Semaine › créneau › Choisir un plat).
const plan = async (k, dayLabel) => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  const slot = page.locator(`[data-a="slot"][data-k="${k}"]`);
  if (!(await slot.count())) await page.getByRole('button', { name: dayLabel }).first().click();
  await slot.first().click();
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Spaghetti bolo/ }).click();
  await page.getByText(/Spaghetti bolo prévu/).first().waitFor();
  await page.keyboard.press('Escape'); // la feuille du créneau se rouvre après le choix
};

await page.goto(URL);
await step('semaine 1 : foyer d\'une personne, plat prévu mardi soir', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Spaghetti bolo');
  await dlg.getByLabel(/pour combien de portions/).fill('1');
  await dlg.getByLabel(/^Ingrédients/).fill('300 g de spaghetti');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await plan('2026-09-29|soir', /mardi/i);
});
await step('semaine 1 : paquet de 500 g retenu au drive, pris pour 300 g', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await spaghetti.locator('.item-btn').click();
  await dlg.locator('summary', { hasText: 'Retenir le produit choisi' }).click();
  await dlg.getByLabel('Lien du produit chez Auchan').fill('https://www.auchan.fr/spaghetti-500g/pr-C1234567');
  await dlg.getByLabel(/Contenance d'un paquet/).fill('500 g');
  await dlg.getByRole('button', { name: 'Retenir ce produit' }).click();
  await page.getByText(/Produit retenu pour/).waitFor();
  await page.keyboard.press('Escape');
  if (!/Auchan : 1 × 500 g · 500 g pour 300 g/.test(await text(spaghetti))) throw new Error('paquets : ' + await text(spaghetti));
  await spaghetti.locator('label.check').click(); // la ligne est redessinée : pas de check() (il relit l'ancienne case)
  await page.locator('main input[data-key="spaghetti|masse"]:checked').waitFor({ state: 'attached' }); // « pris » (la ligne passe dans les articles pris)
});
await step('semaine 2 : la liste redemande des spaghetti, « À régler » propose le reste du paquet', async () => {
  await page.clock.setFixedTime(WEEK2);
  await page.reload();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();          // mode essentiel : « Déjà au placard ? » s'active dans Réglages › Fonctions
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('checkbox', { name: /Déjà au placard/ }).check();
  await plan('2026-10-06|soir', /mardi/i);
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  const card = page.locator('li.exc', { hasText: 'Spaghetti : il devrait en rester 200 g' });
  await card.waitFor();
  const t = await text(card);
  if (!/Paquet de 500 g pris pour la semaine du 28 au 4 oct\., où il en fallait 300 g\. Cette semaine, il en faut 300 g\./.test(t)) throw new Error('carte : ' + t);
  await page.screenshot({ path: `${SHOTS}/placard-carte.png`, fullPage: true });
  await axe('placard');
  await card.getByRole('button', { name: 'On en a (200 g)' }).click();
  await card.waitFor({ state: 'detached' });
});
await step('« On en a » : 200 g déduits, il reste 100 g à acheter', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  const t = await text(spaghetti);
  if (!/déjà là : 200 g \(besoin 300 g\)/.test(t) || !/100 g/.test(t)) throw new Error('ligne : ' + t);
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
