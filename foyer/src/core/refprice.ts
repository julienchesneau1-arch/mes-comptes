// Prix de référence automatiques, sans rien saisir : prix moyens de vente au détail en métropole publiés chaque mois par l'Insee
// (« Source : Insee », licence ouverte). C'est une estimation de marché, jamais le prix d'Auchan, et un ingrédient sans
// série correspondante reste « non chiffré » : rien n'est deviné.
// - Produits d'épicerie dont l'Insee a arrêté le relevé fin 2019 : dernier prix publié × évolution de l'indice des prix
//   de leur famille (même source), méthode affichée comme « actualisé ».
// - Légumes et fruits comptés à la pièce : poids moyen d'une pièce « moyenne » d'après USDA FoodData Central (domaine public).
// Le fichier prix.json est régénéré chaque mois par la CI (scripts/prix.mjs) ; l'app le lit tel quel.
import type { Q } from './rational.ts';
import { nameKey } from './text.ts';

export type Per = 'kg' | 'l' | 'piece';
export interface RefDef {
  id: string; label: string; keys: readonly string[];
  series: string; expect: string;            // identifiant Insee ; mot attendu dans le titre (garde-fou contre une erreur d'identifiant)
  index?: string;                            // série arrêtée : indice des prix de la famille pour l'actualiser
  pieceG?: number; fdc?: number;             // poids d'une pièce moyenne (g) et sa fiche USDA
}

