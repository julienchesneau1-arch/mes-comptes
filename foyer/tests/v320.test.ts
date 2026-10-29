// V3.20 : photo d'une date imprimée. Préparation de l'image (core/scan.ts), fonctions pures testées sur des pixels synthétiques :
// seuil local, taches, impression à points reconnue et reliée, bord d'étiquette effacé, texte penché redressé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Gray, binarize, blobs, dotMatrix, close, clearLarge, skew, toGray, toRGBA } from '../src/core/scan.ts';

const W = 240, H = 120;
const blank = (): Gray => ({ w: W, h: H, px: new Uint8Array(W * H).fill(235) });
const disc = (g: Gray, cx: number, cy: number, r: number, v = 20): void => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
    if (x >= 0 && y >= 0 && x < g.w && y < g.h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) g.px[y * g.w + x] = v;
};
const rect = (g: Gray, x0: number, y0: number, x1: number, y1: number, v = 20): void => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.px[y * g.w + x] = v;
};
// Une rangée de « lettres » 5×7 en points : pas de 6 px, points de rayon 2.
const dotted = (): Gray => {
  const g = blank();
  for (let ch = 0; ch < 6; ch++) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (c === 0 || r === 0 || r === 6 || (ch % 2 && c === 4)) disc(g, 12 + ch * 36 + c * 6, 30 + r * 6, 2);
  return g;
};

test('seuil local : l\'encre ressort sur un fond clair comme sur un fond coloré plus sombre', () => {
  const g = blank();
  rect(g, 0, 60, W, H, 150);                                                 // moitié basse : aplat de couleur
  rect(g, 20, 20, 60, 30); rect(g, 20, 80, 60, 90, 60);                      // un trait sur chaque fond
  const bin = binarize(g);
  assert.equal(bin[25 * W + 40], 1);
  assert.equal(bin[85 * W + 40], 1);
  assert.equal(bin[45 * W + 120], 0);
  assert.equal(bin[100 * W + 200], 0);                                       // l'aplat seul n'est pas de l'encre
});

test('impression à points : reconnue (pas ≈ 6 px, diamètre ≈ 5 px), puis reliée en traits continus', () => {
  const g = dotted(), bin = binarize(g), { list } = blobs(bin, W, H), dots = dotMatrix(list);
  assert.ok(dots, `taches : ${list.length}`);
  assert.ok(Math.abs(dots.pitch - 6) <= 0.5, String(dots.pitch));
  assert.ok(dots.diameter > 3.5 && dots.diameter < 6, String(dots.diameter));
  const joined = blobs(close(bin, W, H, Math.ceil((dots.pitch - dots.diameter) / 2) + 1), W, H).list;
  assert.ok(joined.length <= 6, `après fermeture : ${joined.length} taches`);   // une tache par lettre
  // Un texte plein (traits continus) n'est pas pris pour des points.
  const plain = blank();
  for (let i = 0; i < 6; i++) { rect(plain, 12 + i * 36, 30, 16 + i * 36, 72); rect(plain, 12 + i * 36, 30, 40 + i * 36, 34); }
  assert.equal(dotMatrix(blobs(binarize(plain), W, H).list), null);
});

test('bord d\'étiquette et grand aplat effacés, lettres gardées', () => {
  const g = blank();
  rect(g, 2, 2, W - 2, 6); rect(g, 2, H - 6, W - 2, H - 2); rect(g, 2, 2, 6, H - 2); rect(g, W - 6, 2, W - 2, H - 2); // cadre
  rect(g, 40, 40, 46, 70); rect(g, 60, 40, 66, 70);                          // deux « lettres »
  const bin = binarize(g, 20), out = clearLarge(bin, W, H);
  assert.equal(out[4 * W + 120], 0);
  assert.equal(out[55 * W + 43], 1);
  assert.equal(out[55 * W + 63], 1);
});

test('texte penché : angle retrouvé à 1° près (−12°, 0°, 9°)', () => {
  for (const deg of [-12, 0, 9]) {
    const g = blank(), a = (deg * Math.PI) / 180;
    for (const y0 of [35, 60, 85]) for (let t = -90; t <= 90; t += 3) if ((t + 90) % 12 < 8) disc(g, W / 2 + t * Math.cos(a), y0 + t * Math.sin(a), 2.5);
    const found = skew(binarize(g), W);
    assert.ok(Math.abs(found - deg) <= 1, `${deg}° → ${found}°`);
  }
});

test('conversions : gris pondéré, encre noire sur blanc', () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
  assert.deepEqual([...toGray(rgba, 3, 1).px], [255, 0, 76]);
  assert.deepEqual([...toRGBA(new Uint8Array([1, 0]), 2, 1)], [0, 0, 0, 255, 255, 255, 255, 255]);
});
