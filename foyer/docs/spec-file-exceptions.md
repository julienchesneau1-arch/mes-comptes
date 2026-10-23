# SPEC — File d'exceptions unifiée (module « Décisions par défaut »)
> Foyer + Mes Comptes · prêt à donner à Claude Code · version 1.0

## 1. Mission

Réduire la charge mentale à sa forme minimum : **l'utilisateur ne voit jamais une tâche, il ne voit que des exceptions**.
Toute situation récurrente est traitée par une règle par défaut décidée une fois. L'écran n'affiche que ce qu'aucune règle
n'a pu trancher, avec une action à un tap. Métrique de succès : **< 1 exception/jour en moyenne sur le foyer**.

## 2. Principe fondateur (à graver dans CLAUDE.md)

> L'UI propose, le reducer dispose. Une règle par défaut n'est jamais du code dans l'interface : c'est un **état**
> (`s.defaults`) modifié par des événements, rejoué déterministement, annulable, synchronisé vers les deux téléphones.
> Une exception n'est jamais une donnée en plus : c'est une **fonction pure** calculée à partir de l'état (`exceptions(s)`).

Conséquences : zéro événement « exception créée/supprimée ». Si l'état change (un reste est placé, un relevé importé),
les exceptions se recalculent toutes seules. Pas de file à « vider » : elle se vide quand l'état devient cohérent.

## 3. Modèle de données

```js
// Nouveau sous-état, créé par household.init ou migré à vide
s.defaults = {
  leftovers: 'auto',          // 'auto' | 'suggest' | 'manual'   → règle restes
  smallExpense: 20,           // montant max auto-classé (EUR)
  expenseDefault: 'speaker',  // 'speaker' | compteId             → compte par défaut des saisies rapides
  choreRotation: true,        // rotation automatique des corvées (v2)
  overrides: {},              // clé → décision mémorisée (voir §6)
}
```

Aucun schéma de persistance supplémentaire : c'est du rejeu d'événements, comme tout le reste.

## 4. Nouveaux événements (reduce.js)

```js
case 'defaults.set': {
  const d = s.defaults, p = e.p;
  if (p.leftovers !== undefined && !['auto','suggest','manual'].includes(p.leftovers)) conflict('valeur invalide');
  if (p.smallExpense !== undefined && (typeof p.smallExpense !== 'number' || p.smallExpense < 0)) conflict('montant invalide');
  if (p.expenseDefault !== undefined && p.expenseDefault !== 'speaker'
      && !Object.keys(s.accounts).includes(p.expenseDefault)) conflict('compte inconnu');
  Object.assign(d, structuredClone(p));
  if (JSON.stringify(p) === '{}') noop('aucun changement');
  return;
}
```

Invariant : `defaults.set` ne touche jamais aux créneaux/comptes → pas de `invalidate(s)` nécessaire.

## 5. Moteur d'exceptions — fonction pure `exceptions(s, ctx)`

Calculée à chaque rendu. Jamais cachée plus de 24 h par personne (`s.snooze[déjà existant]`, clé `exc|<code>`).

### 5.1 Source Foyer (priorité décroissante)

| code | condition | carte affichée | action 1 tap |
|---|---|---|---|
| `restes-placer` | portions libres > 0 ET aucun créneau `kind:'from'` réservé ET defaults.leftovers != 'manual' | « 2 portions de X en attente — placer où ? » (3 prochains créneaux libres en chips) | `slot.from` sur le créneau tapé |
| `restes-autopose` | idem ET defaults.leftovers === 'auto' ET un créneau naturel libre (prochain déjeuner, présence >= 1) | rien — **le créneau est déjà rempli par défaut** ; carte réversible « Restes de X posés demain midi — annuler » | undo (`slot.clear`) |
| `cook-confirmer` | `prep.status === 'started'` ET batch prévu aujourd'hui | « Préparer X ce soir ? » | `prep.done` (yield par défaut = planned) |
| `batch-bloque` | `prep.batch` après le créneau du plat (impossible — règle métier existante) | « Le batch de X est après son repas » | `prep.batch` (jour corrigé) |
| `presence-trou` | créneau avec plat ET aucun membre présent ET pas d'invités | « Personne à la maison jeudi soir, mais X est prévu » | choix : déplacer / extérieur / invités |

### 5.2 Source Mes Comptes (fusion dans `actionList`, jamais deux files)

