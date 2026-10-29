// Photo d'une date imprimée : préparation de l'image avant la lecture du texte (OCR), en fonctions pures sur des pixels.
// Une date imprimée par jet d'encre est faite de points séparés, que l'OCR ne lit pas : on les repère (beaucoup de petites taches
// rondes de même taille, à pas régulier), on agrandit l'image pour un pas d'environ 9 pixels, puis on les relie (fermeture
// morphologique). Un texte penché est redressé (profil de projection). Les grands aplats (bord d'étiquette, ombre) sont effacés.
// Rien n'est deviné ici : on prépare l'image ; la date n'est retenue que si elle se lit ensuite (printed.ts), et l'utilisateur la vérifie.

export interface Gray { w: number; h: number; px: Uint8Array } // niveaux de gris, 0 = noir
export interface Blob { area: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }
export interface Dots { pitch: number; diameter: number; count: number }

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const px = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < px.length; i++, j += 4) px[i] = ((rgba[j] ?? 0) * 77 + (rgba[j + 1] ?? 0) * 150 + (rgba[j + 2] ?? 0) * 29) >> 8;
  return { w, h, px };
}
export function toRGBA(bin: Uint8Array, w: number, h: number): Uint8ClampedArray { // 1 = encre → noir
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < bin.length; i++, j += 4) { const v = bin[i] ? 0 : 255; out[j] = v; out[j + 1] = v; out[j + 2] = v; out[j + 3] = 255; }
  return out;
}

// Seuil local : un pixel est de l'encre s'il est plus sombre que la moyenne de son voisinage (fenêtre carrée de rayon r, image
// intégrale). Un fond coloré, un reflet ou une ombre ne noircissent pas toute l'image.
export function binarize(g: Gray, r: number = Math.max(8, Math.round(Math.min(g.w, g.h) / 8)), offset = 12): Uint8Array {
  const { w, h, px } = g, W = w + 1, I = new Float64Array(W * (h + 1)), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += px[y * w + x] ?? 0; I[(y + 1) * W + x + 1] = (I[y * W + x + 1] ?? 0) + row; } }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = (I[y1 * W + x1] ?? 0) - (I[y0 * W + x1] ?? 0) - (I[y1 * W + x0] ?? 0) + (I[y0 * W + x0] ?? 0);
      out[y * w + x] = (px[y * w + x] ?? 0) < sum / ((x1 - x0) * (y1 - y0)) - offset ? 1 : 0;
    }
  }
  return out;
}

// Taches d'encre connexes (4-voisinage) avec leur boîte et leur centre ; labels[i] = numéro de tache (0 = fond).
export function blobs(bin: Uint8Array, w: number, h: number): { list: Blob[]; labels: Int32Array } {
  const labels = new Int32Array(w * h), list: Blob[] = [], stack: number[] = [];
  for (let s = 0; s < bin.length; s++) {
    if (!bin[s] || labels[s]) continue;
    const id = list.length + 1, b: Blob = { area: 0, x0: w, y0: h, x1: 0, y1: 0, cx: 0, cy: 0 };
    labels[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop() ?? 0, x = i % w, y = (i - x) / w;
      b.area++; b.cx += x; b.cy += y;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      if (x > 0 && bin[i - 1] && !labels[i - 1]) { labels[i - 1] = id; stack.push(i - 1); }
      if (x < w - 1 && bin[i + 1] && !labels[i + 1]) { labels[i + 1] = id; stack.push(i + 1); }
      if (y > 0 && bin[i - w] && !labels[i - w]) { labels[i - w] = id; stack.push(i - w); }
      if (y < h - 1 && bin[i + w] && !labels[i + w]) { labels[i + w] = id; stack.push(i + w); }
    }
    b.cx /= b.area; b.cy /= b.area;
    list.push(b);
  }
  return { list, labels };
}

const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0; };