// Correspondances : un nom d'ingrédient (normalisé : singulier, sans accent) → une série. Correspondance exacte seulement.
export const REF_DEFS: readonly RefDef[] = [
  { id: 'tomate', label: 'Tomates', keys: ['tomate', 'tomate bien mure', 'tomate mure'], series: '000641429', expect: 'Tomates', pieceG: 123, fdc: 170457 },
  { id: 'poireau', label: 'Poireaux', keys: ['poireau'], series: '000641428', expect: 'Poireaux' },
  { id: 'oignon', label: 'Oignons', keys: ['oignon', 'oignon jaune'], series: '000641427', expect: 'Oignons', pieceG: 110, fdc: 170000 },
  { id: 'carotte', label: 'Carottes', keys: ['carotte'], series: '000641422', expect: 'Carottes', pieceG: 61, fdc: 170393 },
  { id: 'haricot-vert', label: 'Haricots verts', keys: ['haricot vert', 'haricots verts frais'], series: '000641359', expect: 'Haricots verts' },
  { id: 'champignon', label: 'Champignons de Paris', keys: ['champignon', 'champignon de paris'], series: '000641423', expect: 'Champignons de Paris', pieceG: 18, fdc: 169251 },
  { id: 'poivron', label: 'Poivrons', keys: ['poivron', 'poivron rouge', 'poivron vert', 'poivron jaune'], series: '010596274', expect: 'Poivrons', pieceG: 119, fdc: 170108 },
  { id: 'courgette', label: 'Courgettes', keys: ['courgette'], series: '000641425', expect: 'Courgettes', pieceG: 196, fdc: 169291 },
  { id: 'endive', label: 'Endives', keys: ['endive'], series: '000641426', expect: 'Endives' },
  { id: 'pomme-de-terre', label: 'Pommes de terre de conservation', keys: ['pomme de terre', 'pomme de terre a chair ferme', 'pomme de terre farineuse'], series: '000641360', expect: 'Pommes de terre de conservation', pieceG: 213, fdc: 170026 },
  { id: 'pomme-de-terre-nouvelle', label: 'Pommes de terre nouvelles', keys: ['pomme de terre nouvelle'], series: '000641430', expect: 'Pommes de terre nouvelles' },
  { id: 'chou-fleur', label: 'Chou-fleur', keys: ['chou-fleur', 'chou fleur'], series: '001791254', expect: 'Chou-fleur' },
  { id: 'artichaut', label: 'Artichauts', keys: ['artichaut'], series: '001791256', expect: 'Artichauts' },
  { id: 'avocat', label: 'Avocat', keys: ['avocat'], series: '001791255', expect: 'Avocat' },
  { id: 'kiwi', label: 'Kiwi', keys: ['kiwi'], series: '001791257', expect: 'Kiwi' },
  { id: 'pamplemousse', label: 'Pamplemousses roses', keys: ['pamplemousse', 'pamplemousse rose'], series: '010536481', expect: 'Pamplemousses' },
  { id: 'pomme', label: 'Pommes', keys: ['pomme'], series: '000641367', expect: 'Pommes (1 kg)', pieceG: 182, fdc: 171688 },
  { id: 'poire', label: 'Poires', keys: ['poire'], series: '000641369', expect: 'Poires', pieceG: 178, fdc: 169118 },
  { id: 'banane', label: 'Bananes', keys: ['banane'], series: '000641432', expect: 'Bananes' },
  { id: 'orange', label: 'Oranges', keys: ['orange'], series: '000641365', expect: 'Oranges' },
  { id: 'citron', label: 'Citrons', keys: ['citron', 'citron jaune'], series: '000641434', expect: 'Citrons' },
  { id: 'clementine', label: 'Clémentines', keys: ['clementine'], series: '000641435', expect: 'Clémentines' },
  { id: 'rumsteck', label: 'Bœuf : rumsteck', keys: ['rumsteck', 'rumsteak', 'romsteck'], series: '000442434', expect: 'rumsteack' },
  { id: 'faux-filet', label: 'Bœuf : faux-filet', keys: ['faux-filet', 'faux filet'], series: '000442433', expect: 'faux filet' },
  { id: 'entrecote', label: 'Bœuf : entrecôte', keys: ['entrecote'], series: '000442435', expect: 'entrecôte' },
  { id: 'bavette', label: 'Bœuf : bifteck dans la bavette', keys: ['bavette', 'bifteck', 'steak'], series: '000442436', expect: 'bavette' },
  { id: 'filet-boeuf', label: 'Bœuf : filet', keys: ['filet de boeuf'], series: '000442432', expect: 'Boeuf : filet' },
  { id: 'cote-boeuf', label: 'Bœuf : côte avec os', keys: ['cote de boeuf'], series: '000442437', expect: 'côte avec os' },
  { id: 'veau', label: 'Veau : escalope', keys: ['escalope de veau'], series: '000442441', expect: 'escalope' },
  { id: 'echine', label: 'Porc : échine avec os', keys: ['echine de porc', 'echine'], series: '000442450', expect: 'échine' },
  { id: 'roti-porc', label: 'Porc : rôti dans le filet', keys: ['roti de porc'], series: '000442448', expect: 'rôti dans le filet' },
  { id: 'lapin', label: 'Lapin entier', keys: ['lapin'], series: '000442453', expect: 'Lapin entier' },
  { id: 'foie-veau', label: 'Foie de veau', keys: ['foie de veau'], series: '000442454', expect: 'Foie de veau' },
  { id: 'jambon', label: 'Jambon supérieur', keys: ['jambon', 'jambon blanc', 'jambon de paris', 'jambon cuit'], series: '000849397', expect: 'Jambon supérieur' },
  { id: 'merlan', label: 'Filet de merlan', keys: ['merlan', 'filet de merlan'], series: '000641408', expect: 'merlan' },
  { id: 'sole', label: 'Soles', keys: ['sole'], series: '000641413', expect: 'Soles' },
  { id: 'lotte', label: 'Baudroie (lotte) en tranche', keys: ['lotte', 'baudroie'], series: '000641405', expect: 'lotte' },
  { id: 'moule', label: 'Moules de bouchot', keys: ['moule', 'moule de bouchot'], series: '000641418', expect: 'Moules' },
  { id: 'crevette-grise', label: 'Crevettes grises', keys: ['crevette grise'], series: '000641417', expect: 'Crevettes grises' },
  { id: 'crevette', label: 'Crevettes roses tropicales', keys: ['crevette', 'crevette rose', 'gamba'], series: '000641354', expect: 'Crevettes roses' },
  { id: 'baguette', label: 'Pain baguette', keys: ['baguette', 'pain'], series: '000442423', expect: 'baguette' },
  // Relevés arrêtés fin 2019 (2020 pour le thon) : actualisés par l'indice des prix de leur famille.
  { id: 'camembert', label: 'Camembert', keys: ['camembert'], series: '000442484', expect: 'Camembert', index: '011814885' },
  { id: 'steak-hache', label: 'Steaks hachés', keys: ['steak hache', 'boeuf hache', 'viande hachee', 'viande de boeuf hachee', 'hache de boeuf'], series: '000849396', expect: 'Steaks hachés', index: '011814755' },
  { id: 'beurre', label: 'Beurre', keys: ['beurre', 'beurre doux', 'beurre demi-sel'], series: '000442490', expect: 'Beurre', index: '011814941' },
  { id: 'huile-olive', label: 'Huile d\'olive vierge extra', keys: ['huile d\'olive', 'huile d\'olive vierge extra'], series: '000442491', expect: 'olive', index: '011814930' },
  { id: 'huile', label: 'Huile de tournesol', keys: ['huile', 'huile de tournesol', 'huile vegetale', 'huile neutre'], series: '000442493', expect: 'tournesol', index: '011814930' },
  { id: 'emmental', label: 'Emmental', keys: ['emmental', 'emmental rape', 'fromage rape'], series: '000442487', expect: 'Emmental', index: '011814885' },
  { id: 'pates', label: 'Pâtes', keys: ['pate', 'pate seche', 'spaghetti', 'penne', 'tagliatelle', 'fusilli', 'coquillette', 'macaroni', 'farfalle', 'linguine', 'rigatoni'], series: '000442429', expect: 'Pâtes', index: '011814732' },
  { id: 'lait-entier', label: 'Lait entier', keys: ['lait entier'], series: '000442479', expect: 'Lait pasteurisé entier', index: '011814851' },
  { id: 'lait', label: 'Lait demi-écrémé', keys: ['lait', 'lait demi-ecreme'], series: '000442480', expect: 'demi-écrémé', index: '011814858' },
  { id: 'sucre', label: 'Sucre', keys: ['sucre', 'sucre en poudre', 'sucre semoule'], series: '000442544', expect: 'Sucre', index: '011815116' },
  { id: 'yaourt', label: 'Yaourt nature', keys: ['yaourt', 'yaourt nature'], series: '000849398', expect: 'Yaourt nature', index: '011814901' },
  { id: 'thon', label: 'Thon au naturel en boîte', keys: ['thon', 'thon au naturel', 'thon en boite'], series: '000442470', expect: 'Thon', index: '011814826' },
];

