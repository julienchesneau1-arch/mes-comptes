// Lecteur de factures du drive, sans IA et sur le téléphone : le texte du PDF (extrait par pdf.js, voir ui/invoice.ts) est remis
// en lignes, puis chaque ligne « produit … quantité … prix … montant » est lue par des règles fixes, vérifiées par le calcul
// (quantité × prix = montant, au centime près). Rien n'est deviné : une ligne non vérifiable est signalée comme telle.
// Données personnelles : seules les lignes portant un montant en euros sont lues, et seuls le nom du produit, sa contenance
// et son prix sont retenus. Nom, adresse, carte de fidélité, numéro de commande ne sortent jamais de cette fonction.
// Factures Auchan drive : lecture dédiée, calée sur trois factures réelles (octobre 2026), reproduites anonymisées en test ;
// les autres formats passent par les règles génériques (factures françaises).
import { type LocalDate, isDate } from './dates.ts';
import type { State } from './model.ts';
import { parseSize } from './drive.ts';
import { deriveShopping } from './shopping.ts';
import { ingredientKey } from './ingredients.ts';
import { GROUP_DEFS } from './products.ts';
import { REF_DEFS } from './refprice.ts';
import { qStr } from './rational.ts';
import { nameKey, norm } from './text.ts';

export interface TextItem { str: string; x: number; y: number; page: number }

// Lignes de texte : morceaux d'une même page à la même hauteur (à 2 points près), lus de gauche à droite. Tri : O(n log n).
export function toLines(items: readonly TextItem[], tol = 2): string[] {
  const sorted = items.filter(i => i.str.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: { page: number; y: number; parts: TextItem[] }[] = [];
  for (const it of sorted) {
    const r = rows[rows.length - 1];
    if (r && r.page === it.page && Math.abs(r.y - it.y) <= tol) r.parts.push(it);
    else rows.push({ page: it.page, y: it.y, parts: [it] });
  }
  return rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.str.trim()).join(' ').replace(/\s+/g, ' ').trim());
}

export interface InvoiceLine {
  label: string;           // nom du produit tel qu'imprimé (sans code article)
  n: number;               // nombre d'articles (1 pour un produit pesé)
  unitCents: number;       // prix d'un article ; prix au kg (ou au litre) si pesé
  cents: number;           // montant de la ligne
  loose: boolean;          // vendu au poids : unitCents est un prix au kg
  weight: number | null;   // kg pesés
  size: string | null; unit: string | null; // contenance d'un article, lue dans le nom (« 500 g », « 6 x 1 L », « x12 »)
  sure: boolean;           // vérifié par le calcul (quantité × prix = montant)
}
export interface Invoice { day: LocalDate | null; total: number | null; lines: InvoiceLine[]; sum: number; ignored: number }

type Tok = { k: 'money' | 'weight' | 'int' | 'skip'; v: number };
const MONEY_RE = /^-?\d{1,5}[,.]\d{2}$/, WEIGHT_RE = /^\d{1,3}[,.]\d{3}$/;
const SKIP_RE = /^(?:€|eur|x|\*|%|kg|l|le|\/kg|\/l|€\/kg|€\/l|-?\d{1,3}(?:[,.]\d{1,2})?%)$/;
const cents = (s: string): number => Math.round(Number(s.replace(',', '.')) * 100);
// Lignes qui ne sont pas des produits : totaux, taxes, frais de service, remises, paiement. Expressions précises :
// « Œufs frais » ou « Préparation pour gâteau » restent des produits.
const NOT_ITEM = /\b(total|sous-total|tva|t\.v\.a|ht|ttc|remises?|reductions?|avantages?|cagnotte|waaoh|fidelite|bons? d'achat|coupons?|economies?|frais (?:de |d')?(?:livraison|preparation|service|port|retrait|gestion)|livraison|paiement|payer|paye|rendu|acompte|arrondi|montant|avoir|consigne|carte (?:bancaire|cb|de fidelite|cadeau)|cb|visa|mastercard)\b/;
const TOTAL_STRONG = /\b(net a payer|total a payer|total ttc|montant total|total paye|montant paye|total de la commande|total commande)\b/;
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// Fin de ligne chiffrée, lue de droite à gauche : montants (2 décimales), poids (3 décimales), quantités (1 à 99),
// et ce qui les entoure (€, %, « x », « kg », « /kg »), plus un code TVA d'une lettre tout au bout.
function tail(words: readonly string[]): { i: number; t: Tok }[] {
  const toks: { i: number; t: Tok }[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = (words[i] ?? '').toLowerCase();
    if (SKIP_RE.test(w) || (/^[a-z]$/.test(w) && toks.every(x => x.t.k === 'skip'))) toks.unshift({ i, t: { k: 'skip', v: 0 } });
    else if (MONEY_RE.test(w)) toks.unshift({ i, t: { k: 'money', v: cents(w) } });
    else if (WEIGHT_RE.test(w)) toks.unshift({ i, t: { k: 'weight', v: Number(w.replace(',', '.')) } });
    else if (/^\d{1,2}$/.test(w) && Number(w) >= 1) toks.unshift({ i, t: { k: 'int', v: Number(w) } });
    else break;
  }
  return toks;
}

