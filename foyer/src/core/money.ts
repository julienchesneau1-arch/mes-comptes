// Montants en centimes entiers (jamais de flottants) ; affichage français fixe, identique sur tous les téléphones.
const NBSP = ' ', NNBSP = ' ';

export function eur(cents: number): string {
  const neg = cents < 0, c = Math.abs(Math.round(cents));
  const units = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${neg ? '−' : ''}${units},${String(c % 100).padStart(2, '0')}${NBSP}€`;
}

// « 64 », « 64,3 », « 64.30 € », « 64,30 euros » → centimes. Autre chose → null (rien n'est deviné).
export function parseEuros(raw: string): number | null {
  const m = /^\s*(\d{1,6})(?:[.,](\d{1,2}))?\s*(?:€|eur|euros?)?\s*$/i.exec(raw);
  if (!m) return null;
  const c = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  return c > 0 ? c : null;
}
