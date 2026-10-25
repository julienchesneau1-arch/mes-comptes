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

// Facture au format réel d'Auchan drive (mise en page relevée sur trois vraies factures d'octobre 2026, lues masquées) :
// colonnes « Prix U. HT · Remise U. HT · Qté · Total net HT · TVA · Cagnotte · Total net TTC », nom du produit continué sur
// la ligne suivante, en-tête répété à chaque page, « Facture éditée le » (jour du téléchargement) avant la date de commande,
// paiement en cagnotte, carte cadeau et carte bancaire. Prix, dates, codes et données personnelles : tous inventés.
const P = (ean: string, label: string, ...nums: string[]): [number, string][] => [[20, ean], [80, label], ...nums.map((n, i) => [300 + i * 38, n] as [number, string])];
const HEAD: (readonly (readonly [number, string])[])[] = [
  [[245, 'Votre commande :'], [356, 'Votre facture :'], [460, 'Id Waaoh :']],
  [[245, '900000001'], [356, 'F00000000000001'], [460, '0000']],
  [[40, 'Votre code-barres : s000000000000000000000']],
  [[300, 'Prix U.'], [340, 'Remises U.'], [400, 'Prix total Net'], [445, 'Taux TVA'], [490, 'Cagnotte'], [530, 'Prix total Net']],
  [[20, 'Référence'], [80, 'Caractéristiques produit'], [375, 'Qte.']],
  [[300, '(HT) €'], [340, '(HT) €'], [400, '(HT) €'], [445, '%'], [490, 'WAAOH!'], [530, '(TTC) €']],
];
export const AUCHAN_ROWS: readonly (readonly (readonly [number, string])[])[] = [
  ...HEAD.slice(0, 3),
  [[40, 'Mme Camille EXEMPLE'], [482, 'Facture éditée le :']],
  [[40, '1 rue de l’Exemple'], [482, '12/10/2026']],
  [[40, '00000 VILLEFICTIVE'], [482, 'Date de commande :']],
  [[40, 'N° client : 0000000'], [482, '08/10/2026']],
  ...HEAD.slice(3),
  P('3000000000011', 'AUCHAN Beurre doux', '2,45', '1', '2,45', '5,50', '0,25', '2,58'),
  [[80, '250g']],
  P('3000000000028', 'AUCHAN Crème dessert au chocolat au', '1,31', '2', '2,62', '5,50', '2,76'),
  [[80, 'lait 4x125g']],
  P('3000000000035', 'MARQUE Thé glacé saveur pêche', '5,20', '1,30', '4', '15,60', '5,50', '16,46'),
  [[80, '4x1.25L']],
  P('3000000000042', 'AUCHAN TAVOLA Parmigiano', '1,18', '2', '2,35', '5,50', '0,24', '2,48'),
  [[80, 'Reggiano AOP râpé 60g']],
  P('3000000000059', 'PRIX BAS FILET PLT BLANC 600G', '6,10', '2', '12,19', '5,50', '12,86'),
  P('3000000000066', 'AUCHAN Confiture extra de figue 50% de', '1,59', '1', '1,59', '5,50', '0,16', '1,68'),
  [[540, '1/2']],
  ...HEAD,
  [[80, 'fruits 360g']],
  P('3000000000073', 'AUCHAN Légumes pour couscous 5', '1,95', '2', '3,90', '5,50', '0,82', '4,11'),
  [[80, 'portions 1kg']],
  P('3000000000080', 'MARQUE Déodorant fraîcheur 50ml', '2,60', '1,00', '2', '3,20', '20,00', '3,84'),
  P('3000000000097', 'Vignettes', '0,00', '5', '0,00', '0,00', '0,00'),
  [[40, 'Taux TVA (%)'], [200, 'Prix HT (€)'], [300, 'TVA (€)'], [400, 'Prix TTC (€)']],
  [[40, 'Total Éco-Part (€)'], [400, '0,00']],
  [[40, '20,00'], [200, '3,20'], [300, '0,64'], [400, '3,84']],
  [[40, 'Total Facture TTC (€)'], [400, '54,66']],
  [[40, '5,50'], [200, '40,70'], [300, '2,23'], [400, '42,93']],
  [[40, 'Total Remises (€)'], [400, '-7,89']],
  [[40, 'Total à payer (€)'], [400, '46,77']],
  [[40, 'Total'], [200, '43,90'], [300, '2,87'], [400, '46,77']],
  [[40, 'TVA non récupérable'], [300, 'Cagnotte Waaoh'], [400, '1,47']],
  [[40, 'Mode de paiement'], [300, 'Montant réglé (€)']],
  [[40, 'WAAOH'], [300, '1,00']],
  [[40, 'CARTE CADEAU EXEMPLE'], [300, '20,00']],
  [[40, 'CARTE BANCAIRE'], [300, '25,77']],
  [[40, 'AUCHAN DRIVE EXEMPLE']],
  [[540, '2/2']],
];
