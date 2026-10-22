// Module Cornelius « foyer » : lit Foyer comme un troisième téléphone, en lecture seule.
// Le relais ne voit que des blocs chiffrés ; le code du foyer reste sur le serveur Cornelius (secret).
// Aucun dépôt, aucune modification : seules des requêtes GET vers la table du relais partent.
import { AddonCollectError, type AddonDefinition, type ModuleSnapshot } from '#cornelius/addons';
import { RELAY } from '../../foyer/src/ui/config.ts';
import { relayKeys, pull, RelayError, type Fetch, type RelayKeys } from '../../foyer/src/core/relay.ts';
import type { AnyEv } from '../../foyer/src/core/model.ts';
import { validCode } from '../../foyer/src/core/sync.ts';
import { replay, openConflicts } from '../../foyer/src/core/reduce.ts';
import { deriveToday } from '../../foyer/src/core/today.ts';
import { deriveShopping, lineQty, aisleLabel } from '../../foyer/src/core/shopping.ts';
import { weekOf, addDays, parisToUtc } from '../../foyer/src/core/dates.ts';

type Vue = 'aujourdhui' | 'courses';
type FoyerConfig = Record<string, never>;
type FoyerData = {
  vue: Vue;
  jour: string;
  repas: { quand: string; plat: string | null; detail: string | null; statut: string }[];
  taches: { texte: string; faite: boolean }[];
  manque: { quand: string; articles: string[] }[];
  courses: { restant: number; lignes: { article: string; quantite: string; rayon: string }[] };
  aDecider: number;
  conflits: number;
  evenements: number;
  illisibles: number;
};

const TABLE = `${RELAY?.url ?? ''}/rest/v1/foyer_relais?`;

// Journal déjà lu, par source : chaque relevé ne demande que les blocs nouveaux, avec le même curseur
// que les téléphones. Repart de zéro si le code change ; un redémarrage de Cornelius vide tout.
type Lu = { code: string; keys: RelayKeys; cursor: number; events: Map<string, AnyEv>; unreadable: number };
const journals = new Map<string, Lu>();
const cut = (t: string, n: number): string => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);
const str = (n: number) => ({ type: 'string', minLength: 1, maxLength: n });
const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const dataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['vue', 'jour', 'repas', 'taches', 'manque', 'courses', 'aDecider', 'conflits', 'evenements', 'illisibles'],
  properties: {
    vue: { enum: ['aujourdhui', 'courses'] },
    jour: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    repas: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quand', 'plat', 'detail', 'statut'],
        properties: { quand: str(40), plat: { type: ['string', 'null'], maxLength: 120 }, detail: { type: ['string', 'null'], maxLength: 160 }, statut: str(20) },
      },
    },
    taches: {
      type: 'array',
      maxItems: 10,
      items: { type: 'object', additionalProperties: false, required: ['texte', 'faite'], properties: { texte: str(160), faite: { type: 'boolean' } } },
    },
    manque: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quand', 'articles'],
        properties: { quand: str(40), articles: { type: 'array', maxItems: 12, items: str(80) } },
      },
    },
    courses: {
      type: 'object',
      additionalProperties: false,
      required: ['restant', 'lignes'],
      properties: {
        restant: { type: 'integer', minimum: 0, maximum: 10000 },
        lignes: {
          type: 'array',
          maxItems: 40,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['article', 'quantite', 'rayon'],
            properties: { article: str(80), quantite: { type: 'string', maxLength: 40 }, rayon: str(40) },
          },
        },
      },
    },
    aDecider: { type: 'integer', minimum: 0, maximum: 100 },
    conflits: { type: 'integer', minimum: 0, maximum: 100000 },
    evenements: { type: 'integer', minimum: 0, maximum: 10000000 },
    illisibles: { type: 'integer', minimum: 0, maximum: 100000 },
  },
};

const relayError = (e: RelayError): AddonCollectError =>
  e.status === 401 || e.status === 403
    ? new AddonCollectError('auth', 'Le relais Foyer refuse la lecture.', false)
    : e.status === 404
      ? new AddonCollectError('not_found', 'Table du relais Foyer introuvable.', false)
      : e.status === 429
        ? new AddonCollectError('quota', 'Relais Foyer : trop de lectures, réessayez plus tard.', true)
        : new AddonCollectError('upstream', `Relais Foyer indisponible (HTTP ${e.status}).`, true);

// Le menu affiché change à 15 h (midi → soir) et à minuit : le relevé ne vaut pas au-delà.
function freshUntilBoundary(jour: string, hour: number, now: number): number {
  const next = hour < 15 ? parisToUtc(jour, '1500') : parisToUtc(addDays(jour, 1), '0000');
  return Math.max(5_000, Math.min(600_000, next.getTime() - now));
}

function mealValue(m: FoyerData['repas'][number]): string {
  if (m.statut === 'exterieur') return 'repas à l’extérieur';
  return !m.plat || m.statut === 'vide' ? 'rien de prévu' : m.plat;
}
const meal = (m: FoyerData['repas'][number]): string => `${m.quand} : ${mealValue(m)}`;

