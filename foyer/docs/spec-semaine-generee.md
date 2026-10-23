# SPEC — Génération hebdomadaire de la semaine (module « Approbation »)
> Foyer · prêt à donner à Claude Code · version 1.0 — dépend de spec-file-exceptions.md

## 1. Mission

Dimanche soir, 10 minutes : la semaine entière (repas, restes, liste de courses, corvées, prévision d'argent) est
**déjà générée**. Le couple n'a qu'une action : approuver, ou veto item par item. L'app recalcule le reste tout seul.
La charge mentale ne vient pas de la taille des décisions mais de leur fréquence : cette spec déplace 20 décisions
quotidiennes en 1 décision hebdomadaire.

## 2. Ce qui est généré (dans l'ordre, chaque étape consomme le résultat de la précédente)

1. **Corvées** : rotation automatique (v2 du module exceptions) — détermine qui est chef de semaine.
2. **Présences** : copiées du rythme (`settings.rhythm`) + agenda — servent de base à tout le reste.
3. **Repas** : pour chaque créneau où quelqu'un mange à la maison, un plat est proposé par le moteur de scoring (§4).
4. **Restes** : les portions libres sont placées par la règle par défaut (spec-file-exceptions §5.1) — pas de scoring.
5. **Batch** : les plats lourds (tag `batchable`) proposés deux fois sont regroupés en un batch le dimanche.
6. **Courses** : recalculées depuis les recettes retenues (le moteur de courses existant — on ne le réécrit pas).
7. **Argent** : prévision du mois (existing `liveForecast`) affichée en bandeau — rien à générer, juste montrer.

## 3. Principe fondateur

> Générer = **préparer un lot d'événements**, pas muter l'état. Rien n'est écrit dans le journal avant approbation.
> Le lot est rejoué **en mémoire** pour produire l'aperçu (les conséquences : courses, portions, conflits) —
> le même mécanisme que `openPreview` existant, généralisé à N événements.

## 4. Moteur de scoring des plats (déterministe, pas d'IA)

Score d'une recette R pour un créneau K :

```
score = rotation    : jours depuis la dernière cuisine de R (plafonné à 21) x 2
      + saison      : tag saison de R correspond au mois ? +6 : 0
      + temps       : soir de semaine -> recettes tag 'rapide' +5 ; week-end -> 'long' +3
      + restes      : portions libres existantes -> les recettes 'compatible restes' (même base) +4
      + budget      : coût estimé (prix existants `loadRefPrices`) < budget restant de la semaine ? +3 : -8
      + variété     : même famille que le plat d'hier ? -6 (anti-répétition)
      + veto        : jamais proposée (archivée) : exclue
```

Sélection : meilleur score, avec **jamais deux fois la même famille sur 3 jours glissants**.
Déterminisme total : même état -> même semaine proposée (testable à l'identique). Aucun appel réseau, aucun aléa.

Le moteur n'a pas besoin d'être parfait : il propose, l'humain veto. Une suggestion à 70 % d'acceptation vaut
mieux qu'une file de décisions à 100 %.

## 5. Écran d'approbation (le seul écran nouveau)

```
Semaine du 26 octobre — tout est prêt.          [ Tout approuver ]
────────────────────────────────────────────────────────────
Lun  midi   Restes de lasagnes (auto)                    OK
Lun  soir   Curry (rapide, jamais cuisiné depuis 12 j)   OK
Mar  soir   [x] veto -> [ suggérer autre chose ]
Mer  soir   Boeuf bourguignon (batch dim. + portions jeu.) OK
────────────────────────────────────────────────────────────
Courses estimées : ~94 EUR · 12 articles   Prévision fin de mois : +380 EUR
```

- **Un veto = recalcul local immédiat** : l'aperçu est rejoué en mémoire avec la 2e suggestion (et le 3e choix si
  second veto, puis « choisir dans mes recettes »).
- **« Tout approuver » émet le lot en un seul dispatch** : une entrée du journal, rejouable, annulable d'un coup
  (événement enveloppe `week.approve { events: [...] }` — le rejeu applique chaque sous-événement avec les gardes
  habituelles ; si un garde rejette un sous-événement, il est écarté et signalé, comme le rejeu standard).
- Approbation partielle possible : approuver jour par jour. Le lot est stocké en `s.drafts.week` (un seul brouillon à la fois).

## 6. Nouveaux événements

```js
case 'week.draft':     // stocke/remplace le brouillon généré (poids plafonné : 200 événements max)
case 'week.approve':   // applique les sous-événements avec les gardes du reducer, rejette les impossibles
case 'week.discard':   // supprime le brouillon
```

`week.approve` ne valide pas la structure : chaque sous-événement repasse par `apply()` — jamais de raccourci
qui contournerait les conflits (« créneau occupé », « plus assez de portions »). Ce qui est impossible est écarté,
pas forcé.

## 7. Règles d'or anti-pièges

1. **Jamais de génération silencieuse** : tant que le brouillon n'est pas approuvé, le planning réel est intact.
   La tablette ne montre que le planning approuvé.
2. **Jamais d'écrasement** : `week.approve` applique ses sous-événements avec les gardes existants ; un créneau
   occupé entre-temps (l'autre téléphone a planifié) -> sous-événement écarté + carte d'exception « Lundi soir
   était déjà pris par X ».
3. **Le scoring ne mute rien** : pur, réentrant, testable. Le résultat dépend uniquement de l'état.
4. **Brouillon = éphémère** : un seul, remplacé à chaque génération, supprimé après approbation. Pas d'historique
   de brouillons (sinon c'est un deuxième planning à maintenir = charge mentale).
5. **Ne pas générer de corvées/argent dans cette v1** si la rotation (spec exceptions v2) n'est pas prête :
   les sections s'affichent « bientôt » plutôt que d'être simulées.

## 8. Tests à exiger (avant l'écran)

1. Génération déterministe : même état -> mêmes propositions (snapshot test).
2. `week.approve` : sous-événement en conflit -> écarté, les autres appliqués, exception créée pour l'écarté.
3. Veto -> 2e suggestion différente de la 1re et sans la famille exclue.
4. Restes posés par défaut dans le brouillon : rejouer le brouillon ne produit jamais `free < 0`.
5. `week.draft` > 200 événements -> rejet.
6. Double approbation -> `noop` (le brouillon a disparu).

## 9. Prompt de démarrage pour Claude Code

> « Spec : docs/spec-semaine-generee.md. Ordre strict : (1) tests §8, (2) js/core/score.js (pur, zéro import UI),
> (3) week.draft/week.approve dans reduce.js, (4) écran d'approbation. Le scoring lit settings.rhythm, les tags
> recette, loadRefPrices. Tags recette : ajouter 'rapide' | 'long' | 'batchable' | saisons à recipe.save via
> un event dédié (spec séparée si débat). Une PR par étape. »
