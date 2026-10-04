# Foyer

**Une semaine visible. Des courses utiles. Moins de décisions le soir.**

Les repas de la semaine à deux, la liste de courses calculée toute seule, les restes et les boîtes du midi, les petites choses à faire la veille. Sur vos téléphones, sans compte ni serveur, synchro chiffrée par lien.

Adresse (après publication de `main`) : `https://julienchesneau1-arch.github.io/mes-comptes/foyer/`

## Au quotidien

- **Aujourd'hui** : ce soir et demain midi, combien de portions préparer et pour qui (« 4 : 2 ce soir, 1 boîte d'Alex demain, 1 en plus »), « on a mangé » en un geste, les tâches de la veille (« sortir le poulet »), ce qui n'est pas encore acheté pour ces repas. Rien de prévu ? Les restes disponibles, puis trois idées tirées de vos plats.
- **Semaine** : « Proposer les repas vides » remplit la semaine à partir de vos plats (le moins récent d'abord, « rapide » en semaine, les boîtes reliées au dîner de la veille), à valider ligne par ligne. Déplacer, échanger, repas extérieur, absence : les conséquences s'affichent avant d'enregistrer.
- **Courses** : par rayon, quantités exactes, calcul visible en touchant une ligne. « On en a déjà » vaut pour cette liste. Cocher = pris ; si le besoin augmente ensuite, seul l'écart réapparaît. Habituels en un geste, liste à partager par message.
- **Maison** : vos plats (un nom suffit pour commencer ; « Coller une recette » lit un texte), les portions déclarées, les produits dont la date compte, les réglages et la synchro.

## Installer sur iPhone (iOS 16.4 ou plus récent)

Safari → l'adresse ci-dessus → Partager → « Sur l'écran d'accueil ». Sur le deuxième téléphone : « L'autre téléphone a déjà Foyer », coller le lien reçu, taper le code du foyer (affiché dans Maison › Réglages › Synchro sur le premier).

Sur iPhone, un lien reçu s'ouvre dans Safari, pas dans l'app : appui long → Copier, puis dans Foyer « Coller le lien reçu ».

## Ce que Foyer ne fait pas, volontairement

Pas d'inventaire du frigo, pas d'IA, pas de prix, pas de durée de conservation calculée, aucun repas confirmé parce que l'heure est passée. Les seuls contrôles de date : DLC dépassée, date manquante, produit ouvert ([fiche DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/date-limite-de-consommation-et-date-de-durabilite-minimale-ce-que-vous-devez-savoir)).

## Développement

```
cd foyer
npm ci
npm run check      # compile (TypeScript strict) → js/, typage des tests, 34 tests
```

Sources dans `src/`, JavaScript publié dans `js/` (à recompiler et versionner après chaque modification ; la CI le vérifie). Ajouter un fichier JS → l'ajouter aussi à la liste de `sw.js` (un test le vérifie).

Documents : [PRD V2.1](docs/PRD_V2.1.md) · [Plan et état](docs/PLAN.md) · [Architecture](docs/ARCHITECTURE.md)
