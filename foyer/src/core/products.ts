// Étude qualité-prix des produits vendus chez Auchan, sans rien saisir et sans IA (aucun token) :
// - qualité : base ouverte Open Food Facts (Nutri-Score, groupe NOVA de transformation, labels bio, Label Rouge, AOP/IGP) ;
// - prix : relevés datés de la base ouverte Open Prices (tickets et étiquettes photographiés par des contributeurs),
//   ceux d'un magasin Auchan d'abord. Ce ne sont pas les prix du site Auchan (ses CGU interdisent de les extraire).
// Le fichier produits.json est régénéré chaque mois par la CI (scripts/produits.mjs) ; l'app le lit tel quel, hors ligne.
import { type Per } from './refprice.ts';
import { parseSize } from './drive.ts';
import { toBase } from './units.ts';
import { nameKey } from './text.ts';

// Un groupe = des ingrédients de recette (noms normalisés) → une catégorie Open Food Facts.
export interface GroupDef { id: string; label: string; keys: readonly string[]; tags: readonly string[]; per: Per }
export const GROUP_DEFS: readonly GroupDef[] = [
  { id: 'creme', label: 'Crème fraîche', keys: ['crème fraîche', 'crème fraîche épaisse', 'crème épaisse', 'crème'], tags: ['fr:cremes-fraiches'], per: 'l' },
  { id: 'creme-liquide', label: 'Crème liquide', keys: ['crème liquide', 'crème fleurette', 'crème fraîche liquide', 'crème entière liquide'], tags: ['fr:cremes-liquides', 'en:liquid-creams'], per: 'l' },
  { id: 'beurre', label: 'Beurre', keys: ['beurre', 'beurre doux', 'beurre demi-sel'], tags: ['en:butters'], per: 'kg' },
  { id: 'lait', label: 'Lait demi-écrémé', keys: ['lait', 'lait demi-écrémé'], tags: ['en:semi-skimmed-milks'], per: 'l' },
  { id: 'oeufs', label: 'Œufs', keys: ['œuf', 'œufs', 'oeuf', 'oeufs', 'œuf frais', 'gros œuf'], tags: ['en:eggs', 'en:chicken-eggs'], per: 'piece' },
  { id: 'pates', label: 'Pâtes', keys: ['pâtes', 'pâte sèche', 'spaghetti', 'penne', 'tagliatelle', 'fusilli', 'coquillette', 'macaroni', 'farfalle', 'linguine', 'rigatoni'], tags: ['en:pastas', 'en:dry-pastas'], per: 'kg' },
  { id: 'riz', label: 'Riz', keys: ['riz', 'riz basmati', 'riz long', 'riz thaï', 'riz rond'], tags: ['en:rices'], per: 'kg' },
  { id: 'farine', label: 'Farine de blé', keys: ['farine', 'farine de blé', 'farine t45', 'farine t55'], tags: ['en:wheat-flours'], per: 'kg' },
  { id: 'sucre', label: 'Sucre', keys: ['sucre', 'sucre en poudre', 'sucre semoule'], tags: ['en:white-sugars', 'en:sugars'], per: 'kg' },
  { id: 'huile-olive', label: 'Huile d\'olive', keys: ['huile d\'olive', 'huile d\'olive vierge extra'], tags: ['en:extra-virgin-olive-oils', 'en:olive-oils'], per: 'l' },
  { id: 'huile', label: 'Huile de tournesol', keys: ['huile', 'huile de tournesol', 'huile végétale', 'huile neutre'], tags: ['en:sunflower-oils'], per: 'l' },
  { id: 'emmental', label: 'Emmental râpé', keys: ['emmental', 'emmental râpé', 'fromage râpé', 'gruyère râpé'], tags: ['en:grated-emmental', 'en:emmentals'], per: 'kg' },
  { id: 'parmesan', label: 'Parmesan', keys: ['parmesan', 'parmigiano', 'parmigiano reggiano'], tags: ['en:parmigiano-reggiano'], per: 'kg' },
  { id: 'mozzarella', label: 'Mozzarella', keys: ['mozzarella'], tags: ['en:mozzarella'], per: 'kg' },
  { id: 'lardons', label: 'Lardons', keys: ['lardons', 'lardons fumés', 'lardon'], tags: ['fr:lardons'], per: 'kg' },
  { id: 'jambon', label: 'Jambon blanc', keys: ['jambon', 'jambon blanc', 'jambon de paris', 'jambon cuit'], tags: ['en:white-hams', 'en:cooked-hams'], per: 'kg' },
  { id: 'thon', label: 'Thon en boîte', keys: ['thon', 'thon au naturel', 'thon en boîte'], tags: ['en:canned-tunas'], per: 'kg' },
  { id: 'tomates-concassees', label: 'Tomates concassées', keys: ['tomates concassées', 'pulpe de tomate', 'tomates pelées', 'tomate concassée'], tags: ['en:crushed-tomatoes', 'en:peeled-tomatoes'], per: 'kg' },
  { id: 'concentre', label: 'Concentré de tomate', keys: ['concentré de tomate', 'double concentré de tomate'], tags: ['en:tomato-pastes'], per: 'kg' },
  { id: 'sauce-tomate', label: 'Sauce tomate', keys: ['sauce tomate', 'coulis de tomate', 'passata'], tags: ['en:tomato-sauces'], per: 'kg' },
  { id: 'lentilles', label: 'Lentilles', keys: ['lentilles', 'lentilles vertes', 'lentilles corail'], tags: ['en:lentils'], per: 'kg' },
  { id: 'pois-chiches', label: 'Pois chiches', keys: ['pois chiches'], tags: ['en:chickpeas'], per: 'kg' },
  { id: 'lait-coco', label: 'Lait de coco', keys: ['lait de coco'], tags: ['en:coconut-milks'], per: 'l' },
  { id: 'moutarde', label: 'Moutarde', keys: ['moutarde', 'moutarde de dijon'], tags: ['en:dijon-mustards', 'en:mustards'], per: 'kg' },
  { id: 'chapelure', label: 'Chapelure', keys: ['chapelure'], tags: ['en:breadcrumbs'], per: 'kg' },
  { id: 'yaourt', label: 'Yaourt nature', keys: ['yaourt', 'yaourt nature'], tags: ['en:plain-yogurts'], per: 'kg' },
  { id: 'fromage-blanc', label: 'Fromage blanc', keys: ['fromage blanc'], tags: ['en:fromages-blancs'], per: 'kg' },
  { id: 'poulet', label: 'Filets de poulet', keys: ['blanc de poulet', 'filet de poulet', 'filets de poulet', 'escalope de poulet'], tags: ['en:chicken-breasts', 'fr:filets-de-poulet'], per: 'kg' },
  { id: 'steak-hache', label: 'Steaks hachés', keys: ['steak haché', 'bœuf haché', 'viande hachée', 'haché de bœuf'], tags: ['fr:steaks-haches', 'en:ground-beef'], per: 'kg' },
  { id: 'pate-feuilletee', label: 'Pâte feuilletée', keys: ['pâte feuilletée'], tags: ['en:puff-pastries'], per: 'kg' },
  { id: 'pate-brisee', label: 'Pâte brisée', keys: ['pâte brisée'], tags: ['en:shortcrust-pastries'], per: 'kg' },
  { id: 'chocolat', label: 'Chocolat noir', keys: ['chocolat noir', 'chocolat noir pâtissier', 'chocolat pâtissier'], tags: ['en:dark-chocolates'], per: 'kg' },
];

