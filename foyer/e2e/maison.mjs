// V3.9-3.11, horloge fixée au lundi 5 octobre 2026, 12 h à Paris : produits du quotidien. Foyer neuf → proposition dans les courses,
// choix des produits (cochés par défaut : les courants), rien à racheter cette semaine (départ supposé à moitié entamé) ;
// « Il en faut maintenant » → ligne dans Maison & hygiène ; coche = achat noté, décoche = retiré ; semaine suivante : ce qui
// manquera ; « Il en reste encore », rythme choisi, produit ajouté par le foyer ; facture collée → achats notés ;
// desserts, fruits, boissons, goûter ; produit dû dans le budget et la commande guidée au drive.
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
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new globalThis.URL(URL).origin });
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
  await page.waitForFunction(() => !document.getAnimations().some(a => a instanceof CSSTransition && a.playState === 'running'));
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const dlg = page.locator('dialog[open]');
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');
const tab = name => page.getByRole('link', { name, exact: true }).click();
const maison = page.locator('section', { has: page.getByRole('heading', { name: /Maison & hygiène/ }) });
const tick = (scope, name) => scope.locator('label.check', { has: page.getByRole('checkbox', { name }) }).click(); // comme un doigt : la case dessinée, dans l'étiquette

await page.goto(URL);
await step('foyer neuf : proposition dans les courses ; produits courants cochés ; rien à racheter tout de suite', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await tab('Courses');
  await page.getByText('Café, sucre, dentifrice, papier toilette…').waitFor();
  await page.getByRole('button', { name: 'Choisir', exact: true }).click();
  await dlg.getByRole('heading', { name: /Produits du quotidien/ }).waitFor();
  if (!(await dlg.getByRole('checkbox', { name: /Dentifrice/ }).isChecked())) throw new Error('dentifrice non coché par défaut');
  if (await dlg.getByRole('checkbox', { name: /^Café/ }).isChecked()) throw new Error('café coché d\'office : au foyer de choisir');
  if (await dlg.getByRole('checkbox', { name: /Tablettes lave-vaisselle/ }).isChecked()) throw new Error('lave-vaisselle coché sans savoir s\'il y en a un');
  const t = await text(dlg);
  if (!/≈ tous les 25 jours pour 2 personnes · tube de 75 ml/.test(t)) throw new Error('estimation non expliquée : ' + t.slice(0, 300));
  await page.screenshot({ path: `${SHOTS}/maison-choix.png`, fullPage: true });
  await axe('maison-choix');
  await dlg.getByRole('button', { name: 'Commencer le suivi' }).click();
  await page.getByText(/produits suivis : ils reviendront dans les courses au bon moment/).first().waitFor();
  await page.keyboard.press('Escape');
  if (await maison.count()) throw new Error('rayon Maison & hygiène affiché alors que rien ne manque cette semaine');
  if (await page.getByText('Café, sucre, dentifrice, papier toilette…').count()) throw new Error('proposition encore affichée');
});
await step('« Il en faut maintenant » : dans Maison & hygiène ; coche = achat noté, décoche = retiré', async () => {
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByRole('button', { name: /^Dentifrice/ }).click();
  await dlg.getByText(/Prochain achat : vers le dim\. 18 oct\. \(dans 13 jours\)/).waitFor();
  await axe('maison-fiche');
  await dlg.getByRole('button', { name: 'Il en faut maintenant' }).click();
  await page.getByText('Dentifrice : dans les courses de cette semaine').first().waitFor();
  await page.keyboard.press('Escape');
  await maison.getByText('Dentifrice').waitFor();
  const row = await text(maison);
  if (!/devrait manquer vers le lun\. 5 oct\./.test(row) || !/1 tube/.test(row)) throw new Error('ligne : ' + row);
  await page.screenshot({ path: `${SHOTS}/maison-courses.png`, fullPage: true });
  await axe('maison-courses');
  await tick(maison, 'Dentifrice : pris'); // la ligne part aussitôt dans « Déjà traités »
  await page.getByText(/Dentifrice : acheté\. Prochain rappel ven\. 30 oct\./).first().waitFor();
  if (await maison.count()) throw new Error('le rayon reste affiché après l\'achat');
  await page.getByText(/Déjà traités \(1\)/).click();
  await tick(page, 'Dentifrice : pris');
  await page.getByText('Dentifrice : achat retiré').first().waitFor();
  await maison.getByText('Dentifrice').waitFor();
  await tick(maison, 'Dentifrice : pris');
  await page.getByText(/Dentifrice : acheté/).first().waitFor();
});
await step('semaine suivante : ce qui manquera alors ; « Il en reste encore » reporte ; rythme choisi', async () => {
  await page.getByRole('button', { name: 'Semaine suivante' }).click();
  await maison.getByText('Gel douche').waitFor();
  const t = await text(maison);
  for (const n of ['Essuie-tout (Sopalin)', 'Papier toilette', 'Mouchoirs']) if (!t.includes(n)) throw new Error(`${n} absent la semaine du 12 : ${t}`);
  if (t.includes('Dentifrice')) throw new Error('dentifrice acheté redemandé');
  await maison.getByRole('button', { name: /^Gel douche/ }).click();
  await dlg.getByRole('button', { name: 'Il en reste encore' }).click();
  await page.getByText(/Gel douche : reporté au lun\. 19 oct\./).first().waitFor();
  await dlg.getByLabel('Rythme').selectOption('30');
  await page.getByText('Gel douche : tous les 30 jours').first().waitFor();
  await page.keyboard.press('Escape');
});
await step('produit ajouté par le foyer ; facture collée : achats des produits suivis notés', async () => {
  await page.getByRole('button', { name: 'Semaine précédente' }).click();
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByLabel('Nom').fill('croquettes du chat');
  await dlg.getByLabel('Environ tous les').selectOption('21');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByText('Croquettes du chat : suivi, tous les 21 jours').first().waitFor();
  await dlg.getByRole('heading', { name: 'Ajoutés par vous' }).waitFor();
  await page.keyboard.press('Escape');
  await tab('Maison');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.locator('section', { has: page.getByRole('heading', { name: 'Fonctions' }) }).getByRole('checkbox', { name: /Factures du drive/ }).check();
  await tab('Courses');
  await page.getByRole('button', { name: '🧾 Lire la facture du drive' }).click();
  await dlg.getByText('Ou coller le texte de la facture').click();
  await dlg.getByLabel('Texte copié depuis la facture').fill(['Facture du 03/10/2026', 'Papier WC doux x12 4,99', 'Lessive liquide 30 lavages 7,99', 'Total à payer 12,98'].join('\n'));
  await dlg.getByRole('button', { name: 'Lire ce texte' }).click();
  const house = dlg.getByRole('group', { name: 'Produits du quotidien achetés' });
  await house.waitFor();
  const h = await text(house);
  if (!/Papier toilette/.test(h) || !/Lessive/.test(h) || !/Achat noté au sam\. 3 oct\./.test(h)) throw new Error('facture : ' + h);
  await axe('maison-facture');
  await dlg.getByRole('button', { name: 'Retenir ces prix' }).click();
  await page.getByText(/2 produits du quotidien/).first().waitFor();
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByRole('button', { name: /^Lessive/ }).click();
  await dlg.getByText('sam. 3 oct. 2026').waitFor();
  await dlg.getByText(/Prochain achat : vers le mer\. 25 nov\./).waitFor();
});

