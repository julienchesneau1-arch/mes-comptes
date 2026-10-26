// Budget : panier estimé sans rien saisir — prix payé lu sur une facture du drive d'abord, puis prix noté autrefois sur un produit
// retenu, puis prix relevé du produit conseillé, sinon prix moyen Insee —, montant payé, bilan.
import { type LocalDate, addDays, paris, slotKey, SLOTS } from './dates.ts';
import type { Paid, RecipeContent, State } from './model.ts';
import type { Replay } from './reduce.ts';
import { type ShopLine, type ShoppingList, deriveShopping, weekPreps } from './shopping.ts';
import { packsFor, paidFor, parseSize } from './drive.ts';
import { type RestockLine, RESTOCK_DEF, nameOf } from './restock.ts';
import { ingredientKey } from './ingredients.ts';
import { toPrepare, servings } from './plan.ts';
import { type Q, cmp, mul, q, qFrom, ZERO } from './rational.ts';
import { UNIT, toBase } from './units.ts';
import { type Ref, type RefPrices, refFor, refCost, refPrices } from './refprice.ts';
import { type Group, type Product, groupFor, productOf } from './products.ts';
import { nameKey } from './text.ts';

// partial : des articles restent non chiffrés ; le montant est alors un minimum (affiché « au moins »).
// reliable : au moins 80 % des articles sont chiffrés ; en dessous, pas de coût par portion (il tromperait).
// Les assaisonnements (sel, poivre, épices, herbes sèches) ne comptent ni dans le montant ni dans la proportion : quelques centimes.
// paid : articles chiffrés au prix payé sur une facture du drive (les autres le sont aux prix relevés ou de référence).
export interface Cart { cents: number; priced: number; paid: number; unpriced: number; seasonings: number; portions: number; perPortion: number | null; partial: boolean; reliable: boolean }
export const RELIABLE = 0.8;

const SEASONINGS = new Set(['sel', 'poivre', 'sel poivre', 'poivre noir', 'gros sel', 'fleur de sel', 'sel fin', 'epice', 'muscade', 'noix de muscade',
  'cumin', 'curry', 'paprika', 'piment', 'piment d\'espelette', 'piment de cayenne', 'cannelle', 'curcuma', 'herbe de provence', 'thym', 'laurier',
  'feuille de laurier', 'romarin', 'origan', 'bouquet garni', 'clou de girofle', 'quatre-epice', 'ras el hanout', 'gingembre en poudre', 'sariette']
  .map(nameKey));
// « Sel, laurier, thym, romarin » : chaque partie doit être un assaisonnement.
export const isSeasoning = (name: string): boolean => {
  const parts = name.split(/,| et /).map(x => nameKey(x)).filter(Boolean);
  return parts.length > 0 && parts.every(x => SEASONINGS.has(x));
};

export interface LineCost { cents: number; how: 'facture' | 'noté' | 'relevé' | 'référence'; ref: Ref | null; group: Group | null; product: Product | null; qty: Q | null; paid: Paid | null }

/* ---------- Calage sur vos factures (Pimzi cale ses prix par enseigne ; Foyer, sur vos propres achats) ---------- */