// Contenance lue dans le nom du produit : lot (« 4x125g », « 6 x 1 L »), masse ou volume (« 500 g », « 1,5kg », « 75cl »), nombre (« x12 »).
export function labelSize(label: string): { size: string; unit: string } | null {
  const s = norm(label);
  const lot = /(\d{1,2}) ?[x×*] ?(\d{1,4}(?:[.,]\d{1,3})?) ?(kg|g|l|cl|ml)\b/.exec(s);
  const one = /(\d{1,4}(?:[.,]\d{1,3})?) ?(kg|g|l|cl|ml)\b/.exec(s);
  const count = /(?:\b|^)[x×] ?(\d{1,3})\b|\b(\d{1,3}) ?(?:pieces?|pcs?|unites?|oeufs?)\b/.exec(s);
  const raw = lot ? `${lot[1]} x ${lot[2]} ${lot[3]}` : one ? `${one[1]} ${one[2]}` : count ? `${count[1] ?? count[2]}` : null;
  const r = raw ? parseSize(raw) : null;
  return r ? { size: qStr(r.size), unit: r.unit.id } : null;
}

// Nom imprimé, sans code article ni code-barres (suites de 5 chiffres ou plus) en tête ou en fin.
const cleanLabel = (s: string): string => s.replace(/^(?:\d{5,}\s+)+/, '').replace(/(?:\s+\d{5,})+$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);

// Ligne de facture Auchan : « code · produit · prix U. HT · remise U. HT (facultative) · qté · total net HT · taux TVA ·
// cagnotte (facultative) · total net TTC ». Retenue seulement si deux calculs tombent juste : (prix − remise) × qté = total HT
// (à 1 centime par article près, le prix unitaire étant arrondi à l'affichage) et total HT × (1 + TVA) = total TTC (à 1 centime).
// Prix retenu : le TTC net de remise ; la cagnotte, versée sur la carte pour un prochain achat, n'est pas déduite.
const VAT = new Set([0, 210, 550, 1000, 2000]);
function readColumns(words: readonly string[]): InvoiceLine | null {
  let k = words.length;
  while (k > 0 && (MONEY_RE.test(words[k - 1] ?? '') || /^\d{1,3}$/.test(words[k - 1] ?? ''))) k--;
  const t = words.slice(k), m = (i: number): number | null => (i >= 0 && MONEY_RE.test(t[i] ?? '') ? cents(t[i] as string) : null);
  const ttc = m(t.length - 1);
  if (t.length < 5 || ttc === null || ttc <= 0) return null;
  for (const cag of [0, 1]) {
    const e = t.length - 1 - cag, rate = m(e - 1), ht = m(e - 2), qi = e - 3, q = /^\d{1,3}$/.test(t[qi] ?? '') ? Number(t[qi]) : 0;
    if ((cag && m(e) === null) || rate === null || !VAT.has(rate) || ht === null || ht <= 0 || q < 1) continue;
    if (Math.abs(Math.round(ht * (10000 + rate) / 10000) - ttc) > 1) continue;
    for (const rem of [1, 0]) {
      const pu = m(qi - 1 - rem), off = rem ? m(qi - 1) : 0;
      if (pu === null || off === null || Math.abs((pu - off) * q - ht) > q) continue;
      const label = cleanLabel(words.slice(0, k + qi - 1 - rem).join(' '));
      if ((label.match(/[a-zà-ÿ]/gi) ?? []).length < 3) return null;
      const sz = labelSize(label);
      return { label, n: q, unitCents: Math.round(ttc / q), cents: ttc, loose: false, weight: null, size: sz?.size ?? null, unit: sz?.unit ?? null, sure: true };
    }
  }
  return null;
}

