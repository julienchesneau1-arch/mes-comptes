// V3.14, horloge fixée au lundi 5 octobre 2026, 12 h à Paris : dates limites lues et utiles. Curry de poulet prévu samedi ;
// « 📷 Scanner une date limite » : le poulet de la liste en un toucher, la date « scannée » (le texte que l'iPhone insère avec
// « Scanner le texte » est simulé en le tapant dans le champ), lue DLC mer. 7 oct. ; Aujourd'hui propose d'avancer le curry avant
// la DLC, un toucher ; texte sans date : rien deviné ; année absente : déduite et signalée ; « Enregistrer et scanner un autre ».
// axe WCAG 2.2 AA. Lancer : voir e2e/README.md
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
await ctx.routeWebSocket(/^wss:\/\/[a-z0-9]+\.supabase\.co\//, ws => ws.onMessage(m => { const d = JSON.parse(String(m)); if (d.event === 'phx_join' || d.event === 'heartbeat') ws.send(JSON.stringify({ topic: d.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: d.ref })); }));
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(MON);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };
const axe = async name => {
  await page.waitForFunction(() => !document.getAnimations().some(a => a instanceof CSSTransition && a.playState === 'running'));
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const dlg = page.locator('dialog[open]');
const tab = name => page.getByRole('link', { name, exact: true }).click();
const slotIn = async (day, key) => {
  await tab('Semaine');
  const slot = page.locator(`[data-a="slot"][data-k="${key}"]`);
  if (!(await slot.count())) await page.getByRole('button', { name: new RegExp(`^${day}`, 'i') }).first().click();
  return slot.first();
};

await page.goto(URL);
await step('foyer neuf ; Curry de poulet prévu samedi soir', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await tab('Maison');
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Curry de poulet');
  await dlg.getByLabel(/pour combien de portions/).fill('4');
  await dlg.getByLabel(/^Ingrédients/).fill('600 g de poulet\n300 g de riz\n40 cl de lait de coco');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await (await slotIn('samedi 10 octobre', '2026-10-10|soir')).click();
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Curry de poulet/ }).first().click();
  await page.keyboard.press('Escape');
});
await step('scanner une date : le poulet de la liste en un toucher, date lue (DLC mer. 7 oct.), suggestion annoncée', async () => {
  await tab('Courses');
  await page.getByRole('button', { name: '📷 Scanner une date limite' }).click();
  await dlg.getByRole('heading', { name: /Scanner une date limite/ }).waitFor();
  await dlg.getByRole('button', { name: 'Poulet', exact: true }).click();                  // produit frais de la liste
  if (await dlg.getByLabel('Produit', { exact: true }).inputValue() !== 'Poulet') throw new Error('nom non repris');
  await dlg.getByLabel('Date imprimée').fill('A CONSOMMER JUSQU\'AU 07.10.26  L1234  4°C');      // texte inséré par « Scanner le texte »
  await dlg.getByText('Lu : DLC mer. 7 oct. 2026').waitFor();
  await page.keyboard.press('Tab');                                                          // le formulaire se met à jour
  await dlg.locator('summary', { hasText: 'Vérifier ou corriger' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/dates-scan.png`, fullPage: true });
  await axe('dates-scan');
  await dlg.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByText('Poulet : date proche, une suggestion vous attend dans Aujourd\'hui').first().waitFor();
});
await step('Aujourd\'hui : « Avancer » le curry avant la DLC, un toucher ; la carte disparaît', async () => {
  await tab('Aujourd\'hui');
  const card = page.locator('li', { hasText: /Poulet : à consommer avant le mer\. 7 oct\., mais Curry de poulet est prévu/ }).first();
  await card.waitFor();
  await page.screenshot({ path: `${SHOTS}/dates-aregler.png`, fullPage: true });
  await axe('dates-aregler');
  await card.getByRole('button', { name: /^Avancer/ }).first().click();
  await page.getByText(/Poulet : avancer/).first().waitFor();
  if (await page.locator('li', { hasText: /Poulet : à consommer avant/ }).count()) throw new Error('carte encore affichée');
  const wed = await slotIn('mercredi 7 octobre', '2026-10-07|soir');
  if (!/Curry de poulet/.test(await wed.innerText())) throw new Error('curry non avancé au mercredi soir : ' + await wed.innerText());
});
await step('texte sans date : rien deviné ; année absente : déduite et signalée ; enregistrer et scanner un autre', async () => {
  await tab('Courses');
  await page.getByRole('button', { name: '📷 Scanner une date limite' }).click();
  if (await dlg.getByRole('button', { name: 'Poulet', exact: true }).count()) throw new Error('poulet déjà surveillé encore proposé');
  await dlg.getByLabel('Produit', { exact: true }).fill('Crème fraîche');
  await dlg.getByLabel('Date imprimée').fill('Lot 12345');
  await dlg.getByText(/Aucune date reconnue/).waitFor();
  await dlg.getByLabel('Date imprimée').fill('DLC 09/10');
  await dlg.getByText('Lu : DLC ven. 9 oct. 2026 (année déduite : vérifiez)').waitFor();
  await page.keyboard.press('Tab');
  await dlg.getByRole('button', { name: 'Enregistrer et scanner un autre' }).click();
  await page.getByText('Crème fraîche surveillé (DLC ven. 9 oct. 2026)').first().waitFor();
  await dlg.getByRole('heading', { name: /Scanner une date limite/ }).waitFor();
  if (await dlg.getByLabel('Produit', { exact: true }).inputValue()) throw new Error('feuille suivante non vide');
  await page.keyboard.press('Escape');
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
