// Lecteur de factures du drive, horloge fixée au lundi 5 octobre 2026 (facture du samedi 3) : un PDF (format fictif, fausses données personnelles)
// est lu sur le téléphone par pdf.js embarqué, sous la politique de sécurité de l'app ; ingrédients proposés et vérifiés,
// prix payés retenus, montant payé noté tout seul, recherche Auchan sur le produit déjà acheté ; fichier illisible ; texte collé.
// axe WCAG 2.2 AA sur la feuille de vérification. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { makePdf, SAMPLE_ROWS, AUCHAN_ROWS } from '../tests/pdf-fixture.ts';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T08:00:00Z'); // 10 h à Paris
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, route => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
});
await ctx.routeWebSocket(/^wss:\/\/[a-z0-9]+\.supabase\.co\//, ws => ws.onMessage(m => { const d = JSON.parse(String(m)); if (d.event === 'phx_join' || d.event === 'heartbeat') ws.send(JSON.stringify({ topic: d.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: d.ref })); })); // signal temps réel simulé (aucun réseau)
const CATALOGUE = readFileSync(new globalThis.URL('./catalogue-essai.json', import.meta.url), 'utf8'); // extrait fixe : résultat reproductible
await ctx.route('**/catalogue.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: CATALOGUE }));
const outside = [];
ctx.on('request', r => { if (!r.url().startsWith(URL) && !/^https:\/\/[a-z0-9]+\.supabase\.co\//.test(r.url()) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(MON);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };
const dlg = page.locator('dialog[open]');
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');
const pdf = { name: 'facture-exemple.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(SAMPLE_ROWS)) };

await page.goto(URL);
await step('foyer créé, menu de la semaine avec oignons, tomates et pâtes', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('le midi en boîte').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  for (const c of ['Curry de poulet', 'Lasagnes', 'Chili con carne', 'Soupe de légumes', 'Gratin dauphinois']) await page.getByRole('button', { name: c, exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click(); // budget et allergies : facultatifs
  await page.getByRole('button', { name: /Créer le foyer avec 5 plats/ }).click();
  await page.getByRole('heading', { name: 'Semaine', level: 1 }).waitFor();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: /Curry de poulet/ }).click();
  await page.getByLabel(/pour combien de portions/).fill('2');
  await page.getByLabel(/^Ingrédients/).fill('300 g de poulet\n150 g de pâtes\n2 oignons\n300 g de tomates');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('radio', { name: 'Surtout nos plats' }).check();
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: /Proposer le menu/ }).click();
  await dlg.getByRole('button', { name: '✅ Tout approuver' }).click(); // la semaine arrive prête, en liste
  await dlg.getByRole('heading', { name: /Panier prêt/ }).waitFor();
  await page.keyboard.press('Escape');
});
await step('Courses : la facture se lit sur le téléphone (pdf.js, sans envoi)', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();          // mode essentiel : les factures s'activent dans Réglages › Fonctions
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('checkbox', { name: /Factures du drive/ }).check();
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: '🧾 Lire la facture du drive', exact: true }).click();
  await dlg.getByText('Lue sur ce téléphone, sans IA ni envoi').waitFor();
  await dlg.locator('input[type=file][data-c=invoiceFile]').setInputFiles(pdf);
  await dlg.getByText('5 produits lus').waitFor({ timeout: 15000 });
  const t = await text(dlg);
  if (!/facture du sam\. 3 oct\. 2026/.test(t)) throw new Error('date de facture attendue : ' + t.slice(0, 200));
  if (!/Lecture complète/.test(t)) throw new Error('contrôle du total attendu : ' + t.slice(0, 300));
  for (const pii of ['Camille', 'Villefictive', '900000001']) if (t.includes(pii)) throw new Error('donnée personnelle affichée : ' + pii);
  await page.screenshot({ path: `${SHOTS}/facture-verification.png`, fullPage: true });
});
await step('ingrédients proposés ; « crème dessert » non rattachée ; axe', async () => {
  const vals = await dlg.locator('input[data-i=invoicePick]').evaluateAll(els => els.map(e => e.value));
  if (vals.length !== 5) throw new Error('5 champs attendus : ' + vals);
  if (!/^oignon/i.test(vals[0] ?? '') || !/^tomate/i.test(vals[1] ?? '') || !/^(œuf|oeuf)/i.test(vals[2] ?? '') || !/^pâte/i.test(vals[4] ?? '')) throw new Error('rattachements : ' + vals.join(' | '));
  if (vals[3]) throw new Error('crème dessert rattachée à tort : ' + vals[3]);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[facture] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
});
await step('prix retenus et montant payé noté en un geste', async () => {
  const box = dlg.getByRole('checkbox', { name: /Noter 13,00 € payés/ });
  if (!(await box.isChecked())) throw new Error('montant payé coché par défaut attendu');
  await dlg.getByRole('button', { name: 'Retenir ces prix' }).click();
  await page.getByText(/4 prix payés retenus · 13,00\s€ notés/).waitFor();
  await page.locator('#bud-h').waitFor();
  const card = await text(page.locator('section[aria-labelledby=bud-h]'));
  if (!/13,00 € payé/.test(card)) throw new Error('montant payé attendu dans le budget : ' + card);
  if (!/au prix payé sur vos factures du drive/.test(card)) throw new Error('source « facture » attendue : ' + card);
  await page.getByRole('button', { name: 'Effacer' }).click(); // montant effacé : la commande guidée revient
});
await step('commande guidée : recherche Auchan sur le produit déjà acheté', async () => {
  await page.getByRole('button', { name: /Commander au drive/ }).click();
  let found = '';
  const seen = [];
  for (let i = 0; i < 40 && !found; i++) {
    const t = await text(dlg);
    seen.push((await dlg.locator('h3').first().innerText().catch(() => '?')).trim());
    if (/Déjà acheté : Pâtes spaghetti 500g/.test(t)) found = t;
    else if (await dlg.getByRole('button', { name: 'Passer' }).count()) await dlg.getByRole('button', { name: 'Passer' }).click();
    else break;
  }
  if (!found) { await page.keyboard.press('Escape'); throw new Error('« Déjà acheté » attendu pour les pâtes ; articles vus : ' + seen.join(', ')); }
  const href = await dlg.locator('a.btn.block').first().getAttribute('href'); // bouton principal (les liens du conseil qualité-prix viennent avant)
  if (!href?.includes(encodeURIComponent('Pâtes spaghetti 500g'))) throw new Error('recherche sur le produit acheté attendue : ' + href);
  if (!/au prix payé le 3 oct\. 2026/.test(found)) throw new Error('coût au prix payé attendu : ' + found);
  await page.keyboard.press('Escape');
});
await step('facture au format réel d\'Auchan drive (contenu fictif) : 8 produits, total exact, date de commande', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: '🧾 Lire la facture du drive', exact: true }).click();
  await dlg.locator('input[type=file][data-c=invoiceFile]').setInputFiles({ name: 'facture-auchan-fictive.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(AUCHAN_ROWS)) });
  await dlg.getByText('8 produits lus').waitFor({ timeout: 15000 });
  const t = await text(dlg);
  if (!/Lecture complète/.test(t) || !/facture du jeu\.? 8 oct\.? 2026/i.test(t) || !/4 × 4,12\s€ = 16,46\s€/.test(t)) throw new Error('facture Auchan : ' + t.slice(0, 400));
  for (const pii of ['Camille', 'EXEMPLE', '900000001', 'CARTE CADEAU']) if (t.includes(pii)) throw new Error('donnée personnelle ou paiement affiché : ' + pii);
  await page.screenshot({ path: `${SHOTS}/facture-auchan.png`, fullPage: true });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[facture-auchan] ${v.id} (${v.impact}): ${v.help}`);
  await dlg.getByRole('button', { name: 'Lire une autre facture' }).click();
  await page.keyboard.press('Escape');
});
await step('fichier illisible : message clair ; texte collé : lu aussi', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: '🧾 Lire la facture du drive', exact: true }).click();
  await dlg.locator('input[type=file][data-c=invoiceFile]').setInputFiles({ name: 'faux.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pas un pdf') });
  await dlg.getByText('Ce fichier n\'est pas un PDF lisible.').waitFor();
  await dlg.getByText('Ou coller le texte de la facture').click();
  await dlg.getByLabel('Texte copié depuis la facture').fill('Facture du 04/10/2026\nRiz basmati 1kg 2 1,99 3,98\nTotal TTC 3,98');
  await dlg.getByRole('button', { name: 'Lire ce texte' }).click();
  await dlg.getByText('1 produit lu').waitFor();
  await page.keyboard.press('Escape');
});
await step('ticket de caisse « scanné » (texte fictif, format générique) : lignes lues, total vérifié', async () => {
  await page.getByRole('button', { name: '🧾 Lire la facture du drive', exact: true }).click();
  await dlg.getByText('ou scanner un ticket de caisse').click();
  const field = dlg.getByLabel('Texte copié depuis la facture');
  if (!/Scanner le texte/.test(await field.evaluate(el => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? ''))) throw new Error('aide « Scanner le texte » non reliée au champ');
  await field.fill('MAGASIN EXEMPLE\n12/10/2026 18:42\nLAIT 1/2 ECREME 1L        1,05\nBEURRE DOUX 250G          2,39\n2 X 1,49\nYAOURT NATURE X8          2,98\nPOULET FILET 400G         6,49\nTOTAL                    12,91\nCB                       12,91');
  await dlg.getByRole('button', { name: 'Lire ce texte' }).click();
  await dlg.getByText('4 produits lus').waitFor();
  await dlg.getByText('Lecture complète : les lignes lues font exactement le total de la facture.').waitFor();
  await page.keyboard.press('Escape');
});

await browser.close();
if (outside.length) errors.push(`appels hors de l'app : ${[...new Set(outside)].join(', ')}`);
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
