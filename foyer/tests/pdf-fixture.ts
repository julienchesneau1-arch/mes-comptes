// PDF de test fabriqué à la main (une page, Helvetica, encodage WinAnsi) : chaque ligne est une suite de morceaux [x, texte]
// posés à la même hauteur, comme les colonnes d'une facture. Contenu fictif : aucune donnée réelle.
const WIN: Record<string, number> = { '€': 0x80, '’': 0x92, 'œ': 0x9c, 'Œ': 0x8c };
function enc(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = WIN[ch] ?? ch.charCodeAt(0);
    if (c > 255) throw new Error(`caractère hors WinAnsi : ${ch}`);
    out += c === 0x28 || c === 0x29 || c === 0x5c ? `\\${String.fromCharCode(c)}` : c < 32 || c > 126 ? `\\${c.toString(8).padStart(3, '0')}` : String.fromCharCode(c);
  }
  return out;
}
export function makePdf(rows: readonly (readonly (readonly [number, string])[])[]): Uint8Array {
  const ops = rows.flatMap((parts, r) => parts.map(([x, t]) => `BT /F1 9 Tf 1 0 0 1 ${x} ${800 - r * 14} Tm (${enc(t)}) Tj ET`)).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, c => c.charCodeAt(0));
}

// Facture fictive au format générique (colonnes Désignation · Qté · Prix · Montant), avec de fausses données personnelles
// pour vérifier qu'elles ne sont jamais retenues.
export const SAMPLE_ROWS: readonly (readonly (readonly [number, string])[])[] = [
  [[40, 'FACTURE (exemple fictif)']],
  [[40, 'Facture n° 900000001 du 03/10/2026']],
  [[40, 'Client : Camille Exemple']],
  [[40, '1 rue de l’Exemple 00000 Villefictive']],
  [[40, 'Désignation'], [330, 'Qté'], [380, 'Prix unit.'], [470, 'Montant']],
  [[40, 'Oignons jaunes filet 1 kg'], [330, '2'], [380, '1,25 €'], [470, '2,50 €']],
  [[40, 'Tomates grappe 0,834 kg x 2,99 €/kg'], [470, '2,49 €']],
  [[40, 'Œufs frais plein air x12'], [330, '1'], [380, '3,45 €'], [470, '3,45 €']],
  [[40, 'Crème dessert vanille 4x125g'], [330, '1'], [380, '1,89 €'], [470, '1,89 €']],
  [[40, 'Pâtes spaghetti 500g'], [330, '3'], [380, '0,89 €'], [470, '2,67 €']],
  [[40, 'Frais de préparation'], [470, '0,00 €']],
  [[40, 'Total TTC'], [470, '13,00 €']],
];