| code | condition | carte | action |
|---|---|---|---|
| `releve-vieux` | dernière opération réelle > 7 jours | existe déjà dans actionList — garder tel quel | import |
| `prevu-echu` | transaction prévue avec date passée de > 2 jours, non rapprochée | « Le loyer du 5 n'apparaît pas — il est passé ? » | confirmer / déplacer / supprimer |
| `depense-perso-commune` | dépense > smallExpense sur compte perso de A, catégorie commune (courses, loyer…) | « 84 EUR de courses sur le compte de Léa — mettre en commun ? » | `tx.set` owner='commun' |
| `compte-orphelin` | existe déjà (actionList) — garder | — | — |

### 5.3 Règles de tri et de vie

- Score de priorité : `échéance proche > blocage (règle métier violée) > argent > repas > ménage`.
- Une exception disparaît dès que sa condition est fausse. Jamais de « dismiss » permanent sans `overrides` (§6).
- **Plafond dur : 5 cartes visibles.** Au-delà, tri par priorité + mention « +2 autres ». Une file de 12 cartes est une corvée ; on ne la montrera jamais.

## 6. Overrides — mémoriser une exception sans la résoudre

Parfois on ne veut pas décider maintenant (« les restes, on verra »). Une carte peut être **snoozée** :
`exc|<code>` dans `s.snooze` avec la durée choisie (ce soir / demain / cette semaine — mécanisme `snooze` existant).
Exception snoozée 3 fois ou plus → la 4e apparition propose « décider une règle par défaut pour toujours »
(lien direct vers l'écran `defaults`). C'est ainsi que les règles se **fabriquent toutes seules** au fil de l'usage.

## 7. UX — la carte d'exception

```
+--------------------------------------------------+
| (!) 2 portions de lasagnes en attente             |
|     Prochain déjeuner libre : demain midi         |
|                                                   |
| [ Demain midi ]  [ Vendredi ]  [ Plus tard |v| ]  |
+--------------------------------------------------+
```

- **Un tap = résolu.** Jamais deux écrans pour une exception.
- Les chips proposent les créneaux *déjà valides* (le reducer a pré-validé : pas de conflit « créneau occupé » possible).
- Appui long ou « ... » → snooze / changer la règle par défaut.
- Sur la page Aujourd'hui (tablette, lecture seule) : seul le **compteur** s'affiche (« 2 exceptions »), tap → ouvre le téléphone. La tablette ne décide pas, elle signale.

## 8. Intégration existante

- `actionList` (Mes Comptes) devient le **seul point d'affichage** ; les items Foyer y entrent par `exceptions(s)`.
- Les bandeaux existants (accueil Mes Comptes « relevés vieux de 10 jours ») restent : ils sont l'ambiance, pas la file.
- Foyer n'a pas de file aujourd'hui : l'onglet Aujourd'hui gagne la section « À régler » (mêmes cartes).
- Réglages : un nouvel écran « Décisions automatiques » listant chaque règle, son état, et un exemple — rédigé pour être compris par les deux sans formation.

## 9. Tests à exiger du reducer (avant tout code UI)

1. `defaults.set` avec valeurs invalides → rejet, état inchangé.
2. `exceptions(s)` : restes placés → `restes-placer` absente ; restes snoozés → absente jusqu'à la date.
3. `prevu-echu` disparaît après `tx.confirm`.
4. `depense-perso-commune` n'apparaît que si catégorie dans la liste commune ET montant > smallExpense.
5. Aucune exception n'est persistée : après rejeu du journal, `exceptions(s)` donne le même résultat (déterminisme).

## 10. Pièges explicitement interdits

1. **Ne jamais écrire d'état invisible** (ex. « restes auto-posés » sans événement). Tout ce qui modifie le planning
   est un événement du journal. L'« auto » se contente de **pré-remplir l'écran d'approbation** et d'afficher la carte réversible.
2. **Ne jamais laisser une règle par défaut créer un conflit** (ex. auto-poser des restes sur un créneau mangé).
   La règle filtre sur `!slot.eaten && !slot.dish` — les mêmes gardes que `slot.from`.
3. **Ne pas unifier les transports de synchro dans cette spec** — la file lit deux états, c'est tout. La mutualisation Supabase est une spec séparée.
4. **Ne pas ajouter de notification push** pour les exceptions : le modèle est le coup d'œil, pas l'interruption. (Push réservé aux rappels de rituel déjà existants.)

## 11. Prompt de démarrage pour Claude Code

> « Voici la spec docs/spec-file-exceptions.md. Commence par §9 : écris les tests du reducer dans
> tests/reduce.exceptions.test.js sans toucher au code de production. Fais-les passer en implémentant §4 et §5
> dans js/core/reduce.js et js/core/exceptions.js (fonction pure, aucun import UI). Ensuite seulement : la carte
> d'exception (§7) réutilise les styles .card/.act existants. Interdit : modifier l'UI de Mes Comptes au-delà du
> point d'entrée actionList. Une PR par section. »
