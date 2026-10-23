// File « À régler » (spec « Décisions par défaut »), horloge fixée au lundi 5 octobre 2026, 12 h à Paris, en mode découverte :
// restes du chili d'hier proposés d'office ce midi, règle changée dans « Décisions automatiques » (la carte suit), un toucher place
// les restes, « plus tard » masque une carte ; une seule section, 5 cartes au plus. axe WCAG 2.2 AA. Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const MON = new Date('2026-10-05T10:00:00Z');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
await page.clock.setFixedTime(MON);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const step = async (label, fn) => { try { await fn(); console.log('✓', label); } catch (e) { console.log('✗', label, e.message.split('\n').slice(0, 3).join(' | ')); errors.push(`step ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${SHOTS}/fail-${label.slice(0, 24).replace(/\W/g, '_')}.png` }).catch(() => {}); } };
const axe = async name => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) errors.push(`axe[${name}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
};
const regler = page.locator('section[aria-labelledby=exc-h]');
const restes = regler.locator('li.exc', { hasText: 'portions de Chili con carne en attente' });
const text = async loc => (await loc.innerText()).replace(/\s+/g, ' ');

await page.goto(URL);
await step('mode découverte : une seule file « À régler », 5 cartes au plus', async () => {
  await page.getByRole('button', { name: 'Découvrir avec un exemple' }).click();
  await regler.getByRole('heading', { name: 'À régler' }).waitFor();
  const n = await regler.locator(':scope > ul > li.exc').count();
  if (n < 1 || n > 5) throw new Error(`${n} cartes visibles`);
  for (const old of ['À vérifier', 'À décider']) if (await page.getByRole('heading', { name: old, exact: true }).count()) throw new Error(`ancienne section encore là : ${old}`);
  const t = await text(restes);
  if (!/2 portions de Chili con carne en attente/.test(t) || !/Proposé d'office : ce midi/.test(t)) throw new Error('carte des restes : ' + t);
  await page.screenshot({ path: `${SHOTS}/regler-aujourdhui.png`, fullPage: true });
  await axe('a-regler');
});
await step('« Je m\'en occupe » : la carte des restes disparaît ; « proposés d\'office » : elle revient', async () => {
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Voir et changer' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('heading', { name: 'Décisions automatiques' }).waitFor();
  await axe('decisions');
  await dlg.getByRole('radio', { name: 'Je m\'en occupe' }).check();
  await dlg.getByText('Rien n\'est signalé').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await regler.waitFor();
  if (await restes.count()) throw new Error('carte des restes encore affichée en « manuel »');
  await page.getByRole('link', { name: 'Maison', exact: true }).click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Voir et changer' }).click();
  await page.locator('dialog[open]').getByRole('radio', { name: 'Proposés d\'office' }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Aujourd\'hui', exact: true }).click();
  await restes.waitFor();
});
await step('un toucher place les restes ce midi : la carte disparaît, le repas les affiche', async () => {
  await restes.getByRole('button', { name: 'Ce midi' }).click();
  await page.getByText(/Ce midi/).first().waitFor();
  await restes.waitFor({ state: 'detached' });
  const hero = await text(page.locator('article.meal.hero'));
  if (!/Chili con carne/.test(hero)) throw new Error('le repas de ce midi devrait être les restes du chili : ' + hero);
});
await step('« plus tard » : la carte est masquée jusqu\'à demain', async () => {
  const first = regler.locator('li.exc').first(), title = await text(first.locator('.exc-title'));
  await first.locator('summary', { hasText: 'Plus tard' }).click();
  await first.getByRole('button', { name: 'Plus tard (demain)' }).click();
  await page.getByText('Remis à demain').waitFor();
  const still = await regler.locator('li.exc .exc-title', { hasText: title.replace(/^\S+ /, '').slice(0, 30) }).count();
  if (still) throw new Error('carte encore visible après « plus tard » : ' + title);
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
