// V3.7, horloge fixée au lundi 5 octobre 2026, 20 h à Paris : mode essentiel (foyer neuf : ni batch, ni budget, ni facture,
// ni Bilan ; Réglages › Fonctions les affiche), « Ça coince ? » en haut de chaque écran (gêne notée avec l'écran, liste copiée
// depuis Réglages, rien envoyé), « On refait ? » après « On a mangé » (👍 = favori). axe WCAG 2.2 AA. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T18:00:00Z');
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
const reglages = async () => { await tab('Maison'); await page.getByRole('button', { name: 'Réglages', exact: true }).click(); };

await page.goto(URL);
await step('foyer neuf (sans budget) : l\'essentiel seulement ; Réglages › Fonctions', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await tab('Aujourd\'hui');
  if (await page.getByText('Batch cooking le dimanche ?').count()) throw new Error('promo batch visible en mode essentiel');
  await tab('Courses');
  if (await page.getByRole('button', { name: '🧾 Lire la facture du drive' }).count()) throw new Error('facture visible en mode essentiel');
  await tab('Maison');
  if (await page.getByRole('button', { name: 'Bilan', exact: true }).count()) throw new Error('Bilan visible en mode essentiel');
  await reglages();
  const fn = page.locator('section', { has: page.getByRole('heading', { name: 'Fonctions' }) });
  await fn.waitFor();
  await axe('fonctions');
  await fn.getByRole('checkbox', { name: /Factures du drive/ }).check();
  await page.getByText('Factures du drive : affiché').first().waitFor();
  await tab('Courses');
  await page.getByRole('button', { name: '🧾 Lire la facture du drive' }).waitFor();
});
await step('« Ça coince ? » en haut de chaque écran ; gêne notée avec l\'écran ; liste copiée depuis Réglages', async () => {
  for (const t of ['Aujourd\'hui', 'Semaine', 'Courses', 'Maison']) { await tab(t); await page.locator('.top').getByRole('button', { name: 'Ça coince ?' }).waitFor(); }
  await tab('Semaine');
  await page.locator('.top').getByRole('button', { name: 'Ça coince ?' }).click();
  await dlg.getByRole('heading', { name: 'Qu\'est-ce qui coince ?' }).waitFor();
  await axe('ca-coince');
  await dlg.getByLabel('Un mot (facultatif)').fill('je ne trouve pas les portions');
  await dlg.getByRole('button', { name: 'Trop long', exact: true }).click();
  await page.getByText(/Noté, merci/).first().waitFor();
  await reglages();
  await page.locator('section', { has: page.getByRole('heading', { name: 'Ça coince' }) }).getByText('1 gêne notée sur ce téléphone.').waitFor();
  await page.getByRole('button', { name: 'Voir et copier' }).click();
  const t = await text(dlg);
  if (!/Trop long · Semaine/.test(t) || !/je ne trouve pas les portions/.test(t)) throw new Error('liste : ' + t.slice(0, 300));
  await dlg.getByRole('button', { name: 'Copier la liste pour l\'envoyer' }).click();
  await page.getByText('Liste copiée : collez-la dans un message').first().waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (!/^Foyer 3\.15 · 1 gêne notée\n.* · Semaine · Trop long · « je ne trouve pas les portions » · après : /.test(copied)) throw new Error('copie : ' + copied);
  console.log('   copié :', copied.replace(/\n/g, ' ⏎ '));
  await page.keyboard.press('Escape');
});
await step('« On a mangé » puis « Spaghetti : on refait ? » ; 👍 = favori', async () => {
  await tab('Maison');
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Spaghetti bolo');
  await dlg.getByLabel(/pour combien de portions/).fill('2');
  await dlg.getByLabel(/^Ingrédients/).fill('300 g de spaghetti');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await tab('Semaine');
  const slot = page.locator('[data-a="slot"][data-k="2026-10-05|soir"]');
  if (!(await slot.count())) await page.getByRole('button', { name: /lundi/i }).first().click();
  await slot.first().click();
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Spaghetti bolo/ }).first().click();
  await page.keyboard.press('Escape');
  await tab('Aujourd\'hui');
  await page.getByRole('button', { name: 'On a mangé' }).first().click();
  const card = page.locator('li.exc', { hasText: 'Spaghetti bolo : on refait ?' });
  await card.waitFor();
  await page.screenshot({ path: `${SHOTS}/essentiel-avis.png`, fullPage: true });
  await axe('avis');
  await card.getByRole('button', { name: '👍 À refaire' }).click();
  await page.getByText('Spaghetti bolo : 👍 à refaire').first().waitFor();
  if (await page.locator('li.exc', { hasText: 'on refait ?' }).count()) throw new Error('la question revient après 👍');
  await tab('Maison');
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  if (!/favori/.test(await text(page.locator('main [data-a="recipe"]', { hasText: 'Spaghetti bolo' })))) throw new Error('favori absent de la fiche');
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
