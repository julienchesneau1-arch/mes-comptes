# Foyer

**Une semaine visible. Des courses utiles. Moins de décisions le soir.**

Les repas de la semaine à deux, la liste de courses calculée toute seule, les restes et les boîtes du midi, les petites choses à faire la veille. Sur vos téléphones, sans compte ; synchro chiffrée de bout en bout (automatique par un relais qui ne lit rien, ou par lien).

Adresse (après publication de `main`) : `https://julienchesneau1-arch.github.io/mes-comptes/foyer/`

## Au quotidien

- **Aujourd'hui** : ce soir et demain midi, combien de portions préparer et pour qui (« 4 : 2 ce soir, 1 boîte d'Alex demain, 1 en plus »), « on a mangé » en un geste, les tâches de la veille (« sortir le poulet »), ce qui n'est pas encore acheté pour ces repas. Rien de prévu ? Les restes disponibles, puis trois idées tirées de vos plats.
- **Semaine** : « ✨ Proposer le menu » présente une carte par repas, à la Jow : glisser à droite pour garder, à gauche pour une autre idée, puis « Valider la semaine ». Par défaut, **maximum de nouveautés** : une recette jamais cuisinée du Livre de cuisine de Wikilivres à chaque repas tant qu'il en reste, vos plats ensuite (Réglages › « Propositions de repas » : Équilibré ou Surtout nos plats). Toujours : jamais deux fois le même plat dans la semaine, pas un plat déjà prévu il y a moins de 2 semaines s'il reste autre chose, pas deux plats du même genre, les boîtes reliées au dîner de la veille. Déplacer, échanger, repas extérieur, absence : les conséquences s'affichent avant d'enregistrer.
- **Courses** : par rayon, quantités exactes, calcul visible en touchant une ligne. « On en a déjà » vaut pour cette liste. Cocher = pris ; si le besoin augmente ensuite, seul l'écart réapparaît. Habituels en un geste, liste à partager par message. Dès le menu validé, le panier est prêt (« Remplir le panier Auchan ») : article par article, Foyer ouvre la page Auchan avec le nombre de paquets et un conseil qualité-prix ; vous ajoutez au panier, l'article se coche. Si le menu change ensuite, Courses dit quoi ajouter ou retirer du panier.
- **Maison** : vos plats (un nom suffit pour commencer ; une recette se colle en texte, s'importe depuis son adresse web ou se choisit dans « Découvrir des recettes »), les portions déclarées, les produits dont la date compte, les réglages et la synchro.
- **À deux** : synchro automatique chiffrée de bout en bout (le second téléphone tape juste le code du foyer), « qui cuisine » par repas, glisser-déposer dans la semaine, rappels en notification (« sortir le poulet » la veille à 19 h, la boîte à préparer, la semaine suivante vide ; Réglages › « Activer les rappels ») ou dans l'agenda, mode magasin (écran allumé).
- **Agenda** : vos agendas Google, iCloud ou Outlook branchés une fois (Réglages › Agendas) ; le foot du mardi, un resto, le télétravail, les vacances et les jours fériés ajustent les repas du mois. Une décision par événement, ensuite c'est automatique ; un plat que plus personne ne mange est décalé.
- **Équilibre** : sous la semaine, les repères officiels (Santé publique France) comptés sur vos plats prévus : poisson 2 fois dont 1 gras, légumes secs 2 fois, viande hors volaille 500 g au plus, charcuterie 150 g au plus. Les propositions comblent ce qui manque.
- **Rituel batch** : courses finales le samedi (commande au drive), batch cooking le dimanche (Maison › Réglages › Rituel batch). Le menu en cartes marque les plats « 👩‍🍳 Batch » ; la feuille du batch liste les plats, les boîtes à emporter et les légumes à préparer en une fois ; « Par quoi commencer » si les recettes ont leurs durées (saisies ou lues à l'import) ; « Prêt » d'un geste. Rappels le jour des courses et le jour du batch.
- **Budget, rien à saisir** : panier estimé tout seul (prix relevés des produits conseillés, sinon prix moyens publiés par l'Insee), en disant combien d'articles sont chiffrés ; budget de la semaine avec jauge ; montant payé facultatif ; Maison › Bilan suit les semaines.
- **Qualité-prix** : pour chaque article d'épicerie ou de crèmerie, les produits vendus chez Auchan classés par Nutri-Score, transformation (NOVA), bio, Label Rouge, AOP/IGP et prix relevé : « meilleur rapport », « moins cher », « mieux noté » (Open Food Facts et Open Prices, mis à jour chaque semaine).
- **Prise en main** : Aujourd'hui ne montre qu'une étape des « Premiers pas » à la fois ; « Comment ça marche » dans Réglages.

## Installer sur iPhone (iOS 16.4 ou plus récent)

Safari → l'adresse ci-dessus → Partager → « Sur l'écran d'accueil ». Sur le deuxième téléphone : « L'autre téléphone a déjà Foyer », puis taper le code du foyer affiché sur le premier (synchro automatique), ou coller un lien reçu (sans relais).

Quelque chose ne marche pas ? Maison › Réglages › « Diagnostic de ce téléphone » dit ce qui manque et ce que ça change.

Sur iPhone, un lien reçu s'ouvre dans Safari, pas dans l'app : appui long → Copier, puis dans Foyer « Coller le lien reçu ».

## Ce que Foyer ne fait pas, volontairement

Pas d'inventaire du frigo, pas d'IA (aucun coût, aucun token), aucun prix lu sur le site d'Auchan (CGU), pas de remplissage automatique du panier Auchan (réservé aux partenaires d'Auchan), pas de durée de conservation calculée, pas de note nutritionnelle (seulement les repères officiels, comptés sur vos plats), aucun repas confirmé parce que l'heure est passée. Les seuls contrôles de date : DLC dépassée, date manquante, produit ouvert ([fiche DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/date-limite-de-consommation-et-date-de-durabilite-minimale-ce-que-vous-devez-savoir)).

## Développement

```
cd foyer
npm ci
npm run check      # compile (TypeScript strict) → js/ et sw.js, typage des tests, 109 tests
node scripts/prix.mjs        # prix.json (Insee) — la CI le fait chaque semaine
node scripts/produits.mjs    # produits.json (Open Food Facts + Open Prices) — idem
```

Sources dans `src/`, JavaScript publié dans `js/` (à recompiler et versionner après chaque modification ; la CI le vérifie). La liste hors ligne de `sw.js` est régénérée à chaque compilation.

Police : Nunito (The Nunito Project Authors), licence SIL Open Font License 1.1, servie depuis `fonts/` (texte de la licence dans `fonts/OFL.txt`).

Catalogue de découvertes : `catalogue.json`, tiré du [Livre de cuisine de Wikilivres](https://fr.wikibooks.org/wiki/Livre_de_cuisine) sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr) (auteurs : historique de chaque page) ; régénéré par `scripts/catalogue.mjs` (workflow « catalogue »). Chaque recette ajoutée à vos plats garde sa source.

Documents : [PRD V2.1/V2.2](docs/PRD_V2.1.md) · [Comparatif](docs/BENCHMARK.md) · [Plan et état](docs/PLAN.md) · [Architecture](docs/ARCHITECTURE.md)

Synchro automatique, import web et rappels : relais Supabase dédié (`supabase/` : migrations, fonctions `foyer-import`, `foyer-push` et `foyer-agenda`, tâche planifiée toutes les 5 min), adresse dans `src/ui/config.ts` + `connect-src` d'`index.html` (un test vérifie qu'ils concordent). Relais indisponible : tout continue en local, avec la synchro par lien.
