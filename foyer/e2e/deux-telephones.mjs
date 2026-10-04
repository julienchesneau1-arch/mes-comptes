// Deux téléphones, un vrai lien chiffré ; « on a mangé » avec rendement réel ; déplacer avec aperçu ; clavier seul.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
// Le relais réel est configuré dans l'app : chaque téléphone a ici son propre relais muet, pour éprouver la synchro par lien seule.
const mute = route => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const m = route.request().method();
  return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
};
const mk = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, mute);
  const page = await ctx.newPage(); page.setDefaultTimeout(6000);
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return page;
};
const errors = [];
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 6).join(' | ')); errors.push(`${label}: ${e.message.split('\n')[0]}`); for (const [n, p] of [['A', A], ['B', B]]) await p.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 12).replace(/\W/g, '_')}-${n}.png` }).catch(() => {}); } };
const A = await mk(), B = await mk();
const linkOf = async p => p.evaluate(() => navigator.clipboard.readText());
// Synchro automatique active : l'envoi d'un lien se fait depuis la feuille Synchro.
const sendLink = async p => {
  await p.getByRole('link', { name: "Aujourd'hui", exact: true }).click();
  await p.getByRole('button', { name: /^Synchro/ }).click();
  await p.locator('dialog[open]').getByRole('button', { name: /^Envoyer un lien/ }).click();
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); // referme la feuille Synchro
  await p.locator('dialog[open]').waitFor({ state: 'detached' });
};

await step('A crée le foyer avec un plat complet', async () => {
  await A.goto(URL);
  await A.getByRole('button', { name: 'Créer notre foyer' }).click();
  await A.getByLabel('Prénom de la personne 1').fill('Alex');
  await A.getByLabel('Prénom de la personne 2 (facultatif)').fill('Sam');
  await A.getByRole('button', { name: 'Continuer' }).click();
  await A.getByText('le midi en boîte').click();
  await A.getByRole('button', { name: 'Continuer' }).click();
  await A.getByRole('button', { name: /Créer le foyer/ }).click();
  await A.getByRole('link', { name: 'Maison', exact: true }).click();
  await A.getByRole('button', { name: 'Coller une recette' }).first().click();
  await A.getByLabel('Texte de la recette').fill('Curry de poulet (pour 4 personnes)\nIngrédients\n600 g de poulet\n300 g de riz cru\n400 ml de lait de coco\nPréparation\n1. Cuire.');
  await A.getByRole('button', { name: 'Analyser' }).click();
  await A.getByText(/Lu : 3 ingrédient/).waitFor();
  await A.getByRole('button', { name: 'Enregistrer' }).click();
  await A.getByRole('link', { name: 'Semaine', exact: true }).click();
  await A.getByRole('button', { name: 'Proposer les repas vides' }).click();
  await A.getByRole('button', { name: /Accepter/ }).click();
});
let code = '';
await step('A envoie un lien chiffré (presse-papiers)', async () => {
  await sendLink(A);
  const t = await linkOf(A);
  if (!/#s=F1\./.test(t)) throw new Error('pas de lien : ' + t.slice(0, 80));
  if (/Curry|poulet/.test(t.split('#s=')[1])) throw new Error('contenu en clair dans le lien');
  code = await A.evaluate(() => JSON.parse(localStorage.getItem('foyer:appareil')).code);
  B.__link = t.match(/https?:\S+/)[0];
  console.log('   lien :', Math.round(B.__link.length / 1024 * 10) / 10, 'Ko');
});
await step('B ouvre le lien, mauvais code refusé puis bon code', async () => {
  await B.goto(B.__link);
  await B.getByLabel('Code (12 signes)').fill('ABCD-EFGH-JKLM');
  await B.getByRole('button', { name: 'Ouvrir le lien' }).click();
  await B.getByText('Code incorrect').waitFor();
  await B.getByLabel('Code (12 signes)').fill(code);
  await B.getByRole('button', { name: 'Ouvrir le lien' }).click();
  await B.getByRole('heading', { name: 'Membres du foyer' }).waitFor();
  await B.getByRole('radio', { name: 'Sam' }).check();
  await B.getByRole('button', { name: 'Enregistrer' }).click();
});
const coursesText = async p => { await p.getByRole('link', { name: 'Courses', exact: true }).click(); await p.getByRole('heading', { name: 'Courses', level: 1 }).waitFor(); return (await p.locator('main').innerText()).replace(/\s+/g, ' '); };
await step('A et B voient la même liste de courses', async () => {
  const a = await coursesText(A), b = await coursesText(B);
  if (a !== b) { console.log("A:", a); console.log("B:", b); throw new Error("différent"); }
  if (!/Poulet/.test(a)) throw new Error('liste vide');
});
await step('B déclare une absence, renvoie ; A reçoit, portions recalculées', async () => {
  await B.getByRole('link', { name: 'Semaine', exact: true }).click();
  await B.locator('button.slot').filter({ hasText: 'Curry' }).first().click();
  await B.locator('dialog[open]').getByRole('radio', { name: 'Dehors' }).nth(1).check();
  await B.waitForTimeout(300);
  await B.keyboard.press('Escape');
  await sendLink(B);
  const link = (await linkOf(B)).match(/https?:\S+/)[0];
  await A.goto(link);
  await A.getByText(/Synchronisé/).waitFor();
  const a = await coursesText(A), b = await coursesText(B);
  if (a !== b) throw new Error('listes différentes après retour');
  console.log('   après absence :', a.match(/Poulet[^0-9]*\d+ g/)?.[0]);
});
await step('déplacer avec aperçu des conséquences', async () => {
  const slot = A.locator('button.slot').filter({ hasText: /\+ Ajouter/ }).first();
  await A.getByRole('link', { name: 'Semaine', exact: true }).click();
  const other = A.locator('button.slot').filter({ hasText: /Curry/ }).first();
  await other.click();
  await A.locator('dialog[open]').getByRole('button', { name: 'Déplacer' }).click();
  await A.locator('dialog[open] [data-a="moveTo"]').filter({ hasText: /^Mercredi soir/ }).click();
  await A.locator('dialog[open]').getByText('Ce qui va changer').waitFor();
  console.log('   aperçu :', (await A.locator('dialog[open] .impacts').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await A.locator('dialog[open]').getByRole('button', { name: /Déplacer|Échanger/ }).last().click();
  await A.getByText(/Repas déplacé|Repas échangés/).waitFor();
  void slot;
});
await step('« On a mangé » avec portions liées → rendement demandé, sans validation implicite', async () => {
  await A.getByRole('link', { name: 'Semaine', exact: true }).click();
  if (await A.getByRole('button', { name: 'Toute la semaine' }).count()) await A.getByRole('button', { name: 'Toute la semaine' }).click();
  const card = A.locator('button.slot').filter({ hasText: /À cuisiner/ }).first();
  await card.click();
  await A.locator('dialog[open]').getByRole('button', { name: 'On a mangé' }).click();
  const dlg = A.locator('dialog[open]');
  await dlg.getByText('combien de portions en tout').waitFor();
  await dlg.getByRole('button', { name: 'Une portion de moins' }).click();
  const label = await dlg.getByRole('button', { name: /Confirmer/ }).innerText();
  console.log('   bouton :', label);
  await dlg.getByRole('button', { name: /Confirmer/ }).click();
  await A.getByText(/Noté : préparé/).waitFor();
});
await step('clavier seul : ouvrir un créneau, fermer, focus rendu', async () => {
  await A.getByRole('link', { name: 'Semaine', exact: true }).focus();
  for (let i = 0; i < 40; i++) { await A.keyboard.press('Tab'); if (await A.evaluate(() => document.activeElement?.classList.contains('slot'))) break; }
  const before = await A.evaluate(() => document.activeElement?.getAttribute('data-k'));
  await A.keyboard.press('Enter');
  await A.locator('dialog[open]').waitFor();
  await A.keyboard.press('Escape');
  await A.waitForTimeout(200);
  const after = await A.evaluate(() => document.activeElement?.getAttribute('data-k'));
  if (!before || before !== after) throw new Error(`focus ${before} → ${after}`);
});
await A.screenshot({ path: SHOTS + '/20-A-semaine.png', fullPage: true });
console.log('\n--- erreurs ---\n' + (errors.join('\n') || 'aucune'));
await browser.close();