export interface Ref {
  id: string; label: string; keys: string[]; per: Per;
  cents: number;                              // par kg, par litre ou par pièce
  period: string; series: string;
  method: 'mesuré' | 'actualisé';
  base?: { period: string; cents: number; index: string };
  pieceG?: number; fdc?: number;
}
export interface RefPrices {
  source: string; sourceUrl: string; license: string; weights: string; weightsUrl: string;
  generated: string; period: string; refs: Ref[];
}

/* ---------- Génération (CI) : lecture SDMX de la Banque de données macro-économiques ---------- */

export interface Series { title: string; obs: [string, number][] }
// Réponse SDMX « structure specific » : une balise Series par identifiant, des Obs datées. Valeurs non numériques ignorées.
export function parseSdmx(xml: string): Map<string, Series> {
  const out = new Map<string, Series>();
  const attr = (s: string, k: string): string => new RegExp(`\\b${k}="([^"]*)"`).exec(s)?.[1] ?? '';
  for (const m of xml.matchAll(/<Series\b([^>]*)>([\s\S]*?)<\/Series>/g)) {
    const head = m[1] ?? '', id = attr(head, 'IDBANK');
    const obs: [string, number][] = [];
    for (const o of (m[2] ?? '').matchAll(/<Obs\b([^>]*)\/>/g)) {
      const t = attr(o[1] ?? '', 'TIME_PERIOD'), v = Number(attr(o[1] ?? '', 'OBS_VALUE'));
      if (/^\d{4}-\d{2}$/.test(t) && Number.isFinite(v) && v > 0) obs.push([t, v]);
    }
    obs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (id) out.set(id, { title: attr(head, 'TITLE_FR').replace(/&apos;/g, '\'').replace(/&amp;/g, '&'), obs });
  }
  return out;
}

// Unité du titre Insee : « (1 kg) », « (250 g) », « (1 litre) », « (pièce) ».
export function titleUnit(title: string): { per: Per; size: number } | null {
  if (/\(pièce\)/.test(title)) return { per: 'piece', size: 1 };
  const m = /\((\d+(?:[.,]\d+)?)\s*(kg|g|litre|l)\)/.exec(title);
  if (!m) return null;
  const n = Number((m[1] ?? '').replace(',', '.'));
  return m[2] === 'kg' ? { per: 'kg', size: n } : m[2] === 'g' ? { per: 'kg', size: n / 1000 } : { per: 'l', size: n };
}