export interface Product {
  code: string; name: string; brand: string; qty: string;
  ns: string | null; nova: number | null; labels: string[];   // labels retenus : bio, label-rouge, aop-igp
  score: number; why: string[];                                  // points de qualité et leurs raisons
  price: { cents: number; perCents: number; date: string; where: string; auchan: boolean; n: number } | null;
}
export interface Group { id: string; label: string; keys: string[]; tag: string; per: Per; products: Product[]; value: string | null; cheap: string | null; best: string | null }
export interface ProductsData { source: string; license: string; generated: string; groups: Group[] }

/* ---------- Qualité : règles fixes, affichées telles quelles ---------- */

const NS: Record<string, number> = { a: 2, b: 1, c: 0, d: -1, e: -2 };
const NOVA: Record<number, number> = { 1: 2, 2: 1, 3: 0, 4: -2 };
const NOVA_TEXT: Record<number, string> = { 1: 'NOVA 1 (brut)', 2: 'NOVA 2', 3: 'NOVA 3 (transformé)', 4: 'NOVA 4 (ultra-transformé)' };
export function quality(ns: string | null, nova: number | null, labelsTags: readonly string[]): { score: number; why: string[]; labels: string[] } {
  let score = 0; const why: string[] = [], labels: string[] = [];
  if (ns && NS[ns] !== undefined) { score += NS[ns] as number; why.push(`Nutri-Score ${ns.toUpperCase()}`); }
  if (nova && NOVA[nova] !== undefined) { score += NOVA[nova] as number; why.push(NOVA_TEXT[nova] as string); }
  if (labelsTags.includes('en:organic')) { score++; labels.push('bio'); why.push('bio'); }
  if (labelsTags.includes('fr:label-rouge')) { score++; labels.push('label-rouge'); why.push('Label Rouge'); }
  if (labelsTags.includes('en:pdo') || labelsTags.includes('en:pgi')) { score++; labels.push('aop-igp'); why.push('AOP/IGP'); }
  return { score, why, labels };
}

