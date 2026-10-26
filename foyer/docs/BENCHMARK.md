# Foyer face aux meilleures apps — bilan sans complaisance

**4 octobre 2026.** Fonctions des concurrents vérifiées ce jour sur leurs pages officielles ou des sources publiques (liens en bas). Ce qui n'a pas été vérifié est marqué « ? ». Notes sur 5, pondérées par ce qui retire de la charge mentale à deux (poids total 20). **Les notes sont attribuées par l'auteur de Foyer : biais possible.** Celles de Foyer reposent sur des tests exécutés en navigateur (Chromium), **pas encore sur iPhone** ; l'usage réel tranchera.

## Tableau

| Critère (poids) | AnyList | Paprika | Mealie | Jow | Foyer V2.1 (avant) | **Foyer V2.7** |
|---|---|---|---|---|---|---|
| Décider quoi manger (×3) | 2 — calendrier manuel | 2 — manuel | 3 — tirage au hasard | **5** — menu proposé dans 5 000+ recettes | 4 — propositions expliquées depuis vos plats | **4,5** — + variété des viandes, réutilisation des produits frais, DLC, jusqu'à 3 découvertes Wikilivres par semaine, menu en cartes à balayer (sans photos, contrairement à Jow) |
| Courses (×3) | **5** — rayons, fusion des doublons | **5** — rayons personnalisables, fusion | 4 | 4 — + drive | 4 — quantités exactes, calcul visible | **5** — + ordre de votre magasin, mode magasin, habituels, saisie assistée |
| Partage à deux (×3) | **5** — temps réel | 4 — synchro cloud | **5** — temps réel | ? | 2 — lien à envoyer | **4** — automatique toutes les 20 s, chiffré de bout en bout |
| Ajouter ses recettes (×2) | 4 — import web (offre payante) | **5** — navigateur intégré | **5** — adresse ou HTML/JSON | 4 — catalogue + import | 2 — texte collé | **4** — adresse web (schema.org) ou texte |
| Restes, boîtes, portions réelles (×3) | 1 — notes | 1 | 1 — notes | 1 | **5** | **5** — préparé 4 → 2 ce soir, 1 boîte, 1 libre ; rendement réel ; jamais négatif |
| Préparer à l'avance (×2) | 4 — vue cuisine, mise à l'échelle | 4 | 4 — mode cuisine | 4 | 4 — tâches de la veille, mode cuisine | **5** — + écran allumé, rappels dans l'agenda |
| Imprévus (×2) | 4 — glisser-déposer | 3 | 4 — glisser-déposer | 3 | 4 — aperçu des conséquences | **5** — glisser-déposer + aperçu (portions, courses, repas dépendants) + agenda du mois (absences, télétravail, plat décalé) |
| Finition native (×1) | **5** — Apple Watch, widgets | 4 | 3 — web | 4 | 2 — app web | **3** — rappels agenda + notifications chiffrées (**non vérifiées sur iPhone** : passera à 4 si le geste 11 réussit) ; pas de widget |
| Commander au drive (×2) | ? | ? | ? | **5** — panier rempli en un clic chez Auchan, Carrefour, Leclerc… (partenariats avec les enseignes) | 1 — liste à partager | **2** — Auchan assisté : page du produit retenu ouverte, nombre de paquets calculé ; l'ajout au panier reste un geste sur Auchan, sans prix |
| Coût, vie privée, pérennité (×1) | 3 — 14,99 $/an foyer | 3 — payant | 4 — à héberger soi-même | 3 — financé par les enseignes | **5** — gratuit, local, export | **5** |
| **Moyenne pondérée** | **3,6** *(sans le critère non vérifié)* | **3,4** *(idem)* | **3,6** *(idem)* | **3,6** *(sans le critère non vérifié)* | **3,4** | **4,3** |

*Critère « Commander au drive » ajouté après coup, le 4 octobre : il manquait, et son absence flattait Foyer (V2.2 : 4,6 sans ce critère, 4,25 avec). Le panier assisté ne fait gagner qu'un point sur ce critère (4,25 → 4,34).*