function presentToday(d: FoyerData) {
  const todo = d.taches.filter(t => !t.faite);
  const items = [
    ...d.repas.slice(0, 2).map(m => ({ label: m.quand, value: cut(mealValue(m), 160) })),
    ...todo.slice(0, 3).map(t => ({ label: 'À faire', value: cut(t.texte, 160) })),
  ].slice(0, 5);
  const missing = d.manque.map(m => `${m.quand} : ${m.articles.join(', ')}`).join(' · ');
  const said = [
    d.repas.length ? `${d.repas.slice(0, 2).map(meal).join('. ')}.` : 'Aucun repas prévu à la maison dans les prochains jours, d’après Foyer.',
    todo.length ? `À faire : ${todo.slice(0, 3).map(t => t.texte.toLowerCase()).join(', ')}.` : '',
    d.manque.length ? `Pas encore acheté : ${d.manque.map(m => `${m.quand.toLowerCase()}, ${m.articles.slice(0, 5).join(', ')}`).join(' ; ')}.` : '',
    d.conflits ? `${plural(d.conflits, 'changement', 'changements')} en conflit à voir dans Foyer.` : '',
  ].filter(Boolean).join(' ');
  return {
    title: 'Foyer · aujourd’hui',
    primaryValue: d.repas[0] ? cut(meal(d.repas[0]), 120) : 'Rien de prévu',
    subtitle: todo.length ? plural(todo.length, 'chose à faire', 'choses à faire') : d.aDecider ? `${plural(d.aDecider, 'repas', 'repas')} à décider cette semaine` : null,
    description: missing ? cut(`Pas encore acheté : ${missing}`, 500) : null,
    items,
    summary: cut(said, 500),
    sources: ['foyer'],
  };
}

function presentShopping(d: FoyerData) {
  const n = d.courses.restant;
  const rest = d.courses.lignes.slice(5).map(l => l.article);
  return {
    title: 'Foyer · courses',
    primaryValue: n ? `${plural(n, 'article', 'articles')} à prendre` : 'Liste de courses à jour',
    subtitle: null,
    description: rest.length ? cut(`Aussi : ${rest.join(', ')}`, 500) : null,
    items: d.courses.lignes.slice(0, 5).map(l => ({ label: cut(l.article, 80), value: cut([l.quantite, l.rayon].filter(Boolean).join(' · '), 160) })),
    summary: cut(
      n ? `Il reste ${plural(n, 'article', 'articles')} à prendre cette semaine : ${d.courses.lignes.slice(0, 8).map(l => l.article.toLowerCase()).join(', ')}.` : 'Tout est pris sur la liste de courses de la semaine.',
      500,
    ),
    sources: ['foyer'],
  };
}