await step('petit-déjeuner : sucre et lait suivis, crêpes ce soir → une seule ligne par produit ; la coche note les deux achats', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByRole('heading', { name: 'Petit-déjeuner' }).waitFor();
  await dlg.getByRole('checkbox', { name: 'Suivre Sucre' }).check();
  await dlg.getByRole('checkbox', { name: 'Suivre Lait' }).check();
  await dlg.getByRole('button', { name: /^Sucre/ }).click();
  await dlg.getByRole('button', { name: 'Il en faut maintenant' }).click();
  await page.getByText('Sucre : dans les courses de cette semaine').first().waitFor();
  await page.keyboard.press('Escape');
  await tab('Maison');
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Crêpes');
  await dlg.getByLabel(/pour combien de portions/).fill('4');
  await dlg.getByLabel(/^Ingrédients/).fill('250 g de farine\n50 g de sucre\n50 cl de lait\n3 œufs');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await tab('Semaine');
  const slot = page.locator('[data-a="slot"][data-k="2026-10-05|soir"]');
  if (!(await slot.count())) await page.getByRole('button', { name: /lundi/i }).first().click();
  await slot.first().click();
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Crêpes/ }).first().click();
  await page.keyboard.press('Escape');
  await tab('Courses');
  const sweet = page.locator('section', { has: page.getByRole('heading', { name: /Épicerie sucrée/ }) });
  const dairy = page.locator('section', { has: page.getByRole('heading', { name: /Crèmerie/ }) });
  await sweet.getByText('Sucre', { exact: true }).waitFor();
  if (await page.locator('main .title', { hasText: /^Sucre$/ }).count() !== 1) throw new Error('deux lignes de sucre');
  if (await page.locator('main .title', { hasText: /^Lait$/ }).count() !== 1) throw new Error('deux lignes de lait');
  const st = await text(sweet), dt = await text(dairy);
  if (!/Sucre Crêpes : 25 g · réserve du quotidien comprise 1 kg/.test(st)) throw new Error('sucre : ' + st);   // le paquet à droite
  if (!/Lait Crêpes : 250 ml · réserve du quotidien comprise 6 briques d'1 L/.test(dt)) throw new Error('lait : ' + dt);
  await page.screenshot({ path: `${SHOTS}/quotidien-une-ligne.png`, fullPage: true });
  await axe('quotidien-courses');
  await tick(sweet, 'Sucre : pris');
  await page.getByText(/Déjà traités/).first().waitFor();
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByRole('button', { name: /^Sucre/ }).click();
  await dlg.getByText('lun. 5 oct. 2026').waitFor();                                      // achat de la réserve noté avec la coche
});

