// V3.20 — mesure de la lecture photo (ui/ocr.ts) : 190 étiquettes simulées (10 dates × 19 styles d'impression et de prise de vue),
// lues dans Chromium par le même code que l'app ; date retenue = core/printed.ts. Compte les dates justes, les fausses, et la confiance
// de Tesseract des unes et des autres (seuil SURE). Les styles sont dessinés (polices, matrice de points 5×7, flou, bruit, angle,
// reflet) : ce ne sont pas de vraies photos d'emballages.
// Lancer : serveur local (voir e2e/README.md), puis node e2e/lecture-photo.mjs
import { chromium } from 'playwright-core';
const URL = process.env.FOYER_URL ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto(URL);
const out = await page.evaluate(async () => {
  const { readPhoto, SURE } = await import('./js/ui/ocr.js');
  const TODAY = '2026-10-29';
  const S = [
    ['A consommer jusqu\'au : 12/11/2026', 'DLC', '2026-11-12'],
    ['À consommer de préférence avant le : 03/2027', 'DDM', '2027-03'],
    ['DLC 05.11.26   L2304B', 'DLC', '2026-11-05'],
    ['A CONSOMMER JUSQU\'AU 28/10/26', 'DLC', '2026-10-28'],
    ['DDM : 15-02-2027', 'DDM', '2027-02-15'],
    ['Lot 23451  À consommer jusqu\'au 07 NOV 2026', 'DLC', '2026-11-07'],
    ['A consommer de preference avant fin : 08/2027', 'DDM', '2027-08'],
    ['Emballé le 25/10/26  A consommer jusqu\'au 04/11/26', 'DLC', '2026-11-04'],
    ['30/11/2026 14:32 L245', 'inconnu', '2026-11-30'],
    ['À consommer jusqu\'au\n09.11.2026', 'DLC', '2026-11-09'],
  ];

  const fonts = { sans: '600 {s}px Arial, sans-serif', mono: '600 {s}px "Courier New", monospace', serif: '600 {s}px Georgia, serif' };
  const F57 = { '0': '01110100011000110001100011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
    '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
    '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
    '9': '01110100011000101111000010001001100', '/': '00000000010001000100010001000000000', '.': '00000000000000000000000000110001100',
    ':': '00000011000110000000011000110000000', '-': '00000000000000011111000000000000000', "'": '01100001000100000000000000000000000',
    A: '01110100011000110001111111000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11100100101000110001100011001011100', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
    Y: '10001100011000101010001000010000100', Z: '11111000010001000100010001000011111' };
  const matrix = (text, sp, ink) => {               // texte en matrice de points 5×7, pas de sp pixels, points de rayon 0,36·sp
    const lines = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split('\n');
    const c = document.createElement('canvas'); c.width = Math.ceil((Math.max(...lines.map(l => l.length)) * 6 + 4) * sp); c.height = Math.ceil((lines.length * 10 + 2) * sp);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = ink;
    lines.forEach((l, li) => [...l].forEach((ch, ci) => { const b = F57[ch]; if (!b) return;
      for (let i = 0; i < 35; i++) if (b[i] === '1') { g.beginPath(); g.arc((2 + ci * 6 + (i % 5) + 0.5) * sp, (1 + li * 10 + Math.floor(i / 5) + 0.5) * sp, sp * 0.36, 0, 7); g.fill(); } }));
    return c;
  };
  // Rendu d'une étiquette : police ou matrice de points (jet d'encre), puis « photo » (taille, angle, flou, bruit, contraste).
  const render = (text, st) => {
    const lines = text.split('\n'), size = st.size ?? 34;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const font = st.dots ? `700 ${st.dots}px "Courier New", monospace` : fonts[st.font ?? 'sans'].replace('{s}', size);
    g.font = font;
    const tw = Math.max(...lines.map(l => g.measureText(l).width)), lh = (st.dots ? st.dots : size) * 1.4;
    let src = document.createElement('canvas');
    src.width = Math.ceil(tw + 40); src.height = Math.ceil(lh * lines.length + 30);
    let s = src.getContext('2d');
    s.fillStyle = st.bg ?? '#fff'; s.fillRect(0, 0, src.width, src.height);
    s.fillStyle = st.fg ?? '#111'; s.font = font; s.textBaseline = 'top';
    lines.forEach((l, i) => s.fillText(l, 20, 15 + i * lh));
    if (st.m57) { src = matrix(text, st.m57, st.fg ?? '#111'); s = src.getContext('2d'); }
    else if (st.dots) {                                                             // chaque pixel sombre → un point d'encre
      const k = st.scale ?? 4, small = s.getImageData(0, 0, src.width, src.height), big = document.createElement('canvas');
      big.width = src.width * k; big.height = src.height * k;
      const b = big.getContext('2d'); b.fillStyle = st.bg ?? '#fff'; b.fillRect(0, 0, big.width, big.height); b.fillStyle = st.fg ?? '#111';
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        const p = (y * src.width + x) * 4;
        if (small.data[p] < 128) { b.beginPath(); b.arc(x * k + k / 2, y * k + k / 2, k * 0.42, 0, 7); b.fill(); }
      }
      src = big; s = b;
    }
    // Photo : l'étiquette au milieu d'un fond plus grand, tournée, floutée, bruitée.
    const W = Math.round(src.width * (st.frame ?? 1.4)), H = Math.round(src.height * (st.frame ?? 1.4) + 40);
    c.width = W; c.height = H;
    g.fillStyle = st.paper ?? '#c9c2b5'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(((st.rot ?? 0) * Math.PI) / 180);
    if (st.blur) g.filter = `blur(${st.blur}px)`;
    g.drawImage(src, -src.width / 2, -src.height / 2); g.restore(); g.filter = 'none';
    if (st.noise) { const im = g.getImageData(0, 0, W, H); let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < im.data.length; i += 4) { const n = (rnd() - 0.5) * st.noise; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; } g.putImageData(im, 0, 0); }
    if (st.light) { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${st.light})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    return c;
  };
  const styles = {
    nette: { font: 'sans' },
    mono: { font: 'mono' },
    serif: { font: 'serif', size: 28 },
    'jet d\'encre': { dots: 9, scale: 4 },
    'jet d\'encre fin': { dots: 8, scale: 3, blur: 0.6 },
    'gris clair': { fg: '#777', bg: '#e8e4dc' },
    'sur couleur': { fg: '#1a1a1a', bg: '#d9a441' },
    'flou': { blur: 1.8 },
    'bruit': { noise: 70 },
    'penché 8°': { rot: 8 },
    'penché 15°': { rot: 15 },
    'petit': { size: 16 },
    'reflet': { light: 0.75 },
    'points 5x7': { m57: 6 },
    'points 5x7 gros': { m57: 11 },
    'points 5x7 flou': { m57: 8, blur: 1.5 },
    'points 5x7 penché': { m57: 8, rot: 7 },
    'points 5x7 gris': { m57: 7, fg: '#555', noise: 40 },
    'tout ensemble': { dots: 9, scale: 4, rot: 6, blur: 1, noise: 50, fg: '#333', bg: '#eee' },
  };

  const rows = [], ok80 = [0, 0], bad80 = [0, 0];
  for (const [name, style] of Object.entries(styles)) {
    let ok = 0, wrong = 0, ms = 0;
    for (const [text, , value] of S) {
      const r = await readPhoto(render(text, style), TODAY);
      ms += r.ms;
      if (!r.printed) continue;
      const good = r.printed.value === value;
      if (good) ok++; else wrong++;
      (good ? ok80 : bad80)[r.confidence >= SURE ? 0 : 1]++;
    }
    rows.push({ name, ok, wrong, n: S.length, ms: Math.round(ms / S.length) });
  }
  return { rows, ok80, bad80, SURE };
});
console.log('| Style | Dates justes | Fausses | ms par photo |\n|---|---|---|---|');
for (const r of out.rows) console.log(`| ${r.name} | ${r.ok}/${r.n} | ${r.wrong} | ${r.ms} |`);
const n = out.rows.reduce((t, r) => t + r.n, 0), ok = out.rows.reduce((t, r) => t + r.ok, 0), wrong = out.rows.reduce((t, r) => t + r.wrong, 0);
console.log(`\nTotal : ${ok}/${n} justes, ${wrong} fausses, ${n - ok - wrong} non lues.`);
console.log(`Confiance ≥ ${out.SURE} (reportée) : ${out.ok80[0]} justes, ${out.bad80[0]} fausses ; en dessous (proposée) : ${out.ok80[1]} justes, ${out.bad80[1]} fausses.`);
await browser.close();