// Impression à points ? Au moins 40 petites taches rondes, de taille semblable, majoritaires ; pas = distance médiane au plus
// proche voisin (grille de recherche, O(n)).
export function dotMatrix(list: Blob[]): Dots | null {
  const round = list.filter(b => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    return b.area >= 4 && b.area <= 900 && bw / bh > 0.6 && bw / bh < 1.6 && b.area / (bw * bh) > 0.5;
  });
  if (round.length < 40) return null;
  const a = median(round.map(b => b.area)), same = round.filter(b => b.area > a * 0.5 && b.area < a * 2);
  if (same.length < 40 || same.length < list.length * 0.5) return null;
  const d = Math.sqrt((a * 4) / Math.PI), cell = Math.max(4, d * 3), grid = new Map<string, Blob[]>();
  const key = (x: number, y: number): string => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const b of same) { const k = key(b.cx, b.cy); const l = grid.get(k); if (l) l.push(b); else grid.set(k, [b]); }
  const nn: number[] = [];
  for (const b of same) {
    let best = Infinity;
    const gx = Math.floor(b.cx / cell), gy = Math.floor(b.cy / cell);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const o of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
      if (o === b) continue;
      const dd = Math.hypot(o.cx - b.cx, o.cy - b.cy);
      if (dd < best) best = dd;
    }
    if (best < Infinity) nn.push(best);
  }
  const pitch = median(nn);
  // Des points d'une même lettre : espacés d'un peu plus que leur diamètre, jamais collés ni très éloignés.
  return pitch > d * 1.05 && pitch < d * 3 ? { pitch, diameter: d, count: same.length } : null;
}

// Fermeture : dilatation puis érosion de l'encre (carré de rayon r, en deux passes séparables, O(n)).
export function close(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const pass = (src: Uint8Array, ink: 0 | 1): Uint8Array => {
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h), other = ink ? 0 : 1;
    for (let y = 0; y < h; y++) {
      let n = 0;
      const row = y * w;
      for (let x = -r; x < w; x++) {
        if (x + r < w && src[row + x + r] === ink) n++;
        if (x - r - 1 >= 0 && src[row + x - r - 1] === ink) n--;
        if (x >= 0) tmp[row + x] = n > 0 ? ink : other;
      }
    }
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = -r; y < h; y++) {
        if (y + r < h && tmp[(y + r) * w + x] === ink) n++;
        if (y - r - 1 >= 0 && tmp[(y - r - 1) * w + x] === ink) n--;
        if (y >= 0) out[y * w + x] = n > 0 ? ink : other;
      }
    }
    return out;
  };
  return pass(pass(bin, 1), 0);
}

// Efface les taches plus larges ou plus hautes que 40 % de l'image : bord d'étiquette, ombre, aplat de couleur.
export function clearLarge(bin: Uint8Array, w: number, h: number): Uint8Array {
  const { list, labels } = blobs(bin, w, h), out = new Uint8Array(bin);
  const big = new Set(list.flatMap((b, i) => (b.x1 - b.x0 > w * 0.4 || b.y1 - b.y0 > h * 0.4 ? [i + 1] : [])));
  if (big.size) for (let i = 0; i < out.length; i++) if (big.has(labels[i] ?? 0)) out[i] = 0;
  return out;
}

// Inclinaison du texte, en degrés (−20 à 20) : l'angle qui rend le plus « net » le profil des lignes (somme des carrés des
// histogrammes de projection). Calculé sur au plus 20 000 pixels d'encre.
export function skew(bin: Uint8Array, w: number): number {
  const pts: number[] = [];
  let ink = 0;
  for (let i = 0; i < bin.length; i++) if (bin[i]) ink++;
  const step = Math.max(1, Math.ceil(ink / 20000));
  for (let i = 0, k = 0; i < bin.length; i++) if (bin[i] && k++ % step === 0) pts.push(i % w, Math.floor(i / w));
  if (pts.length < 200) return 0;
  const score = (deg: number): number => {
    const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a), hist = new Map<number, number>();
    for (let i = 0; i < pts.length; i += 2) { const y = Math.round(-(pts[i] ?? 0) * s + (pts[i + 1] ?? 0) * c); hist.set(y, (hist.get(y) ?? 0) + 1); }
    let t = 0;
    for (const v of hist.values()) t += v * v;
    return t;
  };
  let best = 0, bestScore = score(0);
  for (let d = -20; d <= 20; d++) { if (!d) continue; const v = score(d); if (v > bestScore * 1.02) { bestScore = v; best = d; } }
  for (const d of [best - 0.5, best + 0.5]) { const v = score(d); if (v > bestScore) { bestScore = v; best = d; } }
  return best;
}
