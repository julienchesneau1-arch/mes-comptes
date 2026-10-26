// Mesure de lisibilité (pas un test : aucun seuil) — foyer de démonstration, iPhone 390×844, horloge au lundi 5 octobre 2026.
// Par écran : mots affichés, mots du premier écran, éléments touchables visibles, textes d'explication (petits textes, sous-titres),
// et pour Courses la position du premier rayon (en hauteurs d'écran). Lancer : voir e2e/README.md.
import { chromium } from 'playwright-core';
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, r => r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]' }));
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-05T10:00:00Z'));
await page.goto(URL);
await page.getByRole('button', { name: 'Découvrir avec un exemple' }).click();
const measure = (label, sel) => page.evaluate(([label, sel]) => {
  const root = document.querySelector(sel), vh = innerHeight;
  const vis = el => (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }) : true) && el.getBoundingClientRect().height > 0;
  const words = t => (t.match(/[\p{L}\p{N}€%]+/gu) ?? []).length;
  const expl = [...root.querySelectorAll('.small.muted, p.small, .sub')].filter(vis);
  let first = 0;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (r.height && r.top < vh && r.bottom > 0) first += words(n.textContent);
  }
  const aisle = root.querySelector('section[aria-labelledby^="a-"]');
  return { label, mots: words(root.innerText), premier_ecran: first, touchables: [...root.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, textarea')].filter(vis).length,
    explications: expl.length, mots_explications: expl.reduce((n, e) => n + words(e.innerText), 0), liste: aisle ? +((aisle.getBoundingClientRect().top + scrollY) / vh).toFixed(2) : '' };
}, [label, sel]);
const rows = [];
const tab = async name => {
  await page.getByRole('link', { name, exact: true }).click();
  await page.getByRole('link', { name, exact: true }).and(page.locator('[aria-current="page"]')).waitFor(); // écran redessiné avant la mesure
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { scrollTo(0, 0); r(); })));
};
for (const t of ["Aujourd'hui", 'Semaine', 'Courses', 'Maison']) { await tab(t); rows.push(await measure(t, '#main')); }
await tab('Courses');
await page.getByRole('button', { name: /Commander au drive/ }).click();
rows.push(await measure('Commande au drive', 'dialog[open]')); await page.keyboard.press('Escape');
await page.getByRole('button', { name: '🔁 Produits du quotidien' }).click();
rows.push(await measure('Produits du quotidien', 'dialog[open]')); await page.keyboard.press('Escape');
await tab('Semaine');
await page.locator('[data-a="slot"]').first().click();
rows.push(await measure('Fiche d\'un repas', 'dialog[open]'));
console.log('| Écran | Mots | Premier écran | Touchables | Explications (mots) | Premier rayon (écrans) |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.label} | ${r.mots} | ${r.premier_ecran} | ${r.touchables} | ${r.explications} (${r.mots_explications}) | ${r.liste} |`);
await browser.close();