// Pour chaque article payé dont l'Insee publie aussi un prix moyen (même unité : kg, litre ou pièce) : prix payé ÷ prix Insee.
// La médiane de ces rapports corrige les seules estimations Insee (« référence ») ; les prix payés, notés ou relevés restent tels quels.
// Moins de 5 articles comparables : rien n'est corrigé. Facteur borné entre 0,5 et 2 (un rapprochement erroné ne fait pas tout dérailler).
export interface Calibration { factor: number | null; n: number; low: number | null; high: number | null }
export const CALIB_MIN = 5;
export const CALIB_BOUNDS = [0.5, 2] as const;
function paidPerRef(pd: Paid, ref: Ref): number | null {
  if (pd.loose) return (pd.unit === 'kg' && ref.per === 'kg') || (pd.unit === 'l' && ref.per === 'l') ? pd.cents : null;
  const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null;
  if (!u || !size || size.n <= 0) return null;
  const b = toBase(size, u), base = b.n / b.d;
  if ((ref.per === 'kg' && u.dim === 'masse') || (ref.per === 'l' && u.dim === 'volume')) return pd.cents * 1000 / base;
  return ref.per === 'piece' && u.dim === 'piece' ? pd.cents / base : null;
}
const CALIB = new WeakMap<State, { refs: RefPrices | null; cal: Calibration }>();
export function calibration(s: State): Calibration {
  const refs = refPrices(), hit = CALIB.get(s);
  if (hit && hit.refs === refs) return hit.cal;
  const ratios: number[] = [];
  for (const [key, pd] of Object.entries(s.paid)) {
    if (key.includes('|')) continue; // surgelé, en conserve… : pas le produit frais que relève l'Insee
    const ref = refFor(key), per = ref ? paidPerRef(pd, ref) : null;
    if (ref && per) ratios.push(per / ref.cents);
  }
  ratios.sort((a, b) => a - b);
  const n = ratios.length, mid = n % 2 ? ratios[(n - 1) / 2] as number : ((ratios[n / 2 - 1] ?? 0) + (ratios[n / 2] ?? 0)) / 2;
  const cal: Calibration = { factor: n >= CALIB_MIN ? Math.min(CALIB_BOUNDS[1], Math.max(CALIB_BOUNDS[0], Math.round(mid * 100) / 100)) : null, n,
    low: n ? ratios[0] as number : null, high: n ? ratios[n - 1] as number : null };
  CALIB.set(s, { refs, cal });
  return cal;
}
// « Estimations Insee calées sur vos factures : −8 % (médiane de 7 articles) ».
export function calibrationText(c: Calibration): string {
  if (c.factor === null) return c.n ? `Calage sur vos factures : ${c.n} article${c.n > 1 ? 's' : ''} comparable${c.n > 1 ? 's' : ''} sur ${CALIB_MIN} nécessaires.` : '';
  const pct = Math.round((c.factor - 1) * 100);
  return `Estimations Insee calées sur vos factures : ${pct === 0 ? 'au même niveau' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`} (médiane de ${c.n} articles payés comparés au prix moyen Insee).`;
}
const calibrated = (s: State, cents: number): number => { const f = calibration(s).factor; return f ? Math.round(cents * f) : cents; };

// Au prix payé sur la dernière facture : au poids (prix au kg × quantité exacte) ou en articles entiers de la contenance achetée.
// Contenance inconnue ou d'une autre dimension que le besoin : pas de montant (on ne devine pas combien en prendre).
export function paidCost(pd: Pick<Paid, 'cents' | 'size' | 'unit' | 'loose'>, l: ShopLine): number | null {
  if (!l.toBuy || cmp(l.toBuy, ZERO) <= 0) return null;
  if (pd.loose) {
    const per = pd.unit === 'l' ? 'l' : 'kg', g = refFor(l.name)?.pieceG;
    return refCost({ per, cents: pd.cents, ...(g ? { pieceG: g } : {}) }, l.dim, l.toBuy);
  }
  const packs = packsFor(l, pd);
  if (packs.n) return packs.n * pd.cents;
  // « 2 oignons » et un filet de 1 kg : pièces entières au poids moyen d'une pièce (USDA, comme pour les prix de référence).
  const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null, g = refFor(l.name)?.pieceG;
  if (l.dim !== 'piece' || u?.dim !== 'masse' || !size || !g) return null;
  const x = l.toBuy.n / l.toBuy.d, packG = (size.n / size.d) * (u.toBase.n / u.toBase.d);
  return Math.ceil(Math.ceil(x) * g / packG) * pd.cents;
}

// Coût d'une ligne à acheter : paquets du produit retenu si sa contenance est connue (on achète des paquets entiers), sinon la quantité exacte.
export function lineCost(s: State, l: ShopLine): LineCost | null {
  if (!l.toBuy || cmp(l.toBuy, ZERO) <= 0) return null;
  const pd = paidFor(s, l.name, l.form), paid = pd ? paidCost(pd, l) : null;
  if (pd && paid !== null) return { cents: paid, how: 'facture', ref: null, group: null, product: null, qty: null, paid: pd };
  const p = s.products[ingredientKey(l.name, l.form)];
  const packs = p ? packsFor(l, p) : null;
  if (p?.price && packs?.n) return { cents: packs.n * p.price, how: 'noté', ref: null, group: null, product: null, qty: null, paid: null };
  const u = p?.unit ? UNIT[p.unit] : undefined, size = p?.size ? qFrom(p.size) : null;
  const qty = packs?.n && u && size && u.dim === l.dim ? mul(q(packs.n), toBase(size, u)) : l.toBuy;
  const g = groupFor(l.name), adv = g ? productOf(g, g.value ?? g.cheap) : null;
  const seen = g && adv?.price ? refCost({ per: g.per, cents: adv.price.perCents }, l.dim, qty) : null;
  if (seen !== null) return { cents: seen, how: 'relevé', ref: null, group: g, product: adv, qty, paid: null };
  const ref = refFor(l.name), cents = ref ? refCost(ref, l.dim, qty) : null;
  return ref && cents !== null ? { cents: calibrated(s, cents), how: 'référence', ref, group: g, product: null, qty, paid: null } : null;
}

/* ---------- Coût d'un plat (proposition de la semaine, coût par portion) ---------- */

// Ce que coûte la quantité utilisée, au meilleur prix connu (payé, noté, relevé, Insee), sans arrondir au paquet entier :
// un paquet de pâtes sert plusieurs plats. Contenance d'une autre dimension : pièces pesées au poids moyen (USDA), sinon rien.
function proportional(pd: Pick<Paid, 'cents' | 'size' | 'unit'>, name: string, dim: string, qty: Q): number | null {
  const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null;
  if (!u || !size || size.n <= 0) return null;
  const per = toBase(size, u), x = qty.n / qty.d, packBase = per.n / per.d;
  if (u.dim === dim) return Math.round(pd.cents * x / packBase);
  const g = refFor(name)?.pieceG;
  return dim === 'piece' && u.dim === 'masse' && g ? Math.round(pd.cents * Math.ceil(x) * g / packBase) : null;
}
export function unitCost(s: State, name: string, form: string | null, dim: string, qty: Q): number | null {
  const pd = paidFor(s, name, form), paid = pd ? proportional(pd, name, dim, qty) : null;
  if (paid !== null) return paid;
  const p = s.products[ingredientKey(name, form)], noted = p?.price ? proportional({ cents: p.price, size: p.size, unit: p.unit }, name, dim, qty) : null;
  if (noted !== null) return noted;
  const g = groupFor(name), adv = g ? productOf(g, g.value ?? g.cheap) : null;
  const seen = g && adv?.price ? refCost({ per: g.per, cents: adv.price.perCents }, dim, qty) : null;
  if (seen !== null) return seen;
  const ref = refFor(name), cents = ref ? refCost(ref, dim, qty) : null;
  return cents === null ? null : calibrated(s, cents);
}
export interface DishCost { cents: number; priced: number; unpriced: number; perPortion: number | null; partial: boolean; reliable: boolean }
// Coût d'un plat pour n portions ; null si le rendement de la recette n'est pas renseigné (pas de quantités à calculer).
export function dishCost(s: State, c: Pick<RecipeContent, 'yield' | 'ingredients'>, portions: number): DishCost | null {
  if (!c.yield || portions <= 0) return null;
  let cents = 0, priced = 0, unpriced = 0;
  for (const l of c.ingredients) {
    if (isSeasoning(l.name)) continue;
    const u = l.unit ? UNIT[l.unit] : undefined, n = l.qty ? qFrom(l.qty) : null;
    const x = u && n ? unitCost(s, l.name, l.form, u.dim, mul(toBase(n, u), q(portions, c.yield))) : null;
    if (x === null) unpriced++; else { cents += x; priced++; }
  }
  return { cents, priced, unpriced, perPortion: priced ? Math.round(cents / portions) : null, partial: unpriced > 0,
    reliable: priced > 0 && priced / (priced + unpriced) >= RELIABLE };
}

/* ---------- Produits du quotidien (core/restock.ts) : un achat = un paquet ---------- */

export interface RestockCost { cents: number; how: 'facture' | 'noté' | 'relevé' | 'référence'; paid: Paid | null; ref: Ref | null }
// Prix d'un achat : payé sur la dernière facture (sous le nom du produit ou d'un de ses ingrédients), sinon noté sur le produit retenu,
// sinon relevé (Open Prices) ou prix moyen Insee rapportés à la contenance du produit. Contenance inconnue : prix d'un article tel quel
// pour une facture ou un prix noté, rien sinon (on ne devine pas une quantité). Un par personne : multiplié par le nombre de personnes.
export function restockCost(s: State, id: string): RestockCost | null {
  const def = RESTOCK_DEF[id], names = [nameOf(id, s.restock[id]), ...(def?.keys ?? [])];
  const n = def?.share === 'chacun' ? Math.max(1, s.members.length) : 1;
  const size = def?.size ? parseSize(def.size) : null, dim = size?.unit.dim ?? null, base = size ? toBase(size.size, size.unit) : null;
  // Article de contenance connue, rapporté à la contenance de l'achat : paquets entiers.
  const scaled = (cents: number, sz: string | null, unit: string | null): number => {
    const u = unit ? UNIT[unit] : undefined, x = sz ? qFrom(sz) : null;
    if (!base || !u || !x || u.dim !== dim || x.n <= 0) return cents;
    const per = toBase(x, u);
    return cents * Math.max(1, Math.ceil((base.n / base.d) / (per.n / per.d) - 1e-9));
  };
  for (const nm of names) {
    const pd = s.paid[nameKey(nm)];
    if (!pd) continue;
    const c = pd.loose ? refCost({ per: pd.unit === 'l' ? 'l' : 'kg', cents: pd.cents }, dim, base) : scaled(pd.cents, pd.size, pd.unit);
    if (c !== null) return { cents: c * n, how: 'facture', paid: pd, ref: null };
  }
  for (const nm of names) {
    const p = s.products[nameKey(nm)];
    if (p?.price) return { cents: scaled(p.price, p.size, p.unit) * n, how: 'noté', paid: null, ref: null };
  }
  for (const nm of names) {
    const g = groupFor(nm), adv = g ? productOf(g, g.value ?? g.cheap) : null;
    const seen = g && adv?.price ? refCost({ per: g.per, cents: adv.price.perCents }, dim, base) : null;
    if (seen !== null) return { cents: seen * n, how: 'relevé', paid: null, ref: null };
    const ref = refFor(nm), cents = ref ? refCost(ref, dim, base) : null;
    if (ref && cents !== null) return { cents: calibrated(s, cents) * n, how: 'référence', paid: null, ref };
  }
  return null;
}
export interface RestockPart { todo: readonly RestockLine[]; byLine: ReadonlyMap<string, RestockLine> }

// restock : produits du quotidien de la semaine (à part, ou portés par la ligne d'une recette : on achète alors le paquet).
export function cartEstimate(s: State, list: ShoppingList, restock: RestockPart = { todo: [], byLine: new Map() }): Cart {
  let cents = 0, priced = 0, paid = 0, unpriced = 0, seasonings = 0, meal = 0, mealPriced = 0, mealUnpriced = 0;
  const add = (c: { cents: number; how: string } | null): void => { if (c) { cents += c.cents; priced++; if (c.how === 'facture') paid++; } else unpriced++; };
  for (const l of list.lines) {
    if (l.pantry?.active && l.pantry.qty === 'all') continue;
    if (l.toBuy && cmp(l.toBuy, ZERO) <= 0 && !l.unknown.length) continue;
    const r = restock.byLine.get(l.key), rc = r && !r.done && !l.done ? restockCost(s, r.id) : null;
    const own = isSeasoning(l.name) ? undefined : lineCost(s, l); // part des recettes seule : base du coût par portion
    if (own) { meal += own.cents; mealPriced++; } else if (own === null) mealUnpriced++;
    if (rc) { add(rc); continue; }
    if (own === undefined) { seasonings++; continue; }
    add(own);
  }
  for (const r of restock.todo) { if (isSeasoning(r.name)) seasonings++; else add(restockCost(s, r.id)); }
  const manual = list.manual.filter(m => !isSeasoning(m.name)).length;
  unpriced += manual; mealUnpriced += manual;
  const portions = weekPreps(s, list.week).reduce((n, p) => n + toPrepare(s, p), 0);
  // Coût par portion : les recettes seules (le dentifrice ou le pack de lait entier ne se mangent pas ce soir).
  const reliable = mealPriced > 0 && mealPriced / (mealPriced + mealUnpriced) >= RELIABLE;
  return { cents, priced, paid, unpriced, seasonings, portions, perPortion: reliable && portions ? Math.round(meal / portions) : null, partial: unpriced > 0, reliable };
}

// « ≈ 48 € » si tout est chiffré, « au moins 48 € » sinon ; vide si rien ne l'est encore.
export const cartText = (c: Cart, eur: (cents: number) => string): string => (c.priced ? `${c.partial ? 'au moins ' : '≈ '}${eur(c.cents)}` : '');
// « 9 articles chiffrés sur 33 » : ce que couvre le montant.
export const coverText = (c: Cart): string => `${c.partial ? `${c.priced} article${c.priced > 1 ? 's' : ''} chiffré${c.priced > 1 ? 's' : ''} sur ${c.priced + c.unpriced}` : 'tous les articles chiffrés'}${c.seasonings ? ', hors sel et épices' : ''}`;

export interface WeekReport {
  week: LocalDate;
  spent: number | null;      // montant payé noté
  estimate: Cart;
  home: number;              // portions servies à la maison ou en boîte, d'après le planning
  outside: number;           // repas notés « extérieur »
  thrown: number;            // portions déclarées jetées + produits surveillés jetés, cette semaine-là
  perPortion: number | null; // payé (sinon estimé) ÷ portions cuisinées
  partial: boolean;          // pas de montant payé et estimation incomplète : perPortion est un minimum
}

export function weekReport(r: Replay, week: LocalDate): WeekReport {
  const s = r.state, days = Array.from({ length: 7 }, (_, i) => addDays(week, i)), last = days[6] as LocalDate;
  let home = 0, outside = 0;
  for (const d of days) for (const sl of SLOTS) {
    const x = s.slots[slotKey(d, sl)]?.dish;
    if (x?.kind === 'outside') outside++;
    else if (x) home += servings(s, slotKey(d, sl));
  }
  let thrown = 0;
  for (const e of r.events.values()) {
    if (r.undone.has(e.id) || r.rejected.has(e.id)) continue;
    const d = paris(new Date(e.at)).date;
    if (d < week || d > last) continue;
    if (e.t === 'prep.discard' && e.p.reason === 'jeté') thrown += e.p.n;
    if (e.t === 'watch.close' && e.p.outcome === 'jete') thrown++;
  }
  const estimate = cartEstimate(s, deriveShopping(s, week));
  const spent = s.shop[week]?.spent?.cents ?? null;
  const base = spent ?? (estimate.reliable ? estimate.cents : null);
  return { week, spent, estimate, home, outside, thrown, perPortion: base && estimate.portions ? Math.round(base / estimate.portions) : null, partial: spent === null && estimate.partial };
}
