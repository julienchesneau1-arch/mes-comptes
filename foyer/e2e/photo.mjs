// V3.20, horloge fixée au jeudi 5 novembre 2026, 12 h à Paris : « 📸 Prendre la date en photo » (lecture sur le téléphone).
// Photos simulées (étiquette dessinée puis passée au champ photo, comme l'appareil photo de l'iPhone) : date nette lue « DLC
// jeu. 12 nov. », date reportée dans le formulaire, enregistrée ; photo sans date : rien deviné, la marche à suivre est dite ;
// date à points (jet d'encre) : lue ou non, jamais reportée sans être sûre ; photo suivante : lecteur déjà prêt, aucun fichier
// rechargé (hors connexion, le service worker les garde comme pdf.js : non vérifiable ici, servi en http). Aucun appel réseau hors
// de l'app. axe WCAG 2.2 AA.
// Lancer : voir e2e/README.md
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const SHOTS = process.env.SHOTS ?? 'captures';
mkdirSync(SHOTS, { recursive: true });
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const THU = new Date('2026-11-05T11:00:00Z');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const outside = [];
await ctx.route(/^https?:\/\//, route => {
  const u = route.request().url();
  if (u.startsWith(URL)) return route.continue();
  outside.push(u);
  if (/supabase\.co\//.test(u)) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    const m = route.request().method();
    return route.fulfill(m === 'OPTIONS' ? { status: 204, headers: cors } : m === 'POST' ? { status: 201, headers: cors } : { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '[]' });
  }
  return route.abort();
});
await ctx.routeWebSocket(/^wss:\/\/[a-z0-9]+\.supabase\.co\//, ws => ws.onMessage(m => { const d = JSON.parse(String(m)); if (d.event === 'phx_join' || d.event === 'heartbeat') ws.send(JSON.stringify({ topic: d.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: d.ref })); }));
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(THU);
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
const read = dlg.locator('#w-read');
// Étiquette photographiée : texte dessiné sur un emballage (fond beige), légèrement penchée ; « points » : impression jet d'encre 5×7.
const photo = (lines, opts = {}) => page.evaluate(([lines, opts]) => {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = 1200; c.height = 520;
  g.fillStyle = '#d8cfbf'; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.translate(600, 260); g.rotate(((opts.rot ?? 0) * Math.PI) / 180);
  g.fillStyle = '#fbfaf6'; g.fillRect(-520, -170, 1040, 340); g.fillStyle = '#1b1b1b';
  if (opts.dots) {
    const F = { '0': '01110100011000110001100011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111', '6': '00110010001000011110100011000101110',
      '/': '00000000010001000100010001000000000', A: '01110100011000110001111111000110001', D: '11100100101000110001100011001011100', L: '10000100001000010000100001000011111',
      C: '01110100011000010000100001000101110', U: '10001100011000110001100011000101110', J: '00111000100001000010000101001001100', Q: '01110100011000110001101011001001101',
      S: '01111100001000001110000010000111110', "'": '01100001000100000000000000000000000' };
    const sp = 9;
    lines.forEach((l, li) => [...l].forEach((ch, ci) => { const b = F[ch]; if (!b) return;
      for (let i = 0; i < 35; i++) if (b[i] === '1') { g.beginPath(); g.arc(-480 + (ci * 6 + (i % 5)) * sp, -110 + (li * 10 + Math.floor(i / 5)) * sp, sp * 0.36, 0, 7); g.fill(); } }));
  } else {
    g.font = '600 46px Arial, sans-serif'; g.textBaseline = 'top';
    lines.forEach((l, i) => g.fillText(l, -480, -120 + i * 70));
  }
  g.restore();
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
}, [lines, opts]).then(b64 => ({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }));
const openScan = async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: '📷 Scanner une date limite' }).click();
};
const ocrFiles = [];
page.on('request', r => { if (r.url().includes('/vendor/tesseract/')) ocrFiles.push(r.url().split('/').pop()); });
const shoot = async file => dlg.locator('input[type="file"][data-c="wPhoto"]').setInputFiles(file);

