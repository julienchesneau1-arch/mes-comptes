// Rituel batch, horloge fixée : samedi 10 octobre 2026 (jour des courses) puis dimanche 11 (jour du batch).
// Rituel activé depuis Aujourd'hui, menu en cartes avec plats « Batch », drive sans prix à saisir, budget estimé tout seul, montant payé, bilan,
// puis séance de batch (à préparer en une fois, « Prêt », célébration). axe WCAG 2.2 AA clair et sombre.
// Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const SAT = new Date('2026-10-10T08:00:00Z'), SUN = new Date('2026-10-11T08:30:00Z'); // 10 h et 10 h 30 à Paris
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => { // relais muet : aucun appel sortant
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
});
const CATALOGUE = readFileSync(new globalThis.URL('./catalogue-essai.json', import.meta.url), 'utf8'); // extrait fixe : résultat reproductible
await ctx.route('**/catalogue.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: CATALOGUE }));
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
await page.clock.setFixedTime(SAT);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const shot = async name => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const axe = async name => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };
const dlg = page.locator('dialog[open]');
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');

await page.goto(URL);
await step('foyer créé (samedi)', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('le midi en boîte').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  for (const c of ['Curry de poulet', 'Lasagnes', 'Chili con carne', 'Soupe de légumes', 'Gratin dauphinois']) await page.getByRole('button', { name: c, exact: true }).click();
  await page.getByRole('button', { name: /Créer le foyer avec 5 plats/ }).click();
  await page.getByRole('heading', { name: 'Semaine', level: 1 }).waitFor();
  // Deux recettes complètes : de quoi calculer courses, mise en place commune et ingrédients partagés.
  for (const [name, lines] of [['Curry de poulet', '600 g de poulet\n300 g riz cru\n400 ml de lait de coco\n2 oignons'], ['Chili con carne', '500 g de boeuf haché\n2 oignons\n1 poivron\n400 g de haricots rouges']]) {
    await page.getByRole('link', { name: 'Maison', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByLabel(/pour combien de portions/).fill('4');
    await page.getByLabel(/^Ingrédients/).fill(lines);
    await page.getByRole('button', { name: 'batch', exact: true }).click(); // étiquette « se prépare à l'avance »
    await page.getByRole('button', { name: 'Enregistrer' }).click();
  }
});
await step('rituel présenté sur Aujourd\'hui, activé en un geste', async () => {
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await page.locator('#guide-h').waitFor(); // « Premiers pas » : une seule étape visible, la liste complète repliée
  await page.getByText('Toutes les étapes').click();
  await page.getByText('Choisir notre rituel : courses le samedi, batch le dimanche').waitFor();
  await shot('r01-promo'); await axe('promo');
  await page.locator('section[aria-labelledby="guide-h"] [data-a="ritual"]').click();
  await dlg.getByRole('button', { name: /Activer : courses le samedi, batch le dimanche/ }).click();
  await dlg.getByRole('heading', { name: 'Quand ?' }).waitFor();
  await shot('r02-rituel'); await axe('rituel');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'D\'abord, le menu' }).waitFor(); // samedi = jour des courses, menu encore vide
  await shot('r03-samedi-menu');
});
await step('menu en cartes : plats marqués « Batch », un retiré, semaine validée', async () => {
  await page.getByRole('button', { name: /Choisir les repas du 12 au 18 oct\./ }).first().click();
  await dlg.getByText(/^Repas 1 sur \d+/).waitFor();
  if (!(await dlg.locator('.badge', { hasText: 'Batch' }).count())) throw new Error('badge « Batch » absent de la première carte');
  await shot('r04-carte-batch');
  await dlg.getByRole('button', { name: /Garder tout le menu proposé/ }).click();
  await dlg.getByText(/Batch du dimanche 11 octobre/).waitFor();
  const before = await dlg.locator('[data-a="deckBatch"][aria-pressed="true"]').count();
  await dlg.locator('[data-a="deckBatch"][aria-pressed="true"]').last().click();
  const after = await dlg.locator('[data-a="deckBatch"][aria-pressed="true"]').count();
  if (after !== before - 1) throw new Error(`bascule batch : ${before} → ${after}`);
  console.log('   batch :', (await text(dlg.locator('.banner.info').last())));
  await shot('r05-recap-batch'); await axe('recap-batch');
  await dlg.getByRole('button', { name: 'Valider la semaine' }).click();
  await dlg.getByRole('heading', { name: /Panier prêt/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: 'Semaine suivante' }).click();
  await page.getByRole('button', { name: 'Toute la semaine' }).click().catch(() => {});
  const chips = await page.locator('.slot.s-a-cuisiner .chip', { hasText: 'batch dim.' }).count(); // les restes de ces plats portent aussi la pastille
  if (chips !== after) throw new Error(`${chips} repas marqués batch dans la semaine, attendu ${after}`);
  await shot('r06-semaine-batch'); await axe('semaine-batch');
});
await step('feuille du batch (samedi) : programme, à ajouter, mise en place, courses', async () => {
  await page.getByRole('button', { name: /Batch du dim\. 11 oct\./ }).click();
  await dlg.getByRole('heading', { name: 'Au programme' }).waitFor();
  const t = await text(dlg);
  if (!/boîte à emporter/.test(t)) throw new Error('boîtes absentes');
  if (!/À préparer en une fois/.test(t)) throw new Error('mise en place absente');
  console.log('   batch :', t.slice(0, 260));
  await shot('r07-batch-samedi'); await axe('batch-samedi');
  await page.keyboard.press('Escape');
});
await step('jour des courses : drive sans prix à saisir, estimation automatique', async () => {
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await page.getByRole('heading', { name: 'Jour des courses' }).waitFor();
  await shot('r08-samedi-courses'); await axe('samedi-courses');
  await page.getByRole('button', { name: 'Commander au drive' }).first().click();
  await dlg.getByText(/Article 1 sur/).waitFor();
  // Un article compté en pièces (oignon, poivron…) : contenance « 1 », le nombre de paquets se calcule.
  for (let i = 0; i < 40 && !/Besoin : \d+(,\d+)? pièces?/.test(await dlg.locator('section').first().innerText()); i++) await dlg.getByRole('button', { name: 'Passer' }).click();
  await dlg.locator('summary', { hasText: 'Retenir le produit choisi' }).click();
  await dlg.getByLabel('Lien du produit chez Auchan').fill('https://www.auchan.fr/auchan-produit-essai/pr-C1000009');
  await dlg.getByLabel(/Contenance d'un paquet/).fill('1');
  if (await dlg.getByLabel(/Prix d'un paquet/).count()) throw new Error('aucun prix ne doit être demandé');
  await dlg.getByRole('button', { name: 'Retenir ce produit' }).click();
  await dlg.getByText(/À mettre au panier : \d+ ×/).first().waitFor();
  await axe('drive-prix');
  console.log('   drive :', (await text(dlg.locator('section').first())).slice(0, 200));
  await page.keyboard.press('Escape');
});
await step('courses : budget, montant payé, jauge', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('heading', { name: /Budget de la semaine/ }).waitFor();
  await page.getByRole('button', { name: 'Fixer un budget' }).click();
  await dlg.getByLabel(/Par semaine, en euros/).fill('90');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.keyboard.press('Escape');
  const est = await text(page.locator('section', { has: page.getByRole('heading', { name: /Budget de la semaine/ }) }));
  if (!/\d+,\d{2}\s€\s*panier estimé/.test(est)) throw new Error('panier estimé automatiquement attendu : ' + est);
  if (!/Insee/.test(est)) throw new Error('source des prix attendue : ' + est);
  await page.locator('summary', { hasText: 'Noter le montant payé' }).click();
  await page.getByLabel(/Montant payé au drive/).fill('64,30');
  await page.getByRole('button', { name: 'Noter', exact: true }).click();
  await page.locator('[role="meter"]').waitFor();
  const card = await text(page.locator('section', { has: page.getByRole('heading', { name: /Budget de la semaine/ }) }));
  if (!/64,30\s€ payés sur 90,00\s€/.test(card)) throw new Error(card);
  console.log('   budget :', card.slice(0, 200));
  await shot('r09-courses-budget'); await axe('courses-budget');
});
await step('bilan', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Bilan', exact: true }).click();
  await page.getByRole('heading', { name: 'Semaine par semaine' }).waitFor();
  console.log('   bilan :', (await text(page.locator('main'))).slice(0, 240));
  await shot('r10-bilan'); await axe('bilan');
});
await step('dimanche : séance de batch jusqu\'à la célébration', async () => {
  await page.clock.setFixedTime(SUN);
  await page.goto(URL + '#aujourdhui');
  await page.getByRole('heading', { name: /C'est l'heure du batch/ }).waitFor();
  await shot('r11-dimanche'); await axe('dimanche');
  await page.getByRole('button', { name: 'Lancer la session' }).click();
  await dlg.getByRole('heading', { name: 'En cuisine' }).waitFor();
  await shot('r12-session'); await axe('session');
  for (let i = 0; i < 8 && await dlg.getByRole('button', { name: /^Prêt :/ }).count(); i++) {
    await dlg.getByRole('button', { name: /^Prêt :/ }).first().click();
    await page.waitForTimeout(150);
  }
  await dlg.getByRole('heading', { name: /Batch terminé/ }).waitFor();
  await shot('r13-batch-termine'); await axe('batch-termine');
  await page.keyboard.press('Escape');
});
await step('sombre : Aujourd\'hui, batch, courses, bilan', async () => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(URL + '#aujourdhui'); await page.waitForTimeout(200); await axe('sombre-aujourdhui'); await shot('r14-sombre');
  await page.getByRole('button', { name: /Voir le batch|Lancer la session/ }).click(); await dlg.waitFor(); await axe('sombre-batch'); await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Courses', exact: true }).click(); await page.getByRole('button', { name: 'Semaine précédente' }).click(); await axe('sombre-courses'); await shot('r15-sombre-courses');
  await page.getByRole('link', { name: 'Maison', exact: true }).click(); await page.getByRole('button', { name: 'Bilan', exact: true }).click(); await axe('sombre-bilan');
});

console.log('\n--- erreurs ---');
console.log(errors.length ? errors.join('\n') : 'aucune');
await browser.close();
process.exit(errors.length ? 1 : 0);