export function buildRefPrices(pricesXml: string, indicesXml: string, generated: string): { data: RefPrices; problems: string[] } {
  const prices = parseSdmx(pricesXml), indices = parseSdmx(indicesXml), problems: string[] = [], refs: Ref[] = [];
  for (const d of REF_DEFS) {
    const s = prices.get(d.series), last = s?.obs[s.obs.length - 1];
    if (!s || !last) { problems.push(`${d.id} : série ${d.series} absente ou vide`); continue; }
    if (!s.title.includes(d.expect)) { problems.push(`${d.id} : titre inattendu « ${s.title} »`); continue; }
    const u = titleUnit(s.title);
    if (!u) { problems.push(`${d.id} : unité illisible dans « ${s.title} »`); continue; }
    const pack = Math.round(last[1] * 100);                       // prix publié, en centimes, pour la quantité du titre
    const common = { id: d.id, label: d.label, keys: [...d.keys], per: u.per, series: d.series, ...(d.pieceG ? { pieceG: d.pieceG, fdc: d.fdc as number } : {}) };
    if (!d.index) { refs.push({ ...common, cents: Math.round(pack / u.size), period: last[0], method: 'mesuré' }); continue; }
    const ix = indices.get(d.index), now = ix?.obs[ix.obs.length - 1], then = ix?.obs.find(o => o[0] === last[0]);
    if (!now || !then) { problems.push(`${d.id} : indice ${d.index} sans valeur pour ${last[0]}`); continue; }
    refs.push({ ...common, cents: Math.round(pack * (now[1] / then[1]) / u.size), period: now[0], method: 'actualisé',
      base: { period: last[0], cents: Math.round(pack / u.size), index: d.index } });
  }
  const period = refs.filter(r => r.method === 'mesuré').map(r => r.period).sort().pop() ?? '';
  return {
    data: {
      source: 'Insee, prix moyens de vente au détail en métropole', sourceUrl: 'https://www.insee.fr/fr/statistiques/series/103157792',
      license: 'Licence ouverte, « Source : Insee »', weights: 'USDA FoodData Central (SR Legacy), domaine public', weightsUrl: 'https://fdc.nal.usda.gov/',
      generated, period, refs,
    },
    problems,
  };
}

/* ---------- Lecture (app) ---------- */

const isStr = (v: unknown): v is string => typeof v === 'string';
const isPos = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1_000_000;
export function readRefPrices(v: unknown): RefPrices | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o['source']) || !isStr(o['period']) || !isStr(o['generated']) || !Array.isArray(o['refs'])) return null;
  const refs = (o['refs'] as unknown[]).filter((r): r is Ref => {
    if (!r || typeof r !== 'object') return false;
    const x = r as Record<string, unknown>;
    return isStr(x['id']) && isStr(x['label']) && Array.isArray(x['keys']) && (x['keys'] as unknown[]).every(isStr)
      && (x['per'] === 'kg' || x['per'] === 'l' || x['per'] === 'piece') && isPos(x['cents']) && isStr(x['period'])
      && (x['pieceG'] === undefined || isPos(x['pieceG']));
  });
  return { source: o['source'], sourceUrl: isStr(o['sourceUrl']) ? o['sourceUrl'] : '', license: isStr(o['license']) ? o['license'] : '',
    weights: isStr(o['weights']) ? o['weights'] : '', weightsUrl: isStr(o['weightsUrl']) ? o['weightsUrl'] : '', generated: o['generated'], period: o['period'], refs };
}

// Table chargée par l'interface au démarrage ; null tant qu'elle ne l'est pas (les montants attendent, rien n'est inventé).
let loaded: { data: RefPrices; byKey: Map<string, Ref> } | null = null;
export function setRefPrices(rp: RefPrices | null): void {
  loaded = rp ? { data: rp, byKey: new Map(rp.refs.flatMap(r => r.keys.map(k => [nameKey(k), r] as const))) } : null;
}
export const refPrices = (): RefPrices | null => loaded?.data ?? null;
export const refFor = (name: string): Ref | null => loaded?.byKey.get(nameKey(name)) ?? null;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const monthText = (period: string): string => { const [y, m] = period.split('-'); return `${MONTHS[Number(m) - 1] ?? ''} ${y ?? ''}`.trim(); };

// Coût de référence d'une quantité (unité de base : g, ml ou pièce). null si l'unité ne se convertit pas sans deviner.
export function refCost(ref: Pick<Ref, 'per' | 'cents' | 'pieceG'>, dim: string | null, qty: Q | null): number | null {
  if (!qty || !dim || qty.n <= 0) return null;
  const x = qty.n / qty.d;
  if (ref.per === 'kg' && dim === 'masse') return Math.round(ref.cents * x / 1000);
  if (ref.per === 'l' && dim === 'volume') return Math.round(ref.cents * x / 1000);
  if (ref.per === 'piece' && dim === 'piece') return ref.cents * Math.ceil(x);
  if (ref.per === 'kg' && dim === 'piece' && ref.pieceG) return Math.round(ref.cents * Math.ceil(x) * ref.pieceG / 1000);
  return null;
}
export const perText = (ref: Pick<Ref, 'per'>): string => (ref.per === 'kg' ? 'le kg' : ref.per === 'l' ? 'le litre' : 'la pièce');
