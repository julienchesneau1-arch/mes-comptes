# Foyer — PRD V2.1 (révision après audit et construction)

**4 octobre 2026 · remplace la V2 sur les points listés ici ; tout ce qui n'est pas modifié reste valable.**

La V2 était rigoureuse sur la vérité des données, mais elle traitait surtout le risque d'erreur et très peu la charge mentale elle-même. Cette révision garde son contrat de vérité, corrige neuf incohérences et ajoute ce qui retire réellement des décisions au quotidien. Chaque changement est justifié ; aucun n'introduit d'IA, de stock permanent ni de règle sanitaire inventée.

---

## 1. Faits établis par l'audit

| Point | Constat | Conséquence |
|---|---|---|
| Dépôt disponible | `mes-comptes` : PWA sans framework, 100 % locale, chiffrée, synchro par lien, tests `node test.js`, publiée sur GitHub Pages | Foyer est construit dans `foyer/`, même hébergement, même philosophie, isolé |
| Base Savore / Assemblages | Non accessible dans cette session | **V1B (OCR) bloquée** — `[DONNÉE_MANQUANTE : dépôt Savore]` |
| Meal Planner n8n existant (9 workflows, Google Sheets, Telegram) | Non inspecté | `[DONNÉE_MANQUANTE : format des recettes du Meal Planner]` ; reprise possible via « Coller une recette » |
| Source sanitaire | Fiche DGCCRF DLC/DDM (écrite le 17/12/2025) consultée le 4/10/2026 | Seuls des libellés factuels en sont tirés ; aucune durée calculée |
| Usage réel à deux | Pas encore observé | Les critères d'usage du §18 V2 restent **à mesurer** |

---

## 2. Ce que la V2 avait juste (conservé tel quel)

- Contrat de vérité : déclaré / calculé / proposé / inconnu ; aucune donnée inventée.
- Pas d'inventaire permanent ; « on en a déjà » ponctuel, versionné, jamais hérité d'une semaine à l'autre.
- Ingrédients comptés une seule fois à la source ; les boîtes consomment des portions, pas une seconde recette.
- Rien n'est confirmé parce que l'heure passe ; « passé, non confirmé » sans relance.
- Imprévus avec conséquences visibles ; pas de chaîne de déplacements automatique.
- OCR jamais promu automatiquement ; activation seulement sur bénéfice mesuré.

---

## 3. Incohérences corrigées

**[ANOMALIE_LOGIQUE 1 — l'objectif n'était pas outillé]** La promesse est « moins de décisions le soir », mais la V2 laisse 100 % du choix des repas à l'utilisateur. Or « qu'est-ce qu'on mange ? » est la décision la plus coûteuse.
→ **Proposition de semaine en un geste**, tirée uniquement des plats du foyer, par une règle déterministe et expliquée (« pas au menu depuis 23 j · rapide »). Statut « proposé » jusqu'à acceptation, ligne par ligne (« Autre idée », « Retirer »). Les boîtes du midi sont reliées au dîner de la veille si le foyer l'a choisi dans son rythme.

**[ANOMALIE_LOGIQUE 2 — serveur et comptes pour deux personnes]** Serveur persistant, comptes, invitations, rôles owner/member et hors-ligne en lecture seule : coût d'infrastructure et de saisie (mots de passe), et l'app devient inutilisable au supermarché sans réseau — précisément où elle sert.
→ **Local-first** : chaque téléphone garde un journal d'événements ; la synchro échange ce journal chiffré (AES-GCM, code du foyer jamais transmis avec le lien). Écriture hors ligne complète. L'isolement entre foyers est garanti par le chiffrement, sans contrôle d'accès serveur à maintenir. Les rôles owner/member sont supprimés (inutiles à deux).

**[ANOMALIE_LOGIQUE 3 — un panneau avant chaque modification]** Imposer un panneau de confirmation pour une absence ou un invité ajoute de la friction à l'action la plus fréquente.
→ **Annuler plutôt que confirmer** pour les changements réversibles (présences, invités, portions en plus) : application immédiate, conséquence affichée (« 4 → 3 portions · courses recalculées ») et bouton « Annuler » revalidé. **Aperçu bloquant** conservé pour déplacer, retirer ou passer en extérieur quand d'autres repas en dépendent.