## Lecture

**Où Foyer est devant.** Personne ne gère les portions réelles : cuisiner 4, en manger 2, réserver une boîte, savoir qu'il en reste une, et voir ce qui casse si on déplace le dîner. C'est exactement là que naît la charge mentale à deux ; c'est le cœur de Foyer, prouvé par les tests EX-01 à EX-05. L'aperçu des conséquences avant un déplacement, les propositions expliquées tirées de vos plats, les quantités exactes et le chiffrement de bout en bout sont aussi absents des pages concurrentes consultées.

**Où Foyer reste derrière, et pourquoi.**
- **Petit catalogue** : 424 plats du Livre de cuisine de Wikilivres (181 avec nombre de personnes, proposables d'office ; V3.6), de qualité inégale, contre plus de 5 000 recettes testées chez Jow. Aspirer Marmiton est interdit (CGU, droit des bases de données) et inventer des recettes est exclu. Compensé par l'import d'une adresse web, qui reprend les recettes des sites que vous utilisez déjà.
- **Notifications livrées mais pas encore vues sur un iPhone ; pas de widget.** Rappels chiffrés envoyés par le relais (Web Push, iOS 16.4+, Foyer installé) ; vérifiés côté serveur, pas sur un vrai téléphone. Une app web n'a ni widget ni Apple Watch. Les rappels dans l'agenda (.ics) restent disponibles.
- **Pas de recul d'usage.** AnyList existe depuis 2012. Foyer n'a jamais été utilisé sur vos téléphones : c'est le seul vrai juge (`PLAN.md`, étape C).
- **Pas de panier rempli en un clic.** Jow le fait grâce à des partenariats commerciaux avec les enseignes (page « Auchan x Jow » sur auchan.fr), y compris pour vos propres recettes. Aucune API publique de panier Auchan trouvée, et les CGU d'auchan.fr (12/06/2026) interdisent les robots d'extraction sauf licence écrite. Foyer ouvre donc la page du bon produit et calcule le nombre de paquets ; l'ajout au panier reste un geste sur Auchan. Jow reste la meilleure option si le clic unique prime sur le reste.
- **Synchro instantanée seulement app ouverte** (V3.8) : un signal temps réel déclenche la relève en une ou deux secondes ; iOS coupe les connexions des apps web en arrière-plan, la relève suivante prend le relais.

**À noter.** D'après un comparatif publié par foodieprep.ai, Mealime ferme le 21 octobre 2026 sans export des données. C'est précisément le risque que Foyer évite : vos données restent sur vos téléphones, exportables en JSON à tout moment.

**V2.8 (8 octobre 2026) — rituel batch et budget.** Aucune des pages concurrentes consultées le 4 octobre ne décrit un batch cooking relié aux portions réelles (plat cuisiné le dimanche, boîtes et restes de la semaine, J+n). Jow propose des menus « batch » dans son catalogue ; Foyer part de vos plats, de votre semaine (présences, boîtes, agenda) et rappelle chaque étape à deux. Le budget repose sur des prix notés à la main : moins automatique que les prix affichés dans un panier partenaire (Jow), mais exact et sans robot. Notes inchangées tant que l'usage réel n'a pas tranché.

**V2.9 (8 octobre 2026) — nouveautés et clarté.** Jow et Mealime renouvellent leurs propositions à partir de leur propre catalogue ; Foyer propose par défaut une recette jamais cuisinée à chaque repas (catalogue Wikilivres de 423 recettes, plus restreint et de qualité plus inégale qu'un catalogue éditorial) et refuse toute répétition dans la semaine. Les repères d'équilibre comptés sur la semaine par personne ne figurent sur aucune des pages concurrentes consultées le 4 octobre. Audit de clarté avant correction : 4/10 (agent jouant un couple novice, pas une personne réelle) ; notes du comparatif inchangées tant que l'usage réel n'a pas tranché.

**V3.0 (9 octobre 2026) — drive et prix.** Jow garde une avance nette sur le drive : panier Auchan rempli automatiquement grâce à un partenariat (page « Auchan x Jow »), prix réels du magasin. Foyer : panier prêt et mis à jour d'après le menu, un toucher par article, prix estimés (Insee, relevés Open Prices) et conseil qualité-prix (Open Food Facts) qu'aucune page concurrente consultée ne décrit. Critère « commander au drive » inchangé.

**V3.1 (9 octobre 2026) — prix réels.** Foyer lit la facture du drive sur le téléphone : prix réellement payés à la place des estimations, montant payé noté, même produit recherché la fois suivante. Jow garde les prix du magasin avant l'achat (partenariat) ; Foyer a ceux de vos achats passés, sans partenariat ni IA. Critère « commander au drive » inchangé.

**V3.2–V3.3 (23 octobre 2026) — Pimzi.** Pimzi (pimzi.app, lu par la recherche web : la lecture directe du site était impossible depuis l'environnement) compose une semaine de dîners dans un budget choisi, pour 20 enseignes, prix « calés à ±10 % », liste par rayon, « déjà au placard », allergènes ; 14,99 $/mois ou 59,99 $ à vie. Repris dans Foyer : budget tenu d'office par remplacement des plats chers (avec un garde-fou absent chez Pimzi : jamais sur un prix mal connu), coût par portion, veto d'un toucher (V3.3) ; allergies (les 14 allergènes réglementaires) et aliments refusés, « étiquette à vérifier » sur les produits transformés, budget et allergies demandés à l'accueil, estimations calées sur nos propres factures, « déjà au placard ? » pour le reste d'un paquet (V3.4). Pimzi garde l'avance sur la couverture des prix (niveaux de prix par enseigne, non sourcés publiquement) et sur le choix de l'enseigne (20 ; Foyer : Auchan). Foyer reste gratuit, local, à deux, et ne montre que ce qui est chiffré.

**V3.5 (25 octobre 2026) — trouver vite.** Paprika ouvre une recette en lecture avec un mode Cuisine (écran allumé, ingrédients à cocher, étape en cours) ; Mealime ouvre la recette depuis le planning et range les favoris à part (fiches App Store et aide en ligne, consultées le 25 octobre 2026). Repris : fiche en lecture d'un toucher, écran allumé, épingler une recette. Au-delà : raccourcis tirés de votre usage réel, mais dans une zone fixe et recalculés une fois par jour, parce que les études montrent qu'un menu qui se réordonne seul ralentit (Findlater et McGrenere, CHI 2004 ; Gajos et al., AI Magazine 2009) alors qu'une zone « fréquents » séparée accélère (Sears et Shneiderman, 1994). La mesure ne quitte jamais le téléphone. Paprika garde l'avance sur les minuteurs détectés dans les étapes.

**V3.6 (25 octobre 2026) — recettes prêtes.** Comme chez Jow, un plat jamais saisi se prévoit d'un toucher : idées d'Aujourd'hui dès le premier jour, section « Recettes prêtes » dans le choix d'un plat (recherche comprise), fiche avec les prochains repas libres. Jow garde une avance nette sur le nombre (plus de 5 000 recettes testées contre 424 plats bénévoles), les photos et la régularité des fiches ; 243 pages Wikilivres ne disent pas pour combien de personnes, et Foyer le demande au lieu de le deviner. Critère « décider quoi manger » inchangé tant que l'usage réel n'a pas tranché.

**V3.12 (26 octobre 2026) — un toucher par article.** Jow remplit le panier du drive d'un clic grâce à des partenariats commerciaux avec les enseignes ; Foyer, sans partenariat, garde la personne aux commandes sur Auchan mais ne demande plus qu'un toucher par article dans l'app (« Ajouté » ouvre le suivant) et un toucher pour retenir un produit. L'écart avec Jow sur ce point reste net et n'est pas comblable sans accord avec Auchan.

**V3.11 (26 octobre 2026) — tout le panier.** Desserts du quotidien, fruits, boissons et goûter rejoignent les produits suivis ; la commande guidée au drive et le budget comptent désormais toute la semaine, pas seulement les recettes, sans jamais inventer un prix. Comparaison avec les autres apps non vérifiée : `[DONNÉE_MANQUANTE]`.

**V3.10 (26 octobre 2026) — petit-déjeuner et placard.** Café, thé, sucre, lait, beurre, huile, sel… suivis au même rythme appris, chacun dans son rayon ; une seule ligne quand une recette en demande aussi. Comparaison avec les autres apps non vérifiée : `[DONNÉE_MANQUANTE]`.

**V3.9 (26 octobre 2026) — produits de la maison.** Dentifrice, papier toilette, lessive… reviennent d'eux-mêmes dans la liste au bon rythme, appris des achats notés et des factures du drive. Ce que font les autres apps sur ce point n'a pas été vérifié : comparaison `[DONNÉE_MANQUANTE]`, notes du tableau inchangées. Utilité à confirmer par l'usage sur quelques semaines.

**V3.8 (26 octobre 2026) — écarts comblés là où c'est possible.** Photos libres des plats (Wikilivres et Commons, auteur cité) sur les cartes du menu, les idées et les fiches : 110 recettes sur 424, moins nombreuses et moins régulières que les photos de studio de Jow. Partage à deux quasi instantané (signal mesuré à 7 ms sur le vrai relais), comme AnyList et Mealie, mais seulement app ouverte (limite des apps web sur iOS). Rappel « Ce soir » quotidien et pastille sur l'icône. Restent hors d'atteinte : panier rempli en un clic (partenariats commerciaux de Jow), widgets et Apple Watch (AnyList, app native). Notes du tableau inchangées tant que l'usage réel sur iPhone ne les a pas confirmées.

## Ce qui ferait passer Foyer devant partout

1. ~~Activer le relais~~ : fait le 4 octobre 2026 (projet Supabase dédié) ; synchro automatique et import web sont en service.
2. **Deux semaines d'usage réel** à deux sur iPhone, et corriger ce qui gêne (`PLAN.md`, étape C).
3. Puis, selon ce que l'usage montre : photos des plats, synchro instantanée.

## Sources consultées le 25 octobre 2026 (V3.5)

- Sears et Shneiderman, « Split menus: effectively using selection frequency to organize menus » (1994) : https://www.cs.umd.edu/~ben/papers/Sears1994Split.pdf
- Findlater et McGrenere, « A comparison of static, adaptive, and adaptable menus » (CHI 2004) : https://www.cs.ubc.ca/labs/edapt/papers/findlater2004.pdf
- Gajos et al., interfaces adaptatives (AI Magazine 2009) : https://kgajos.seas.harvard.edu/papers/AIMag09-AUIs.pdf
- Paprika Recipe Manager 3 (App Store) : https://apps.apple.com/us/app/-/id1303222868
- Mealime, recettes favorites : https://support.mealime.com/article/104-favorite-recipes

## Sources consultées le 4 octobre 2026

- AnyList : https://help.anylist.com/articles/getting-started/ · https://www.anylist.com/ · comparatif https://thegourmethost.com/the-gourmet-host-vs-anylist-better-grocery-lists-for-hosts-2026/
- Paprika : https://www.paprikaapp.com/ · https://www.paprikaapp.com/help/ios/
- Mealie : https://mealie.io/ · https://github.com/mealie-recipes/mealie · https://cooklang.org/blog/40-mealie-review/
- Jow : https://jow.fr/ · fiche App Store Jow · https://jow.fr/blog/posts/ajoutez-vos-propres-recettes-sur-jow
- Auchan : https://www.auchan.fr/parcours-de-courses-jow/ep-parcours-de-courses-jow · CGU https://www.auchan.fr/cgu/ep-cgu · recherche vérifiée https://www.auchan.fr/recherche?text=blanc%20de%20poulet
- Mealime (fermeture) : https://www.foodieprep.ai/blog/meal-planning-apps-with-builtin-grocery-lists-a-2026-sidebyside-review