await page.goto(URL);
await step('foyer neuf ; Courses › « 📷 Scanner une date limite » : bouton photo en tête de la zone de scan', async () => {
  await page.getByRole('button', { name: 'Créer notre foyer' }).click();
  await page.getByLabel('Prénom de la personne 1').fill('Julien');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByText('Tout le monde à la maison, midi et soir').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: /Créer le foyer/ }).click();
  await openScan();
  await dlg.getByText('📸 Prendre la date en photo').waitFor();
  if (ocrFiles.length) throw new Error('lecteur chargé avant la première photo : ' + ocrFiles.join(', '));
  const input = dlg.locator('input[type="file"][data-c="wPhoto"]');
  if ((await input.getAttribute('capture')) !== 'environment' || !/image/.test(await input.getAttribute('accept') ?? '')) throw new Error('champ photo : appareil arrière attendu');
  await axe('photo-vide');
});
await step('photo nette (penchée de 6°) : « 📸 Lu sur la photo : DLC jeu. 12 nov. 2026 », date reportée, enregistrée', async () => {
  await shoot(await photo(['Lot 2311 A consommer', 'jusqu\'au : 12/11/2026'], { rot: 6 }));
  await read.getByText(/Lecture de la photo/).waitFor({ timeout: 3000 }).catch(() => {}); // peut être trop bref pour être vu
  await read.getByText(/📸 Lu sur la photo : DLC .*12.*nov/).waitFor({ timeout: 30000 });
  if (!/vérifiez avec l'emballage/.test(await read.innerText())) throw new Error(await read.innerText());
  await dlg.getByText('Texte lu sur la photo').click();
  await dlg.getByText(/12\/11\/2026/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/photo-lue.png` });
  await axe('photo-lue');
  await dlg.getByLabel('Produit').fill('Poulet');
  await dlg.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByText(/Poulet surveillé \(DLC .*12.*nov/).first().waitFor();
});
await step('photo sans date (après une photo lue) : rien deviné, la date précédente effacée, la marche à suivre est dite', async () => {
  console.log('   chargé à la première photo :', [...new Set(ocrFiles)].join(', '));
  ocrFiles.length = 0;
  await openScan();
  await shoot(await photo(['A consommer jusqu\'au', '15/11/2026']));
  await read.getByText(/📸 Lu sur la photo : DLC .*15.*nov/).waitFor({ timeout: 30000 });
  await shoot(await photo(['Crème fraîche épaisse', '30 % MG · 20 cl']));     // nouvelle photo, sans date
  await read.getByText(/Date non lue sur la photo\. Reprenez-la de plus près/).waitFor({ timeout: 30000 });
  const left = dlg.locator('input[name="date"]');
  if ((await left.count()) && (await left.inputValue())) throw new Error('date de la photo précédente restée : ' + await left.inputValue());
  if (await dlg.getByRole('button', { name: /^Utiliser / }).count()) throw new Error('date proposée sans date lisible');
  await page.screenshot({ path: `${SHOTS}/photo-non-lue.png` });
});
await step('date à points (jet d\'encre) : lue sûre, proposée (« Utiliser … ») ou non lue ; jamais reportée sans être sûre', async () => {
  await shoot(await photo(['DLC 12/11/26'], { dots: true }));
  await read.getByText(/📸 (Lu sur la photo|Lecture incertaine|Date non lue)/).waitFor({ timeout: 30000 });
  const t = await read.innerText(), date = await dlg.locator('input[name="date"]').inputValue().catch(() => '');
  if (/incertaine/.test(t)) {
    if (date) throw new Error(`date reportée d'office malgré une lecture incertaine : ${date}`);
    await dlg.getByRole('button', { name: /^Utiliser / }).click();
    await read.getByText(/📸 Lu sur la photo/).waitFor();
  }
  console.log('   points →', t.split(' · ')[0]);
  await page.screenshot({ path: `${SHOTS}/photo-points.png` });
  await page.keyboard.press('Escape');
});
await step('photos suivantes : lecteur déjà prêt, aucun fichier rechargé', async () => {
  if (ocrFiles.length) throw new Error('rechargé : ' + ocrFiles.join(', '));
});
await step('aucun appel réseau hors de l\'app (lecture sur le téléphone)', async () => {
  const bad = outside.filter(u => !/supabase\.co\//.test(u));
  if (bad.length) throw new Error(bad.join(', '));
});

await browser.close();
console.log(`erreurs : ${errors.length ? `\n${errors.join('\n')}` : 'aucune'}`);
process.exit(errors.length ? 1 : 0);