**[ANOMALIE_LOGIQUE 4 — rayons sans source]** « Une section par rayon » sans dire d'où vient le rayon.
→ Dictionnaire déterministe (≈ 300 mots-clés, le plus long l'emporte : « lait de coco » ≠ « lait ») ; tout choix du foyer est mémorisé par ingrédient ; défaut « Autres ».

**[ANOMALIE_LOGIQUE 5 — conversions]** « Aucune conversion validée » contredit « additionner même dimension ».
→ Conversions **exactes à l'intérieur d'une dimension** seulement (kg↔g↔mg, l↔dl↔cl↔ml). Jamais entre dimensions, jamais cuillère→ml, gousse→g ou pièce→g. Cru/cuit/surgelé/en conserve restent des lignes distinctes.

**[ANOMALIE_LOGIQUE 6 — version figée ET recalcul]** « Toute recette référence une version » et « toute modification recalcule » se contredisent.
→ Un plat **pas encore préparé suit la dernière version** (corriger une recette corrige la liste) ; une préparation **déclarée fige sa version** (affichée dans le calcul de la ligne).

**[ANOMALIE_LOGIQUE 7 — dépense hebdomadaire en double]** Le foyer utilise déjà Mes Comptes, qui classe les dépenses « Alimentation ».
→ ExpenseNote **retirée** de Foyer. Notes de gaspillage différées (aucune décision identifiable qu'elles retirent aujourd'hui).

**[ANOMALIE_LOGIQUE 8 — « ne pas conseiller de préparer pour un jour futur »]** La V2 l'interdit, mais son propre EX-01 prévoit un dîner lundi pour une boîte mardi.
→ Le lien boîte ↔ dîner est une **intention déclarée** du foyer (règle de rythme qu'il a choisie), pas une recommandation sanitaire. L'app affiche des faits (« préparé hier ») et une seule mention permanente : la conservation n'est pas évaluée.

**[ANOMALIE_LOGIQUE 9 — et après la coche ?]** « Cocher = traité » ne dit pas ce qui arrive si le besoin change ensuite.
→ La coche mémorise ce qui restait à acheter à cet instant. Besoin en hausse : **seul l'écart réapparaît** (« +300 g depuis la coche »). Besoin en baisse : la ligne reste traitée ; un article déjà pris ne disparaît jamais.

---

## 4. Ajouts qui retirent de la charge mentale

| Ajout | Pourquoi | Garde-fou |
|---|---|---|
| **Tâches « la veille » / « le matin »** dans chaque plat (« sortir le poulet du congélateur ») | 2ᵉ source d'oubli après les courses | Déclarées par le foyer ; jamais déduites |
| **Idées quand rien n'est prévu** : restes libres d'abord, puis 3 plats | Le soir sans plan est le moment critique | Plats déjà prévus autour d'aujourd'hui exclus ; raison affichée |
| **« Pas encore pris »** pour les repas d'aujourd'hui et demain | Évite de découvrir le manque en cuisinant | Calculé depuis la liste, rien d'inféré |
| **« Plat entier »** (lasagnes, soupe) | Sinon « ≈ 0,33 boîte de tomates » : exact mais absurde | Le surplus devient des portions « en plus », visibles et déclarables |
| **Coller une recette** (notes, message, site) | Réduit la saisie, reprend le Meal Planner | Lecture sans IA ; lignes incertaines marquées « à vérifier » |
| **Habituels** (café, papier toilette) en un geste | Lignes manuelles mémorisables (déjà prévu en V2) | Quantités en texte, jamais calculées |
| **Partager la liste** en texte | Celui qui fait les courses n'a pas toujours l'app à jour | Seulement ce qui reste à traiter |
| **Mode cuisine** : quantités pour les portions réellement prévues, étapes à cocher | Plus de calcul de tête | Pas de durée estimée ; un minuteur ne coche rien |
| **Utiliser un produit qui arrive à DLC** : les plats qui le contiennent remontent dans les propositions | Moins de gaspillage sans inventaire | Seulement les produits surveillés, fermés, DLC déclarée |

---

## 5. Arbitrages V2.1 (remplace le tableau §2 de la V2)

| Sujet | V2 | **V2.1** |
|---|---|---|
| Architecture | Serveur + API + PostgreSQL | **Local-first, journal d'événements rejoué, synchro chiffrée par lien** |
| Comptes | Deux comptes, invitations, owner/member | **Un code du foyer** ; « qui utilise ce téléphone » |
| Hors ligne | Lecture seule | **Lecture et écriture** ; fusion à la synchro |
| Choisir les repas | Manuel | **Proposition déterministe** à valider |
| Confirmation | Panneau avant chaque changement métier | Annuler pour le réversible ; aperçu pour les dépendances |
| Rayons | Non spécifié | Dictionnaire + choix mémorisé |
| Dépense | Facultative | Retirée (Mes Comptes) |
| Concurrence | Verrou serveur | **Rejeu dans un ordre commun** ; l'action devenue impossible est écartée et signalée aux deux |
| Stack | TS/React/PostgreSQL proposée | **TypeScript strict sans framework**, compilé en JS servi tel quel (stack du dépôt) |

---

## 6. Contrats (V2 §14, mis à jour)

| Contrat V2 | Implémentation V2.1 |
|---|---|
| `deriveShopping(snapshot)` | `deriveShopping(state, semaine)` — pur, testé |
| `previewChange(command, expectedVersion)` | `previewChange(journal, ctx, événements, jour, heure)` → conséquences + `base` (taille du journal) |
| `applyChange(proposalId, expectedVersion, commandId)` | Si `base` ≠ journal courant : aperçu recalculé, jamais d'écrasement ; chaque événement a un identifiant unique (idempotence) |
| `checkPantry(...)` | Événement `shop.pantry` portant la signature du besoin (`needAt`) |
| `declarePreparation(planId, actualYield, …)` | `prep.done` (rendement réel, version figée) |
| `recordPortionEvent(batchId, event, commandId)` | `slot.eaten`, `prep.discard` (motif), `prep.correct` (refusée si incompatible) |
| `declareDate(...)` | `watch.save` (type, valeur à la précision imprimée, état) |

Retours métier explicites : chaque événement impossible est écarté avec sa raison (« plus assez de portions libres de Curry »), jamais forcé, jamais en erreur technique.

---

## 7. Livraisons

- **V1A** : livrée dans ce dépôt (`foyer/`), preuves dans `PLAN.md`.
- **V1B (OCR)** : **bloquée** (Savore inaccessible) et **non recommandée** avant d'avoir mesuré que la saisie manuelle des dates est un vrai frein. La saisie actuelle prend une date en un geste (« demain », « +3 j ») ; un OCR à confirmer champ par champ ne ferait gagner du temps qu'avec beaucoup de produits suivis — ce que la V2 elle-même déconseille.
- **V1C (proposée)** : synchro automatique via un relais qui ne voit que des données chiffrées (voir `PLAN.md`), sur décision du foyer.

Fin du PRD V2.1.
