// Mode essentiel : Aujourd'hui, Semaine, Courses et vos plats d'abord. Les fonctions avancées n'apparaissent que si le foyer
// s'en sert déjà (rituel réglé, budget fixé, agenda branché, facture lue) ou si ce téléphone les a activées (Réglages ›
// Fonctions) ; un choix explicite l'emporte. Rien n'est effacé en les masquant : les données et les rappels restent.
import type { State } from './model.ts';

export const MODS = ['batch', 'budget', 'agenda', 'factures', 'placard'] as const;
export type Mod = typeof MODS[number];
export type ModChoices = Partial<Record<Mod, boolean>>;
export const MOD_TEXT: Record<Mod, { label: string; what: string }> = {
  batch: { label: 'Rituel batch', what: 'Courses et cuisine groupées un jour fixe, séance guidée, boîtes de la semaine.' },
  budget: { label: 'Budget et bilan', what: 'Budget de la semaine, panier estimé, montant payé, bilan des dépenses.' },
  agenda: { label: 'Agendas', what: 'Vos agendas Google, iCloud ou Outlook ajustent les repas du mois.' },
  factures: { label: 'Factures du drive', what: 'Lire la facture Auchan : prix réellement payés et montant noté.' },
  placard: { label: 'Déjà au placard ?', what: 'Le reste d\'un paquet de la semaine passée, proposé quand la liste en redemande.' },
};

export function inUse(s: State, m: Mod): boolean {
  switch (m) {
    case 'batch': return !!s.settings.ritual;
    case 'budget': return s.settings.budget != null || Object.values(s.shop).some(w => !!w.spent);
    case 'agenda': return Object.keys(s.agenda.cals).length > 0;
    case 'factures': return Object.keys(s.paid).length > 0;
    case 'placard': return false;
  }
}
export const shown = (s: State, choices: ModChoices, m: Mod): boolean => choices[m] ?? inUse(s, m);
export const readChoices = (x: unknown): ModChoices => {
  const out: ModChoices = {};
  if (typeof x === 'object' && x !== null) for (const m of MODS) { const v = (x as Record<string, unknown>)[m]; if (typeof v === 'boolean') out[m] = v; }
  return out;
};