const addon: AddonDefinition<FoyerConfig, FoyerData> = {
  id: 'foyer',
  apiVersion: 1,
  version: '1.0.0',
  minCoreVersion: '0.2.0',
  sourceLabel: 'Foyer (relais chiffré)',
  display: {
    name: 'Foyer',
    description: 'Les repas de ce soir et de demain midi, les tâches de la veille et les courses, lus dans Foyer en lecture seule.',
    icon: 'utensils',
    group: 'home',
    keywords: ['repas', 'menu', 'dîner', 'ce soir', 'courses', 'boîte', 'batch', 'foyer'],
    example: { label: 'Repas du foyer', ref: 'repas' },
    spoken: { head: 'le foyer', repeats: ['foyer'] },
  },
  secrets: [{ name: 'code', env: 'CORNELIUS_FOYER_CODE', label: 'un code du foyer', note: 'Foyer › Réglages › Synchro' }],
  configVersion: 1,
  configSchema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  configDefaults: {},
  dataVersion: 1,
  dataSchema,
  freshMs: 600_000,
  tools: [
    {
      name: 'read',
      description:
        'Lire Foyer, l’app des repas du foyer : ce qu’on mange ce soir et demain midi, les tâches de la veille (sortir du congélateur, préparer une boîte), ce qui n’est pas encore acheté, ou la liste de courses de la semaine (vue courses). ' +
        'Pour « on mange quoi ce soir ? », « qu’est-ce qu’il faut sortir du congélateur ? », « qu’est-ce qu’il reste à acheter ? ». Affiche la carte Foyer.',
      parameters: { type: 'object', additionalProperties: false, required: ['instanceRef'], properties: { instanceRef: { type: ['string', 'null'] } } },
      arguments: {
        vue: { type: 'string', enum: ['aujourdhui', 'courses'], description: 'aujourdhui : repas, tâches et achats manquants (par défaut) ; courses : liste de la semaine.' },
      },
    },
  ],
  async collect(context) {
    if (!RELAY) throw new AddonCollectError('config_invalid', 'Foyer n’a pas de relais configuré.', false);
    const code = context.secret('code');
    if (!code) throw new AddonCollectError('config_invalid', 'Code du foyer manquant : saisissez-le dans Mise en route › Clés et jetons.', false);
    if (!validCode(code)) throw new AddonCollectError('config_invalid', 'Code du foyer invalide : 12 lettres et chiffres, tel qu’affiché dans Foyer › Réglages.', false);
    let lu = journals.get(context.instance.id);
    if (lu?.code !== code) {
      lu = { code, keys: await relayKeys(code), cursor: 0, events: new Map(), unreadable: 0 };
      journals.set(context.instance.id, lu);
    }
    // Lecture seule : tout ce qui n'est pas un GET de la table du relais est refusé avant de partir.
    const get: Fetch = async (url, init) => {
      if ((init?.method ?? 'GET') !== 'GET' || !url.startsWith(TABLE))
        throw new AddonCollectError('forbidden', 'Ce module lit Foyer sans jamais y écrire.', false);
      const r = await context.http.fetch({ url, headers: init?.headers ?? {}, signal: context.signal, timeoutMs: 8_000, maxBytes: 4 * 1024 * 1024 });
      if (r.truncated) throw new AddonCollectError('malformed', 'Relais Foyer : réponse incomplète.', true);
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => {
          try { return r.json(); } catch { throw new AddonCollectError('malformed', 'Relais Foyer : réponse illisible.', true); }
        },
      };
    };
    try {
      // pull s'arrête à 50 pages de 200 blocs : relancé tant que le curseur avance, sinon au-delà de
      // 10 000 blocs seuls les plus anciens seraient lus, et un vieux menu dit comme celui du jour.
      for (;;) {
        const got = await pull(RELAY, lu.keys, lu.cursor, get);
        for (const e of got.events) lu.events.set(e.id, e);
        lu.unreadable += got.unreadable;
        if (got.cursor === lu.cursor) break;
        lu.cursor = got.cursor;
      }
    } catch (e) {
      throw e instanceof RelayError ? relayError(e) : e;
    }
    // Rien de lisible : mauvais code ou foyer sans synchro. Jamais présenté comme « rien de prévu ».
    if (!lu.events.size) {
      throw lu.unreadable
        ? new AddonCollectError('auth', 'Relais Foyer : aucun bloc lisible avec ce code.', false)
        : new AddonCollectError('not_found', 'Aucune donnée Foyer pour ce code : vérifiez le code et la synchro automatique des téléphones.', false);
    }
    const now = context.now();
    const r = replay(lu.events.values());
    const s = r.state;
    const today = deriveToday(r, new Date(now));
    const list = deriveShopping(s, weekOf(today.date, s.settings.weekStart));
    const lignes = [
      ...list.lines.filter(l => !l.done).map(l => ({ article: cut(l.name, 80), quantite: cut(lineQty(l), 40), rayon: cut(aisleLabel(l.aisle), 40) })),
      ...list.manual.filter(m => !m.checked).map(m => ({ article: cut(m.name, 80), quantite: cut(m.qty, 40), rayon: cut(aisleLabel(m.aisle), 40) })),
    ];
    const vue: Vue = context.args?.['vue'] === 'courses' ? 'courses' : 'aujourdhui';
    const data: FoyerData = {
      vue,
      jour: today.date,
      repas: today.cards.slice(0, 4).map(c => ({
        quand: cut(c.label, 40),
        plat: c.view.status === 'vide' || c.view.status === 'personne' ? null : cut(c.view.title, 120) || null,
        detail: c.detail ? cut(c.detail, 160) : null,
        statut: c.view.status,
      })),
      taches: today.tasks.slice(0, 10).map(t => ({ texte: cut(t.text, 160), faite: t.done })),
      manque: today.toBuy.slice(0, 4).map(b => ({ quand: cut(b.label, 40), articles: b.names.slice(0, 12).map(n => cut(n, 80)) })),
      courses: { restant: lignes.length, lignes: lignes.slice(0, 40) },
      aDecider: Math.min(today.empty, 100),
      conflits: openConflicts(r).length,
      evenements: r.count,
      illisibles: Math.min(lu.unreadable, 100_000),
    };
    return { data, source: { provider: 'foyer-relais', sourceId: 'repas' }, freshMs: freshUntilBoundary(today.date, today.hour, now) };
  },
  present(snapshot: ModuleSnapshot<FoyerData>) {
    const d = snapshot.data;
    if (!d) throw new Error('Aucun relevé Foyer à présenter.');
    return d.vue === 'courses' ? presentShopping(d) : presentToday(d);
  },
  ambient: {
    present(snapshot: ModuleSnapshot<FoyerData>) {
      const d = snapshot.data;
      if (!d) throw new Error('Aucun relevé Foyer à afficher.');
      const todo = d.taches.find(t => !t.faite);
      return {
        layout: 'list' as const,
        title: 'Foyer',
        value: null,
        subtitle: d.aDecider ? `${plural(d.aDecider, 'repas', 'repas')} à décider cette semaine` : null,
        items: [
          ...d.repas.slice(0, 2).map(m => ({ label: m.quand, value: cut(mealValue(m), 160) })),
          ...(todo ? [{ label: 'À faire', value: cut(todo.texte, 160) }] : []),
        ].slice(0, 3),
      };
    },
  },
};

export default addon;
