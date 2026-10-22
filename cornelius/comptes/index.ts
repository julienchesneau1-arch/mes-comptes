// Module Cornelius « comptes » : le résumé chiffré produit par Mes Comptes (Réglages › « Résumé pour Cornelius »),
// collé dans la source. Aucun réseau : Mes Comptes reste sans serveur. Source personnelle obligatoire.
import { createRequire } from 'node:module';
import { AddonCollectError, type AddonDefinition, type AddonPresentContext, type ModuleSnapshot } from '#cornelius/addons';

type Summary = {
  who: string; month: string; at: string;
  income: number; spent: number; saved: number; rest: number;
  pace: { day: number; spent: number; usual: number } | null;
  budgets: { name: string; limit: number; spent: number }[];
  top: { name: string; spent: number }[];
  pots: { name: string; target: number; saved: number }[];
};
type ComptesConfig = { resume: string };
type ComptesData = Summary;
type Opened = Summary & { v: 1; app: 'mescomptes' };

// Le déchiffrement et la validation sont ceux de Mes Comptes lui-même (core.js, testé par node test.js).
const core = createRequire(import.meta.url)('../../core.js') as { openSummary(text: string, code: string): Promise<Opened> };

const M = 1_000_000_000;
const int = (min: number) => ({ type: 'integer', minimum: min, maximum: M });
const name = { type: 'string', minLength: 1, maxLength: 60 };
const dataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['who', 'month', 'at', 'income', 'spent', 'saved', 'rest', 'pace', 'budgets', 'top', 'pots'],
  properties: {
    who: { type: 'string', minLength: 1, maxLength: 40 },
    month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
    at: { type: 'string', minLength: 1, maxLength: 40 },
    income: int(-M), spent: int(-M), saved: int(-M), rest: int(-M),
    pace: {
      anyOf: [
        { type: 'null' },
        { type: 'object', additionalProperties: false, required: ['day', 'spent', 'usual'], properties: { day: { type: 'integer', minimum: 1, maximum: 31 }, spent: int(-M), usual: int(-M) } },
      ],
    },
    budgets: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['name', 'limit', 'spent'], properties: { name, limit: int(1), spent: int(0) } } },
    top: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['name', 'spent'], properties: { name, spent: int(0) } } },
    pots: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['name', 'target', 'saved'], properties: { name, target: int(0), saved: int(-M) } } },
  },
};

const cut = (t: string, n: number): string => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);
const eur = (n: number): string => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} €`;
const monthName = (m: string): string =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`));
const ofMonth = (m: string): string => (/^[aeiouéâ]/i.test(m) ? `d’${m}` : `de ${m}`); // d’avril, d’août, d’octobre
const dayName = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone }).format(new Date(iso));
const monthOf = (ms: number, timeZone: string): string => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone }).formatToParts(ms).map(x => [x.type, x.value]));
  return `${p['year']}-${p['month']}`;
};

function present(snapshot: ModuleSnapshot<ComptesData>, context: AddonPresentContext) {
  const d = snapshot.data;
  if (!d) throw new Error('Aucun résumé Mes Comptes à présenter.');
  const now = context.now();
  const old = Math.floor((now - Date.parse(d.at)) / 864e5);
  const otherMonth = d.month !== monthOf(now, context.timeZone);
  const rest = d.rest >= 0 ? `Reste ${eur(d.rest)}` : `Dépassement de ${eur(-d.rest)}`;
  const over = d.budgets.filter(b => b.spent > b.limit);
  const items = [
    ...d.budgets.slice(0, 3).map(b => ({ label: cut(b.name, 80), value: `${eur(b.spent)} sur ${eur(b.limit)}${b.spent > b.limit ? ' · dépassé' : ''}` })),
    ...d.pots.slice(0, 2).map(p => ({ label: cut(p.name, 80), value: `${eur(p.saved)} sur ${eur(p.target)}` })),
    ...(d.pace ? [{ label: `Au ${d.pace.day} du mois`, value: `${eur(d.pace.spent)} dépensés, ${eur(d.pace.usual)} d’habitude` }] : []),
  ].slice(0, 5);
  const said = [
    `${otherMonth ? `Résumé ${ofMonth(monthName(d.month))}, pas du mois en cours` : `En ${monthName(d.month)}`}, d’après Mes Comptes au ${dayName(d.at, context.timeZone)} : ${rest.toLowerCase()} une fois les dépenses et l’épargne comptées.`,
    d.pace ? `Au ${d.pace.day}, ${eur(d.pace.spent)} dépensés contre ${eur(d.pace.usual)} d’habitude.` : '',
    over.length ? `Budget dépassé : ${over.map(b => `${b.name.toLowerCase()} (${eur(b.spent)} sur ${eur(b.limit)})`).join(', ')}.` : d.budgets.length ? 'Aucun budget dépassé.' : '',
    d.pots.length ? `Objectifs : ${d.pots.map(p => `${p.name}, ${eur(p.saved)} sur ${eur(p.target)}`).join(' ; ')}.` : '',
    old > 7 ? `Ce résumé date de ${old} jours : refaites-le dans Mes Comptes pour des chiffres à jour.` : '',
  ].filter(Boolean).join(' ');
  return {
    title: cut(`Mes comptes · ${monthName(d.month)}`, 80),
    primaryValue: `${rest} ce mois-ci`,
    subtitle: cut(`Résumé du ${dayName(d.at, context.timeZone)}${old > 7 ? ` · il y a ${old} jours` : ''}`, 120),
    description: d.top.length ? cut(`Plus grosses dépenses : ${d.top.map(t => `${t.name} ${eur(t.spent)}`).join(', ')}.`, 500) : null,
    items,
    summary: cut(said, 500),
    sources: ['comptes'],
  };
}

