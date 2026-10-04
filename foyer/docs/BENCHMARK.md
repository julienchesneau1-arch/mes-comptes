# Foyer face aux meilleures apps — bilan sans complaisance

**4 octobre 2026.** Fonctions des concurrents vérifiées ce jour sur leurs pages officielles ou des sources publiques (liens en bas). Ce qui n'a pas été vérifié est marqué « ? ». Notes sur 5, pondérées par ce qui retire de la charge mentale à deux (poids total 20). **Les notes sont attribuées par l'auteur de Foyer : biais possible.** Celles de Foyer reposent sur des tests exécutés en navigateur (Chromium), **pas encore sur iPhone** ; l'usage réel tranchera.

## Tableau

| Critère (poids) | AnyList | Paprika | Mealie | Jow | Foyer V2.1 (avant) | **Foyer V2.6** |
|---|---|---|---|---|---|---|
| Décider quoi manger (×3) | 2 — calendrier manuel | 2 — manuel | 3 — tirage au hasard | **5** — menu proposé dans 5 000+ recettes | 4 — propositions expliquées depuis vos plats | **4,5** — + variété des viandes, réutilisation des produits frais, DLC, jusqu'à 3 découvertes Wikilivres par semaine |
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
- **Petit catalogue** : 423 recettes du Livre de cuisine de Wikilivres (139 proposables d'office), de qualité inégale, contre plus de 5 000 recettes testées chez Jow. Aspirer Marmiton est interdit (CGU, droit des bases de données) et inventer des recettes est exclu. Compensé par l'import d'une adresse web, qui reprend les recettes des sites que vous utilisez déjà.
- **Notifications livrées mais pas encore vues sur un iPhone ; pas de widget.** Rappels chiffrés envoyés par le relais (Web Push, iOS 16.4+, Foyer installé) ; vérifiés côté serveur, pas sur un vrai téléphone. Une app web n'a ni widget ni Apple Watch. Les rappels dans l'agenda (.ics) restent disponibles.
- **Pas de recul d'usage.** AnyList existe depuis 2012. Foyer n'a jamais été utilisé sur vos téléphones : c'est le seul vrai juge (`PLAN.md`, étape C).
- **Pas de panier rempli en un clic.** Jow le fait grâce à des partenariats commerciaux avec les enseignes (page « Auchan x Jow » sur auchan.fr), y compris pour vos propres recettes. Aucune API publique de panier Auchan trouvée, et les CGU d'auchan.fr (12/06/2026) interdisent les robots d'extraction sauf licence écrite. Foyer ouvre donc la page du bon produit et calcule le nombre de paquets ; l'ajout au panier reste un geste sur Auchan. Jow reste la meilleure option si le clic unique prime sur le reste.
- **Synchro toutes les 20 s, pas instantanée.** Suffisant à deux ; le temps réel par websocket est possible plus tard sur le même relais.

**À noter.** D'après un comparatif publié par foodieprep.ai, Mealime ferme le 21 octobre 2026 sans export des données. C'est précisément le risque que Foyer évite : vos données restent sur vos téléphones, exportables en JSON à tout moment.

## Ce qui ferait passer Foyer devant partout

1. ~~Activer le relais~~ : fait le 4 octobre 2026 (projet Supabase dédié) ; synchro automatique et import web sont en service.
2. **Deux semaines d'usage réel** à deux sur iPhone, et corriger ce qui gêne (`PLAN.md`, étape C).
3. Puis, selon ce que l'usage montre : photos des plats, synchro instantanée.

## Sources consultées le 4 octobre 2026

- AnyList : https://help.anylist.com/articles/getting-started/ · https://www.anylist.com/ · comparatif https://thegourmethost.com/the-gourmet-host-vs-anylist-better-grocery-lists-for-hosts-2026/
- Paprika : https://www.paprikaapp.com/ · https://www.paprikaapp.com/help/ios/
- Mealie : https://mealie.io/ · https://github.com/mealie-recipes/mealie · https://cooklang.org/blog/40-mealie-review/
- Jow : https://jow.fr/ · fiche App Store Jow · https://jow.fr/blog/posts/ajoutez-vos-propres-recettes-sur-jow
- Auchan : https://www.auchan.fr/parcours-de-courses-jow/ep-parcours-de-courses-jow · CGU https://www.auchan.fr/cgu/ep-cgu · recherche vérifiée https://www.auchan.fr/recherche?text=blanc%20de%20poulet
- Mealime (fermeture) : https://www.foodieprep.ai/blog/meal-planning-apps-with-builtin-grocery-lists-a-2026-sidebyside-review