await step('desserts, fruits, boissons, goûter au choix ; pommes dues → budget les compte, drive : article à part, « Ajouté au panier » note l\'achat', async () => {
  await page.keyboard.press('Escape');
  await tab('Maison');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.locator('section', { has: page.getByRole('heading', { name: 'Fonctions' }) }).getByRole('checkbox', { name: /Budget et bilan/ }).check();
  await tab('Courses');
  const budget = page.locator('section', { has: page.getByRole('heading', { name: /Budget de la semaine/ }) });
  const cents = async () => {
    const t = await text(budget), m = t.match(/(\d+(?: \d{3})*,\d{2}) € panier estimé/);
    if (!m) throw new Error('panier estimé illisible : ' + t.slice(0, 200));
    return Math.round(Number(m[1].replace(/ /g, '').replace(',', '.')) * 100);
  };
  const before = await cents();
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  for (const h of ['Desserts', 'Fruits à croquer', 'Boissons', 'Goûter et en-cas']) await dlg.getByRole('heading', { name: h }).waitFor();
  if (await dlg.getByRole('checkbox', { name: 'Suivre Compotes' }).isChecked()) throw new Error('compotes cochées d\'office : au foyer de choisir');
  await dlg.getByRole('checkbox', { name: 'Suivre Pommes' }).check();
  await dlg.getByRole('button', { name: /^Pommes/ }).click();
  const price = (await text(dlg)).match(/Prix : ≈ (\d+,\d{2}) € · prix moyen Insee pommes/);
  if (!price) throw new Error('prix des pommes : ' + (await text(dlg)).slice(0, 400));
  await dlg.getByRole('button', { name: 'Il en faut maintenant' }).click();
  await page.getByText('Pommes : dans les courses de cette semaine').first().waitFor();
  await page.keyboard.press('Escape');
  const fruits = page.locator('section', { has: page.getByRole('heading', { name: /Fruits & légumes/ }) });
  await fruits.getByText('Pommes').waitFor();
  const after = await cents(), pomme = Math.round(Number(price[1].replace(',', '.')) * 100);
  if (after !== before + pomme) throw new Error(`budget : ${before} + ${pomme} attendus, ${after} affichés`);
  await page.getByRole('button', { name: '🛒 Commander au drive' }).click();
  for (let i = 0; i < 20 && !(await dlg.getByRole('heading', { name: 'Pommes', exact: true }).count()); i++) await dlg.getByRole('button', { name: 'Passer' }).click();
  const card = await text(dlg);
  if (!/Besoin : 1 kg \(≈ 6\)/.test(card) || !/prix moyen Insee pommes/.test(card)) throw new Error('article pommes : ' + card.slice(0, 400));
  await page.screenshot({ path: `${SHOTS}/quotidien-drive.png`, fullPage: true });
  await axe('quotidien-drive');
  await dlg.getByRole('button', { name: 'Ajouté au panier' }).click();
  await page.getByText('Pommes : au panier').first().waitFor();
  await page.keyboard.press('Escape');
  if (await fruits.getByText('Pommes').count()) throw new Error('pommes encore à acheter après le drive');
  await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
  await dlg.getByRole('button', { name: /^Pommes/ }).click();
  await dlg.getByText('lun. 5 oct. 2026').waitFor();                                      // achat noté depuis la commande guidée
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
