// Portions en plus reprises et raccourcis d'usage, horloge fixée au lundi 5 octobre 2026 puis au mardi 6, 12 h à Paris.
// Spaghetti lundi soir « + 2 portions en plus », puis le même plat mardi midi : 4 portions (600 g), pas 6 (900 g).
// Fiche recette lue d'un toucher (pas le formulaire), ouverte 3 fois : le lendemain, raccourci en haut d'Aujourd'hui ;
// « Votre usage » (Réglages) liste et épingle. axe WCAG 2.2 AA. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T10:00:00Z'), TUE = new Date('2026-10-06T10:00:00Z');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
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
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const dlg = page.locator('dialog[open]');
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');
const openSlot = async (k, day) => {
  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  const slot = page.locator(`[data-a="slot"][data-k="${k}"]`);
  if (!(await slot.count())) await page.getByRole('button', { name: day }).first().click();
  await slot.first().click();
};
const openRecipe = async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.locator('main [data-a="recipe"]', { hasText: 'Spaghetti bolo' }).click();
  await dlg.getByRole('heading', { name: 'Spaghetti bolo' }).waitFor();
};

await page.goto(URL);
await step('foyer de deux, tout le monde à la maison ; spaghetti pour 2', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByLabel('Prénom de la personne 2 (facultatif)').fill('Lauriane');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Nos plats', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau plat', exact: true }).click();
  await dlg.getByLabel('Nom du plat').fill('Spaghetti bolo');
  await dlg.getByLabel(/pour combien de portions/).fill('2');
  await dlg.getByLabel(/^Ingrédients/).fill('300 g de spaghetti');
  await dlg.getByText('Étapes et choses à faire avant').click();
  await dlg.getByLabel(/^Étapes/).fill('Cuire les pâtes.\nAjouter la sauce.');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
});
await step('lundi soir + 2 portions en plus, puis le même plat mardi midi : 4 portions, pas 6', async () => {
  await openSlot('2026-10-05|soir', /lundi/i);
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  await dlg.getByRole('button', { name: /Spaghetti bolo/ }).first().click();
  await dlg.getByRole('button', { name: 'Une portion en plus', exact: true }).click();
  await dlg.getByRole('button', { name: 'Une portion en plus', exact: true }).click();
  await dlg.locator('output', { hasText: '2' }).waitFor();
  await page.keyboard.press('Escape');
  await openSlot('2026-10-06|midi', /^mar\. 6\b/);
  await dlg.getByRole('button', { name: 'Choisir un plat' }).click();
  const item = dlg.locator('li', { hasText: 'Spaghetti bolo' }).filter({ has: page.locator('[data-a="pickRecipe"]') });
  const sub = await text(item);
  if (!/♻️ reprend les 2 portions en plus de ce soir, rien de plus à cuisiner/.test(sub)) throw new Error('choix : ' + sub);
  await page.screenshot({ path: `${SHOTS}/usage-choix.png` });
  await axe('choix-reprise');
  await item.locator('[data-a="pickRecipe"]').click();
  await page.getByText(/Spaghetti bolo prévu demain midi : reprend les 2 portions en plus de ce soir/).first().waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  const line = await text(page.locator('main li', { has: page.locator('[data-key="spaghetti|masse"]') }));
  if (!/600 g/.test(line) || /900 g/.test(line)) throw new Error('courses : ' + line);
});
await step('fiche recette lue d\'un toucher (pas le formulaire), écran allumé', async () => {
  await openRecipe();
  const t = await text(dlg);
  if (!/Ingrédients pour 2/.test(t) || !/Cuire les pâtes/.test(t) || !/Cuisiner \(4\)/.test(t)) throw new Error('fiche : ' + t.slice(0, 300));
  if (await dlg.getByLabel('Nom du plat').count()) throw new Error('le formulaire s\'est ouvert au lieu de la fiche');
  await axe('fiche-recette');
  await page.keyboard.press('Escape');
  await openRecipe(); await page.keyboard.press('Escape');
  await openRecipe(); await page.keyboard.press('Escape');
});
await step('le lendemain : raccourci en haut d\'Aujourd\'hui, la fiche en un toucher', async () => {
  await page.clock.setFixedTime(TUE);
  await page.reload();
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Raccourcis' });
  await nav.getByRole('button', { name: '📖 Spaghetti bolo' }).click();
  await dlg.getByRole('heading', { name: 'Spaghetti bolo' }).waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${SHOTS}/usage-raccourci.png` });
  await axe('raccourcis');
});
await step('Réglages › Votre usage : ce qui revient le plus, épingler un outil', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByRole('button', { name: 'Voir et épingler' }).click();
  await dlg.getByRole('heading', { name: 'Votre usage' }).waitFor();
  if (!/📖 Spaghetti bolo/.test(await text(dlg))) throw new Error('usage : ' + (await text(dlg)).slice(0, 300));
  await axe('votre-usage');
  await dlg.locator('li', { hasText: 'Nouveau plat' }).getByRole('button', { name: 'Épingler' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await page.getByRole('navigation', { name: 'Raccourcis' }).getByRole('button', { name: '➕ Nouveau plat' }).waitFor();
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
