# Foyer

**Une semaine visible. Des courses utiles. Moins de décisions le soir.**

Les repas de la semaine à deux, la liste de courses calculée toute seule, les restes et les boîtes du midi, les petites choses à faire la veille. Sur vos téléphones, sans compte ; synchro chiffrée de bout en bout (automatique par un relais qui ne lit rien, ou par lien).

Adresse (après publication de `main`) : `https://julienchesneau1-arch.github.io/mes-comptes/foyer/`

## Au quotidien

- **Aujourd'hui** : ce soir et demain midi, combien de portions préparer et pour qui (« 4 : 2 ce soir, 1 boîte d'Alex demain, 1 en plus »), « on a mangé » en un geste, les tâches de la veille (« sortir le poulet »), ce qui n'est pas encore acheté pour ces repas. Rien de prévu ? Les restes disponibles, puis trois idées tirées de vos plats.
- **Semaine** : « Proposer les repas vides » remplit la semaine à partir de vos plats (le moins récent d'abord, « rapide » en semaine, les boîtes reliées au dîner de la veille), plus une à trois découvertes du Livre de cuisine de Wikilivres ; tout est à valider ligne par ligne. Déplacer, échanger, repas extérieur, absence : les conséquences s'affichent avant d'enregistrer.
- **Courses** : par rayon, quantités exactes, calcul visible en touchant une ligne. « On en a déjà » vaut pour cette liste. Cocher = pris ; si le besoin augmente ensuite, seul l'écart réapparaît. Habituels en un geste, liste à partager par message. « Commander chez Auchan » : article par article, Foyer ouvre la page du produit choisi (retenu une fois) avec le nombre de paquets ; vous ajoutez au panier sur Auchan, l'article se coche.
- **Maison** : vos plats (un nom suffit pour commencer ; une recette se colle en texte, s'importe depuis son adresse web ou se choisit dans « Découvrir des recettes »), les portions déclarées, les produits dont la date compte, les réglages et la synchro.
- **À deux** : synchro automatique chiffrée de bout en bout (le second téléphone tape juste le code du foyer), « qui cuisine » par repas, glisser-déposer dans la semaine, rappels en notification (« sortir le poulet » la veille à 19 h, la boîte à préparer, la semaine suivante vide ; Réglages › « Activer les rappels ») ou dans l'agenda, mode magasin (écran allumé).
- **Agenda** : vos agendas Google, iCloud ou Outlook branchés une fois (Réglages › Agendas) ; le foot du mardi, un resto, le télétravail, les vacances et les jours fériés ajustent les repas du mois. Une décision par événement, ensuite c'est automatique ; un plat que plus personne ne mange est décalé.
- **Prise en main** : « Premiers pas » sur Aujourd'hui et « Comment ça marche » dans Réglages.

## Installer sur iPhone (iOS 16.4 ou plus récent)

Safari → l'adresse ci-dessus → Partager → « Sur l'écran d'accueil ». Sur le deuxième téléphone : « L'autre téléphone a déjà Foyer », puis taper le code du foyer affiché sur le premier (synchro automatique), ou coller un lien reçu (sans relais).

Quelque chose ne marche pas ? Maison › Réglages › « Diagnostic de ce téléphone » dit ce qui manque et ce que ça change.

Sur iPhone, un lien reçu s'ouvre dans Safari, pas dans l'app : appui long → Copier, puis dans Foyer « Coller le lien reçu ».

## Ce que Foyer ne fait pas, volontairement

Pas d'inventaire du frigo, pas d'IA, pas de prix, pas de durée de conservation calculée, aucun repas confirmé parce que l'heure est passée. Les seuls contrôles de date : DLC dépassée, date manquante, produit ouvert ([fiche DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/date-limite-de-consommation-et-date-de-durabilite-minimale-ce-que-vous-devez-savoir)).

## Développement

```
cd foyer
npm ci
npm run check      # compile (TypeScript strict) → js/ et sw.js, typage des tests, 82 tests
```

Sources dans `src/`, JavaScript publié dans `js/` (à recompiler et versionner après chaque modification ; la CI le vérifie). La liste hors ligne de `sw.js` est régénérée à chaque compilation.

Catalogue de découvertes : `catalogue.json`, tiré du [Livre de cuisine de Wikilivres](https://fr.wikibooks.org/wiki/Livre_de_cuisine) sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr) (auteurs : historique de chaque page) ; régénéré par `scripts/catalogue.mjs` (workflow « catalogue »). Chaque recette ajoutée à vos plats garde sa source.

Documents : [PRD V2.1/V2.2](docs/PRD_V2.1.md) · [Comparatif](docs/BENCHMARK.md) · [Plan et état](docs/PLAN.md) · [Architecture](docs/ARCHITECTURE.md)

Synchro automatique, import web et rappels : relais Supabase dédié (`supabase/` : migrations, fonctions `foyer-import`, `foyer-push` et `foyer-agenda`, tâche planifiée toutes les 5 min), adresse dans `src/ui/config.ts` + `connect-src` d'`index.html` (un test vérifie qu'ils concordent). Relais indisponible : tout continue en local, avec la synchro par lien.