// Quantité d'un paquet (texte Open Food Facts : « 45 cl », « 200 g (20 cl) », « 4 x 125 g », « 6 œufs ») → g, ml ou pièces.
export function packAmount(qty: string, per: Per): number | null {
  const s = qty.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/(?:œ|oe)ufs?|pi[eè]ces?|unit[eé]s?/g, 'pièces').replace(/\s+/g, ' ').trim();
  const eggs = /^(?:x\s*)?(\d{1,2})(?:\s*pièces)?$/.exec(s);
  if (per === 'piece') return eggs ? Number(eggs[1]) : null;
  const p = parseSize(s);
  if (!p) return null;
  const b = toBase(p.size, p.unit), n = b.n / b.d;
  if (per === 'kg' && p.unit.dim === 'masse') return n;
  if (per === 'l' && p.unit.dim === 'volume') return n;
  return null;
}
// Prix à l'unité de comparaison (centimes par kg, par litre ou par pièce).
export const perUnit = (cents: number, amount: number, per: Per): number => Math.round(per === 'piece' ? cents / amount : cents * 1000 / amount);

/* ---------- Choix affichés ---------- */

// Le moins cher (prix connu), le mieux noté, et le meilleur rapport qualité-prix : chaque point de qualité justifie
// jusqu'à 20 % de prix en plus que le moins cher (à l'unité de comparaison). Valeur = points − écart de prix ÷ 20 %.
export const VALUE_POINT = 0.2;
export const valueOf = (p: Product, cheapest: number): number => p.score - ((p.price?.perCents ?? Infinity) / cheapest - 1) / VALUE_POINT;
export function picks(products: readonly Product[]): { value: string | null; cheap: string | null; best: string | null } {
  const priced = products.filter(p => p.price).sort((a, b) => (a.price?.perCents ?? 0) - (b.price?.perCents ?? 0));
  const cheap = priced[0] ?? null;
  const better = (a: Product, b: Product): number => b.score - a.score || (a.price?.perCents ?? Infinity) - (b.price?.perCents ?? Infinity);
  const best = [...products].sort(better)[0] ?? null;
  const c0 = cheap?.price?.perCents ?? 0;
  const value = cheap ? [...priced].sort((a, b) => valueOf(b, c0) - valueOf(a, c0) || (a.price?.perCents ?? 0) - (b.price?.perCents ?? 0))[0] ?? cheap : null;
  return { value: value?.code ?? null, cheap: cheap?.code ?? null, best: best?.code ?? null };
}

/* ---------- Génération (CI) ---------- */

export interface Hit { code?: unknown; product_name?: unknown; brands?: unknown; quantity?: unknown; nutriscore_grade?: unknown; nova_group?: unknown; labels_tags?: unknown }
export interface PriceRow { product_code?: unknown; price?: unknown; date?: unknown; currency?: unknown; location?: { osm_brand?: unknown; osm_name?: unknown; osm_address_country_code?: unknown } | null }
const s = (v: unknown, max = 120): string => (typeof v === 'string' ? v.trim().slice(0, max) : Array.isArray(v) && typeof v[0] === 'string' ? (v[0] as string).trim().slice(0, max) : '');

