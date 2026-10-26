# Teardown — Jow · Menu de la semaine et panier

| | |
|---|---|
| Date | 2026-10-26 (ouverture du dossier ; constats en attente des vidéos) |
| Cible | App Jow (iPhone), version `[DONNÉE_MANQUANTE : version, visible dans Réglages › Général › Stockage iPhone › Jow]` |
| Base légale | **C** — Julien utilise Jow avec son propre compte ; observation du fonctionnement par un utilisateur légitime (CPI L122-6-1 III, directive 2009/24 art. 5(3)) |
| Techniques utilisées | Observation de l'app en marche, d'après des vidéos d'écran tournées par Julien |
| Techniques exclues | Décompilation de l'app (base C : interdit) ; interception du trafic de l'app iPhone (exigerait de contourner son chiffrement) ; extraction du catalogue, des textes ou des photos de recettes (droit d'auteur et droit des bases de données) |
| REA | Non utilisé : rien à instrumenter, les preuves sont des vidéos |

> Pas un avis juridique. Spécification de comportement en salle blanche : aucun code, texte, nom de recette ni image de Jow n'est
> reproduit ici ni dans Foyer. Les recettes observées sont désignées par leur famille (« recette A, volaille »).

## 1. Résumé
En attente des vidéos V1 à V8 (§8). Objectif : établir les règles par lesquelles Jow compose le menu de la semaine et en tire le
panier, puis décider, règle par règle, ce que Foyer reprend, garde ou fait autrement.

## 2. Questions à trancher

La colonne « Foyer aujourd'hui » est tirée du code (fichier cité), pour que chaque essai départage les deux comportements.

| # | Question | Foyer aujourd'hui | Vidéos | Statut |
|---|---|---|---|---|
| Q1 | Déclencheur : le menu se compose-t-il seul chaque semaine, sur demande, à quel moment ? Combien de repas ? | Sur demande (« Proposer le menu »), repas vides où quelqu'un mange (`propose.ts` proposeWeek) | V1, V2 | NON TRANCHÉE |
| Q2 | Paramètres lus : nombre de personnes, régimes, aversions, ustensiles, budget, magasin, temps ? | Présences par repas, allergies et refus, budget, réglage « Nouveautés » (`propose.ts`, `weekgen.ts`) | V1 | NON TRANCHÉE |
| Q3 | Sélection : fenêtre sans répétition, variété des protéines et des types de plats, saison, ingrédients partagés entre recettes ? | Pas de répétition à moins de 13 jours s'il reste autre chose ; pas deux plats du même genre ; pas la même viande deux jours de suite ; repères poisson et légumes secs (`propose.ts` NO_REPEAT, proposeWeek) ; pas de recherche d'ingrédients partagés | V2, V3, V5 | NON TRANCHÉE |
| Q4 | « Changer une recette » : que propose-t-il à la place (même famille, mêmes ingrédients, même prix) ? Effet sur le panier ? | Alternatives dans l'ordre de préférence habituel (`weekgen.ts` alternativesFor) | V6 | NON TRANCHÉE |
| Q5 | Quantités : mise à l'échelle par personne, arrondi au produit vendu, fusion d'un même ingrédient entre recettes ? | Besoin = quantité × portions / rendement ; somme si même ingrédient, même forme, même dimension ; arrondi à l'unité pour ce qui s'achète à la pièce (`shopping.ts`) ; paquets d'après la contenance saisie par le foyer (`drive.ts`) | V4, V7 | NON TRANCHÉE |
| Q6 | Ce qu'on a déjà : produits de base exclus d'office, « j'ai déjà », reste de paquet réutilisé la semaine suivante ? | Surplus de paquet → « Déjà au placard ? » (`placard.ts`) | V7 | NON TRANCHÉE |
| Q7 | Mémoire d'une semaine à l'autre : recettes cuisinées, notées, favorites, refusées ? Effet sur les propositions suivantes ? | 👍 = favori proposé plus souvent, 👎 = plus jamais proposé (V3.7) | V3 | NON TRANCHÉE |
| Q8 | Cas limites : 1 personne, 8 personnes, exclusions cumulées, aucune recette possible ? | Découvertes seulement si le nombre de personnes est connu ; rien d'inventé | V8 | NON TRANCHÉE |

## 3. Modèle de comportement
### 3.1 Déroulé
En attente des constats.
### 3.2 Règles
En attente des constats. Chaque règle citera ses constats (F-xx).
### 3.3 Forme des données
En attente des constats.
### 3.4 Cas limites et valeurs observées
En attente des constats.

## 4. Registre des constats

| ID | Question | Constat | Confiance | Preuve (vidéo, minutage) | Raisonnement / limite |
|---|---|---|---|---|---|
| — | — | Aucun constat : vidéos non reçues | — | — | — |

Confiance : CONFIRMÉ 0 · DÉDUIT 0 · INCONNU 8 (Q1 à Q8).

Règles du registre : CONFIRMÉ = vu à l'écran, minutage cité ; DÉDUIT = découle de constats cités, raisonnement en une ligne ;
INCONNU = non établi, avec ce qui a été cherché et ce qui le trancherait. Une absence à l'écran n'est jamais un fait négatif.

## 5. Spécification pour Foyer
En attente des constats. Forme prévue : exigences R-xx reliées aux constats ; critères d'acceptation « Étant donné / Quand /
Alors » ; écarts assumés par rapport à Jow et pourquoi. Une exigence qui ne repose que sur des constats DÉDUITS sera marquée
« à valider tôt ». Le code s'écrira ensuite depuis cette spécification, jamais depuis les vidéos.

## 6. Questions ouvertes

| Question | Pourquoi ouverte | Prochaine étape |
|---|---|---|
| Q1 à Q8 | Vidéos non reçues | Tourner V1 à V8 (§8) |
| Version de l'app | Non communiquée | Réglages iPhone › Général › Stockage › Jow |

## 7. Limites
- Observation à l'écran seulement : une règle interne (pondérations, tirage au hasard) ne se voit qu'à travers ses effets ; elle
  restera DÉDUITE au mieux.
- Un compte, une région, une période : les propositions peuvent dépendre de la saison et du magasin choisi.
- Le panier chez le magasin partenaire n'est observé que jusqu'à l'écran du panier, jamais au paiement.

## 8. Protocole de tournage (vidéos d'écran iPhone)

Avant de filmer :
- Activer « Ne pas déranger » (aucune notification à l'image).
- Ne jamais montrer : nom, e-mail, adresse, téléphone, carte de fidélité, moyen de paiement. Si un écran les affiche, passer
  vite ou masquer avant l'envoi. Les vidéos ne sont jamais versées au dépôt ; seul ce dossier, sans données perso, l'est.
- Filmer lentement, faire défiler chaque liste jusqu'au bout, ouvrir chaque écran une seconde au moins.

| Vidéo | Ce qu'on fait | Ce qu'il faut voir | Questions |
|---|---|---|---|
| V1 | Ouvrir tous les réglages du foyer et du menu, sans rien changer | Chaque paramètre et ses valeurs possibles (personnes, régimes, aversions, ustensiles, magasin, budget s'il existe) | Q1, Q2 |
| V2 | Composer le menu de la semaine avec les réglages habituels | Le menu entier ; pour chaque recette, la liste d'ingrédients et le nombre de personnes | Q1, Q3 |
| V3 | Le même menu la semaine suivante (ou « nouveau menu » si possible), réglages identiques | Les recettes qui reviennent ou non ; une recette déjà cuisinée ou notée revient-elle ? | Q3, Q7 |
| V4 | Passer de 2 à 4 personnes (puis revenir), regarder le panier | Les quantités d'un même produit avant / après ; les arrondis | Q5 |
| V5 | Exclure un ingrédient courant (ex. porc ou champignons), recomposer | Ce qui disparaît, ce qui le remplace, la famille des remplaçants | Q3, Q8 |
| V6 | « Changer » une recette du menu, 3 fois de suite | Les 3 propositions de remplacement ; le panier avant / après | Q4 |
| V7 | Ouvrir le panier ou la liste de courses du menu | Un ingrédient présent dans 2 recettes : une ligne ou deux ? Produits de base (sel, huile) : présents ou non ? « J'ai déjà » ? | Q5, Q6 |
| V8 | 1 personne, puis végétarien + une aversion | Nombre de recettes proposées ; message si rien ne convient | Q8 |

Durée visée : 1 à 3 minutes par vidéo. Envoyer les vidéos dans la conversation ; chaque constat citera la vidéo et le minutage.