const addon: AddonDefinition<ComptesConfig, ComptesData> = {
  id: 'comptes',
  apiVersion: 1,
  version: '1.0.0',
  minCoreVersion: '0.2.0',
  sourceLabel: 'Mes Comptes (résumé chiffré)',
  display: {
    name: 'Mes comptes',
    description: 'Le reste du mois, les budgets et les objectifs d’épargne, d’après le résumé chiffré collé depuis Mes Comptes. Personnel.',
    icon: 'scroll-text',
    keywords: ['budget', 'comptes', 'reste', 'dépenses', 'épargne', 'objectif', 'argent'],
    example: { label: 'Mes comptes', ref: 'comptes' },
    spoken: { head: 'tes comptes', repeats: ['comptes'] },
  },
  secrets: [{ name: 'code', env: 'CORNELIUS_COMPTES_CODE', label: 'un code du foyer de Mes Comptes', note: 'Réglages › Sécurité' }],
  configVersion: 1,
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['resume'],
    properties: {
      resume: {
        type: 'string',
        title: 'Résumé collé depuis Mes Comptes',
        description: 'Mes Comptes › Réglages › Sauvegarde & synchro › « Résumé pour Cornelius », sur votre profil. À refaire après chaque import de relevés.',
        examples: ['cornelius:mcr1.…'],
        minLength: 10,
        maxLength: 20000,
        pattern: 'mcr1\\.[A-Za-z0-9_-]+',
      },
    },
  },
  configDefaults: { resume: '' },
  dataVersion: 1,
  dataSchema,
  freshMs: 86_400_000,
  tools: [
    {
      name: 'read',
      description:
        'Lire le résumé de Mes Comptes de la personne reconnue : reste du mois, dépenses par rapport à d’habitude, budgets et objectifs d’épargne. ' +
        'Pour « il me reste combien ce mois-ci ? », « où en est mon budget restaurants ? », « où en est mon objectif ? ». Affiche la carte Mes comptes.',
      parameters: { type: 'object', additionalProperties: false, required: ['instanceRef'], properties: { instanceRef: { type: ['string', 'null'] } } },
    },
  ],
  async collect(context) {
    // Des chiffres personnels ne s'affichent jamais au nom du foyer (miroir partagé, tablette familiale).
    if (context.instance.profileId === null)
      throw new AddonCollectError('config_invalid', 'Source personnelle obligatoire : choisissez une personne comme propriétaire, jamais le foyer.', false);
    const code = context.secret('code');
    if (!code) throw new AddonCollectError('config_invalid', 'Code du foyer de Mes Comptes manquant : saisissez-le dans Mise en route › Clés et jetons.', false);
    let s: Opened;
    try {
      s = await core.openSummary(context.config.resume, code);
    } catch (e) {
      const x = e as { needCode?: boolean; notSummary?: boolean; bad?: boolean };
      if (x.needCode) throw new AddonCollectError('auth', 'Résumé illisible avec ce code du foyer : vérifiez le code dans Mes Comptes › Réglages › Sécurité.', false);
      if (x.notSummary) throw new AddonCollectError('config_invalid', 'Ce n’est pas un résumé Mes Comptes : refaites « Résumé pour Cornelius ».', false);
      throw new AddonCollectError('malformed', 'Résumé Mes Comptes abîmé : recopiez-le en entier.', false);
    }
    const { v: _v, app: _app, ...data } = s;
    return { data, observedAt: Date.parse(s.at), source: { provider: 'mes-comptes', sourceId: s.who } };
  },
  present,
};

export default addon;