export function toProduct(h: Hit, per: Per, rows: readonly PriceRow[]): Product | null {
  const code = s(h.code, 20), name = s(h.product_name, 90), qty = s(h.quantity, 40);
  if (!/^\d{8,14}$/.test(code) || !name) return null;
  const ns = typeof h.nutriscore_grade === 'string' && /^[a-e]$/.test(h.nutriscore_grade) ? h.nutriscore_grade : null;
  const nova = typeof h.nova_group === 'number' && h.nova_group >= 1 && h.nova_group <= 4 ? h.nova_group : null;
  const q = quality(ns, nova, Array.isArray(h.labels_tags) ? h.labels_tags.filter((x): x is string => typeof x === 'string') : []);
  const amount = qty ? packAmount(qty, per) : null;
  // Relevés en France, en euros ; un magasin Auchan d'abord (le plus récent), sinon la médiane des 5 plus récents.
  const fr = rows.filter(r => r.product_code === code && r.currency === 'EUR' && typeof r.price === 'number' && r.price > 0 && typeof r.date === 'string'
    && r.location?.osm_address_country_code === 'FR').sort((a, b) => ((a.date as string) < (b.date as string) ? 1 : -1));
  const isAuchan = (r: PriceRow): boolean => /auchan/i.test(`${s(r.location?.osm_brand)} ${s(r.location?.osm_name)}`);
  const au = fr.filter(isAuchan);
  let price: Product['price'] = null;
  if (amount && fr.length) {
    const pick = au[0] ?? [...fr.slice(0, 5)].sort((a, b) => (a.price as number) - (b.price as number))[Math.floor(Math.min(fr.length, 5) / 2)] as PriceRow;
    const cents = Math.round((pick.price as number) * 100);
    price = { cents, perCents: perUnit(cents, amount, per), date: pick.date as string, where: au[0] ? 'Auchan' : (s(pick.location?.osm_brand) || s(pick.location?.osm_name) || 'autre magasin'), auchan: !!au[0], n: fr.length };
  }
  return { code, name, brand: s(h.brands, 60).split(',')[0]?.trim() ?? '', qty, ns, nova, labels: q.labels, score: q.score, why: q.why, price };
}

export function buildGroup(d: GroupDef, tag: string, hits: readonly Hit[], rows: readonly PriceRow[]): Group {
  const products = hits.map(h => toProduct(h, d.per, rows)).filter((p): p is Product => !!p);
  // Gardés : les 8 premiers (popularité Open Food Facts) plus tout produit chiffré, pour un fichier court.
  const kept = products.filter((p, i) => i < 8 || p.price).slice(0, 14);
  return { id: d.id, label: d.label, keys: [...d.keys], tag, per: d.per, products: kept, ...picks(kept) };
}

/* ---------- Lecture (app) ---------- */

export function readProducts(v: unknown): ProductsData | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o['generated'] !== 'string' || !Array.isArray(o['groups'])) return null;
  const groups = (o['groups'] as unknown[]).filter((g): g is Group => {
    if (!g || typeof g !== 'object') return false;
    const x = g as Record<string, unknown>;
    return typeof x['id'] === 'string' && typeof x['label'] === 'string' && Array.isArray(x['keys']) && Array.isArray(x['products'])
      && (x['per'] === 'kg' || x['per'] === 'l' || x['per'] === 'piece')
      && (x['products'] as unknown[]).every(p => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>)['code'] === 'string' && typeof (p as Record<string, unknown>)['name'] === 'string');
  });
  return { source: typeof o['source'] === 'string' ? o['source'] : '', license: typeof o['license'] === 'string' ? o['license'] : '', generated: o['generated'], groups };
}

let loaded: { data: ProductsData; byKey: Map<string, Group> } | null = null;
export function setProducts(d: ProductsData | null): void {
  loaded = d ? { data: d, byKey: new Map(d.groups.flatMap(g => g.keys.map(k => [nameKey(k), g] as const))) } : null;
}
export const productsData = (): ProductsData | null => loaded?.data ?? null;
export const groupFor = (name: string): Group | null => loaded?.byKey.get(nameKey(name)) ?? null;
export const productOf = (g: Group, code: string | null): Product | null => (code ? g.products.find(p => p.code === code) ?? null : null);