function readLine(line: string): InvoiceLine | null {
  const words = line.replace(/€/g, ' € ').replace(/×/g, ' x ').replace(/[\u00a0\u202f]/g, ' ').split(/\s+/).filter(Boolean);
  const col = readColumns(words);
  if (col) return col;
  const toks = tail(words), of = (k: Tok['k']) => toks.filter(x => x.t.k === k);
  const last = of('money').at(-1);
  if (!last || last.t.v <= 0) return null;
  const total = last.t.v, before = (k: Tok['k']) => of(k).filter(x => x.i < last.i);
  const pk = before('money'), w = before('weight')[0];
  // « x 12 » ou « 1 l » : contenance du paquet (nom du produit), pas une quantité achetée. « 2 Oignons … » : quantité en tête.
  const lead = /^\d{1,2}$/.test(words[0] ?? '') && Number(words[0]) >= 1 && last.i > 1 ? { i: 0, t: { k: 'int' as const, v: Number(words[0]) } } : null;
  const ints = [...(lead ? [lead] : []), ...before('int').filter(x => (words[x.i - 1] ?? '').toLowerCase() !== 'x' && !/^(?:kg|g|l|cl|ml)$/i.test(words[x.i + 1] ?? ''))];
  let n = 1, unit = total, loose = false, weight: number | null = null, sure = false, used = last.i, from = 0;
  const perKg = w ? pk.find(p => Math.abs(Math.round(w.t.v * p.t.v) - total) <= 1) : undefined;
  const counted = ints.flatMap(a => pk.map(b => [a, b] as const)).reverse().find(([a, b]) => a.t.v * b.t.v === total);
  if (w && perKg) { loose = true; weight = w.t.v; unit = perKg.t.v; sure = true; used = Math.min(w.i, perKg.i); }       // poids × prix au kg
  else if (counted) { // quantité × prix
    n = counted[0].t.v; unit = counted[1].t.v; sure = true;
    if (counted[0] === lead) { from = 1; used = counted[1].i; } else used = Math.min(counted[0].i, counted[1].i);
  } else if (pk.some(p => p.t.v === total)) { sure = true; used = (pk.find(p => p.t.v === total) as (typeof pk)[number]).i; } // « 1,25 1,25 »
  else if (pk.length) return null; // deux montants sans rapport : ligne non comprise, rien n'est deviné
  else { // quantité sans prix unitaire : vérifiable seulement pour un article
    const prev = toks.filter(x => x.i < last.i && x.t.k !== 'skip').at(-1), qn = prev?.t.k === 'int' && ints.includes(prev) ? prev : lead;
    if (qn) { n = qn.t.v; unit = Math.round(total / n); sure = n === 1; if (qn === lead) from = 1; else used = qn.i; }
  }
  const label = cleanLabel(words.slice(from, used).join(' ').replace(/(?:\s+(?:€|eur|x|\*))+$/i, ''));
  if ((label.match(/[a-zà-ÿ]/gi) ?? []).length < 3) return null;
  const sz = loose ? null : labelSize(label);
  return { label, n, unitCents: unit, cents: total, loose, weight, size: loose ? '1' : sz?.size ?? null, unit: loose ? 'kg' : sz?.unit ?? null, sure };
}

