// Parcours complet sur téléphone (390×844) puis ordinateur : création du foyer, recette, proposition, courses, rechargement, découverte, zoom 200 %, contrôle axe WCAG 2.2 AA.
// Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
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
// Catalogue de découvertes : extrait fixe (3 vraies pages Wikilivres) pour des résultats reproductibles.
const CATALOGUE = readFileSync(new globalThis.URL('./catalogue-essai.json', import.meta.url), 'utf8');
await ctx.route('**/catalogue.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: CATALOGUE }));
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
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };

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
  const n = await page.locator('dialog[open]').getByText(/^Nouveau : /).count();
  if (n < 1 || n > 3) throw new Error(`${n} découverte(s) proposée(s), attendu 1 à 3`);
  console.log('   découvertes :', (await page.locator('dialog[open]').getByText(/^Nouveau : /).allInnerTexts()).join(' · '));
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
  // Ligne visée par sa clé : « .first() » se re-résoudrait après le rendu et cocherait les lignes suivantes.
  const key = await page.locator('input[data-c="shopCheck"]').first().getAttribute('data-key');
  if (key) await page.locator(`input[data-c="shopCheck"][data-key="${key}"]`).check({ force: true });
  const left = await page.locator('main section input[data-c="shopCheck"]:not(:checked)').count();
  if (left < 3) throw new Error(`une seule coche attendue, il reste ${left} lignes`);
  await shot('09-courses-coche');
});
await step('drive Auchan assisté (aucune page Auchan ouverte pendant le test)', async () => {
  await page.getByRole('button', { name: 'Commander chez Auchan' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByText(/Article 1 sur/).waitFor();
  const total = /Article 1 sur (\d+)/.exec(await dlg.innerText())?.[1];
  const first = (await dlg.locator('h3').first().innerText()).trim();
  const href = await dlg.getByRole('link', { name: /chez Auchan/ }).first().getAttribute('href');
  if (!href?.startsWith('https://www.auchan.fr/recherche?text=')) throw new Error('lien de recherche attendu : ' + href);
  await dlg.locator('summary', { hasText: 'Retenir le produit choisi' }).click();
  await dlg.getByLabel('Lien du produit chez Auchan').fill('Copié : https://www.auchan.fr/le-gaulois-filet-de-poulet-blanc/pr-C1158275?utm=x');
  await dlg.getByLabel(/Contenance d'un paquet/).fill('300 g');
  await axe('drive');
  await dlg.getByRole('button', { name: 'Retenir ce produit' }).click();
  await page.getByText(/Produit retenu pour/).waitFor();
  const href2 = await dlg.getByRole('link', { name: /chez Auchan/ }).first().getAttribute('href');
  if (href2 !== 'https://www.auchan.fr/le-gaulois-filet-de-poulet-blanc/pr-C1158275') throw new Error('lien produit attendu : ' + href2);
  console.log('   ', first, '→', (await dlg.locator('section').first().innerText()).replace(/\s+/g, ' ').slice(0, 160));
  await shot('09b-drive');
  await dlg.getByRole('button', { name: 'Ajouté au panier' }).click();
  await dlg.getByText(`Article 2 sur ${total}`).waitFor();
  if ((await dlg.locator('h3').first().innerText()).trim() === first) throw new Error('l\'article n\'a pas avancé');
  await page.keyboard.press('Escape');
});
await step('découvrir des recettes (catalogue) et en ajouter une après relecture', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Découvrir des recettes' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('heading', { name: 'Découvrir des recettes' }).waitFor();
  await axe('decouvrir');
  await dlg.getByRole('button', { name: 'Poisson', exact: true }).click();
  await dlg.getByText('Salade niçoise', { exact: true }).waitFor();  // seul poisson de l'extrait
  if (await dlg.getByText('Ratatouille', { exact: true }).count()) throw new Error('filtre Poisson sans effet');
  await dlg.getByRole('button', { name: 'Tout', exact: true }).click();
  await dlg.getByLabel('Chercher un plat ou un ingrédient').fill('ratatouille'); // sans nombre de personnes : jamais proposée d'office
  await dlg.getByText('Ratatouille', { exact: true }).waitFor();
  const first = dlg.locator('[data-a="discoverOpen"]').first();
  const title = (await first.locator('.title').innerText()).trim();
  await first.click();
  await dlg.getByRole('button', { name: /Ajouter à nos plats/ }).waitFor();
  await dlg.getByText('nombre de personnes à préciser').waitFor();
  await axe('decouvrir-recette'); await shot('09c-decouvrir');
  await dlg.getByRole('button', { name: /Ajouter à nos plats/ }).click();
  await dlg.getByText(/Wikilivres : \d+ ingrédient.*rendement non trouvé/).waitFor();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText(/Indiquez pour combien de portions/).waitFor(); // refusé tant que le nombre manque : jamais de quantité sans base
  await dlg.locator('input[name="yield"]').fill('4');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText(`${title} enregistré`).waitFor();
  await page.getByRole('button', { name: 'Nos plats' }).click().catch(() => {});
  await page.getByText(title, { exact: true }).first().waitFor();
  console.log('   ajouté :', title);
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
  // Rappels : permission non accordée dans ce navigateur de test → message clair, rien d'activé.
  await page.getByRole('button', { name: 'Activer les rappels' }).click();
  const why = page.getByText(/Notifications refusées|synchro automatique|ne reçoit pas de notifications/);
  await why.waitFor();
  console.log('   rappels :', (await why.innerText()).slice(0, 90));
  await page.getByRole('button', { name: 'Activer les rappels' }).waitFor();
  await page.getByRole('button', { name: 'Diagnostic de ce téléphone' }).click();
  const diag = page.locator('dialog[open]');
  await diag.getByText('Chiffrement').waitFor();
  const n = await diag.locator('li').count();
  if (n !== 9) throw new Error(`${n} contrôles au lieu de 9`);
  console.log('   diagnostic :', (await diag.locator('ul').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await axe('diagnostic'); await shot('12b-diagnostic');
  await page.keyboard.press('Escape');
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