// Date d'achat : celle de la livraison ou du retrait, sinon de la commande, sinon de la facture. Le libellé est sur la même ligne
// (« Facture du 03/10/2026 ») ou juste au-dessus, en colonne (« Date de commande : », la date en dessous). Chez Auchan,
// « Facture éditée le » donne le jour du téléchargement : la date de commande passe devant.
const DATE_RANK: readonly (readonly [RegExp, number])[] = [[/livr|retrait|enlev/, 3], [/commande/, 2], [/facture|date|emis|edit/, 1]];
const dateRank = (s: string): number => Math.max(0, ...DATE_RANK.filter(([re]) => re.test(s)).map(([, n]) => n));
function readDate(lines: readonly string[]): LocalDate | null {
  let best: { day: LocalDate; rank: number } | null = null, pending = 0, ttl = 0;
  for (const line of lines) {
    const s = norm(line);
    const m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/.exec(s), t = new RegExp(`\\b(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})\\b`).exec(s);
    const y = m ? (m[3]?.length === 2 ? `20${m[3]}` : m[3]) : t?.[3], mo = m ? m[2] : t ? String(MONTHS.indexOf(t[2] ?? '') + 1) : null, d = m ? m[1] : t?.[1];
    const day = y && mo && d ? `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
    if (!day || !isDate(day) || (y ?? '') < '2000' || (y ?? '') > '2099') {
      const r = dateRank(s);
      if (r) { pending = r; ttl = 2; } else if (ttl) ttl--;
      continue;
    }
    const rank = Math.max(dateRank(s.slice(0, (m ?? t)?.index ?? 0)), ttl ? pending : 0);
    if (!best || rank > best.rank) best = { day, rank };
    pending = 0; ttl = 0;
  }
  return best?.day ?? null;
}

// En-têtes répétés en haut de chaque page (Auchan) et numéros de page : ils ne coupent pas un nom de produit sur deux pages.
const NOISE = /^(?:votre (?:commande|facture|code)|prix u\.|reference caracteristiques|\(ht\)|\d{1,2} ?\/ ?\d{1,2}$)/;
// Suite du nom du produit sur la ligne suivante (« lait 4x125g », « 250g », « Reggiano AOP râpé 60g ») : commence par une
// minuscule ou un chiffre, ou par une majuscule si elle porte une contenance ; courte, sans montant, ni « : », ni suite de
// 5 chiffres (code postal, numéro), ni mot d'adresse. Un nom de personne n'a pas de contenance : il n'est jamais rattaché.
const NOT_CONT = /[:@]|\d{5}|\d[,.]\d{2}\b|\b(?:rue|avenue|bd|boulevard|chemin|allee|impasse|place|route|quai|cedex)\b/;
const isCont = (raw: string, s: string): boolean => raw.length <= 60 && !NOT_CONT.test(s) && (/^[a-zà-ÿ0-9]/.test(raw) || labelSize(raw) !== null);

export function parseInvoice(lines: readonly string[]): Invoice {
  const out: InvoiceLine[] = [];
  let strong: number | null = null, weak: number | null = null, ignored = 0, last: InvoiceLine | null = null;
  for (const raw of lines) {
    const s = norm(raw);
    if (NOISE.test(s) || (/\d{6}/.test(s) && !/\d[,.]\d{2}\b/.test(s))) continue; // numéros de commande, de facture, de carte : jamais lus
    const r = readLine(raw);
    if (!r && last && !NOT_ITEM.test(s) && isCont(raw.trim(), s)) {
      last.label = cleanLabel(`${last.label} ${raw}`);
      if (!last.loose) { const sz = labelSize(last.label); last.size = sz?.size ?? null; last.unit = sz?.unit ?? null; }
      continue;
    }
    last = null;
    if (NOT_ITEM.test(s)) {
      const amount = r?.cents ?? null;
      if (amount !== null && TOTAL_STRONG.test(s)) strong = amount;
      else if (amount !== null && /\btotal\b/.test(s) && !/sous-total|tva|\bht\b/.test(s)) weak = amount;
      else if (amount !== null) ignored++;
      continue;
    }
    if (r) { out.push(r); last = r; }
  }
  return { day: readDate(lines), total: strong ?? weak, lines: out, sum: out.reduce((n, l) => n + l.cents, 0), ignored };
}

/* ---------- Rapprochement : quel ingrédient du foyer correspond à quel produit ---------- */

export interface Candidate { key: string; name: string; not?: RegExp }
const STOP = new Set(['auchan', 'bio', 'x', 'g', 'kg', 'l', 'cl', 'ml', 'le', 'la', 'les', 'de', 'du', 'des', 'd', 'a', 'au', 'aux', 'en', 'et',
  'avec', 'sans', 'piece', 'pc', 'pcs', 'mon', 'ma', 'mes', 'notre', 'pour', 'sur', 'un', 'une']);
// Abréviations des libellés courts d'Auchan (vues sur de vraies factures : « PDT 2,5KG FOUR », « FILET PLT BLANC »).
const ABBR: Record<string, string> = { pdt: 'pommes de terre', plt: 'poulet', scisse: 'saucisse', from: 'fromage', brioc: 'brioche', auc: 'auchan', ss: 'sans' };
const words = (s: string): string[] => nameKey(norm(s).split(/\s+/).map(w => ABBR[w] ?? w).join(' ')).split(/[ '-]+/).filter(w => w && !STOP.has(w) && !/^\d/.test(w));

// Le candidat dont tous les mots figurent dans le nom imprimé ; le plus précis gagne (« sauce tomate » avant « tomate »),
// puis celui dont le premier mot vient en tête du nom. Égalité indécidable : aucun choix (la personne choisit).
// Le produit est nommé en tête : « KIRI Fromage fondu à la crème » n'est pas de la crème, ni « Brioche goût pomme » une pomme.
// La marque en capitales qui précède un nom en minuscules (« AUCHAN TAVOLA IN ITALIA Parmigiano ») ne compte pas. Un
// ingrédient d'un mot doit être l'un des deux premiers mots du produit ; de plusieurs mots, commencer dans les trois premiers.
const product = (label: string): string => /[a-zà-ÿ]/.test(label) ? label.replace(/^(?:[^a-zà-ÿ\s]+\s+)+(?=\S*[a-zà-ÿ])/, '') : label;
export function matchKey(label: string, cands: readonly Candidate[]): Candidate | null {
  const lw = words(product(label)), plain = norm(label);
  let best: { c: Candidate; score: number; pos: number } | null = null, tie = false;
  for (const c of cands) {
    const cw = words(c.name);
    if (!cw.length || !cw.every(w => lw.includes(w)) || c.not?.test(plain)) continue;
    const score = cw.length, pos = lw.indexOf(cw[0] as string);
    if (pos > (score > 1 ? 2 : 1)) continue;
    if (!best || score > best.score || (score === best.score && pos < best.pos)) { best = { c, score, pos }; tie = false; }
    else if (score === best.score && pos === best.pos && c.key !== best.c.key) tie = true;
  }
  return best && !tie ? best.c : null;
}

// Ingrédients auxquels rattacher un produit : ceux des courses des semaines données (avec leur forme : surgelé, en conserve…),
// les produits de base, ceux déjà retenus ou déjà payés, et les noms génériques des prix de référence et de l'étude qualité-prix.
// Le garde-fou d'un groupe (« crème » mais pas « crème dessert ») suit le nom.
export function candidates(s: State, weeks: readonly LocalDate[]): Candidate[] {
  const guard = new Map<string, RegExp>();
  for (const d of GROUP_DEFS) if (d.not) for (const k of d.keys) guard.set(nameKey(k), d.not);
  const out = new Map<string, Candidate>();
  const add = (key: string, name: string): void => {
    const g = guard.get(nameKey(name));
    if (key && name && !out.has(key)) out.set(key, g ? { key, name, not: g } : { key, name });
  };
  for (const w of weeks) for (const l of deriveShopping(s, w).lines) {
    add(ingredientKey(l.name, l.form), l.form ? `${l.name} ${l.form}` : l.name);
    add(nameKey(l.name), l.name);
  }
  for (const [key, st] of Object.entries(s.staples)) add(key, st.name);
  for (const key of [...Object.keys(s.products), ...Object.keys(s.paid)]) add(key, key.replace('|', ' '));
  for (const d of [...GROUP_DEFS, ...REF_DEFS]) for (const k of d.keys) add(nameKey(k), k);
  return [...out.values()];
}

/* ---------- Texte du PDF (pdf.js, passé en paramètre : chargé à la demande dans l'app, importé tel quel dans les tests) ---------- */

export interface PdfLib {
  getDocument(p: { data: Uint8Array; verbosity: number; disableFontFace: boolean; useSystemFonts: boolean }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: readonly { str?: unknown; transform?: unknown }[] }> }> }>;
    destroy(): Promise<void>;
  };
}
export const MAX_PAGES = 20;
// Morceaux de texte et leur position, page par page (20 pages au plus). Le document est refermé dans tous les cas.
export async function pdfItems(lib: PdfLib, data: Uint8Array): Promise<TextItem[]> {
  const task = lib.getDocument({ data, verbosity: 0, disableFontFace: true, useSystemFonts: false });
  try {
    const doc = await task.promise, out: TextItem[] = [];
    for (let page = 1; page <= Math.min(doc.numPages, MAX_PAGES); page++) {
      for (const it of (await (await doc.getPage(page)).getTextContent()).items) {
        const t = it.transform;
        if (typeof it.str === 'string' && Array.isArray(t)) out.push({ str: it.str, x: Number(t[4]) || 0, y: Number(t[5]) || 0, page });
      }
    }
    return out;
  } finally { await task.destroy(); }
}
