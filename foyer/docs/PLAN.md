# Foyer — plan d'exécution et état réel

**4 octobre 2026.** Statuts : **livré** (fait et vérifié par un test exécuté), **partiel**, **bloqué**, **à mesurer** (exige une observation réelle à deux, non simulable).

## 1. Où on en est

| Étape (PRD V2 §19) | Statut | Preuve |
|---|---|---|
| 1. Audit court | **livré** | Dépôt `mes-comptes` inspecté ; Savore et Meal Planner n8n non accessibles (`PRD_V2.1.md` §1) |
| 2. Parcours vertical EX-01 | **livré** | Recette → plat posé → semaine → courses → persistance : tests unitaires + scénario navigateur |
| 3. Fiabilisation V1A | **livré** (sauf limites §4) | 34 tests unitaires, 2 scénarios navigateur, voir §2 |
| 4. Recette d'usage à deux | **à mesurer** | Nécessite Julien et Lauriane sur leurs iPhone (§3) |
| 5. V1B OCR | **bloqué** | Dépôt Savore inaccessible ; non recommandé avant mesure (`PRD_V2.1.md` §7) |
| 6. Décision sur la suite | **à mesurer** | Critères §3 |

## 2. Recette bloquante V1A (PRD V2 §16) — résultats des tests exécutés

Commandes : `cd foyer && npm ci && npm run check` (compilation stricte, typage des tests, 34 tests). Scénarios navigateur : Chromium, format téléphone 390×844 et ordinateur 1280×900, avec contrôle axe-core WCAG 2.0/2.1/2.2 A et AA (outillage hors dépôt, résultats ci-dessous).

| Exigence | Statut | Comment c'est prouvé |
|---|---|---|
| EX-01 à EX-05 | **livré** | `tests/examples.test.ts`, `tests/examples2.test.ts` : sorties exactes (600 g / 300 g / 400 ml ; 900/450/600 ; 200 g → 700 g ; rendement 3 ; DLC 8 vs 9 ; déplacement mercredi ; Tacos partiel ; copie sans états) |
| Unités | **livré** | g/ml/pièces/cru séparés ; seulement conversions exactes intra-dimension (`basics.test.ts`) |
| Incomplétude | **livré** | Plat sans ingrédients autorisé, liste « partielle » nommant le plat |
| Placards | **livré** | Vérification invalidée si le besoin change ; aucune déduction héritée la semaine suivante |
| Portions | **livré** | Rien de disponible avant « C'est préparé » ; pas de double consommation ; jamais de stock négatif ; correction incompatible refusée |
| Concurrence | **livré** | Deux téléphones prennent la dernière portion : une seule réservation, même conflit affiché des deux côtés ; deux plats posés sur un même créneau : le second est signalé, pas écrasé ; rejeu indépendant de l'ordre de réception |
| Proposition obsolète | **partiel** | Code : aperçu recalculé si le journal a changé (`pvApply`) ; non couvert par un test automatique |
| Imprévu | **livré** | Retirer un repas : portions préparées conservées, article déjà pris conservé ; échange vérifié des deux côtés ; bug trouvé et corrigé (échange avec la boîte dépendante) |
| Dates | **livré** | DLC dépassée signalée ; ouvert ou date inconnue = « non évalué », jamais compatible ; DDM au mois gardée au mois |
| Temps | **livré** | Date de Paris stable autour de minuit et aux deux changements d'heure 2026 |
| Accès | **livré** | Lien chiffré : mauvais code refusé, autre foyer refusé, événements piégés (XSS, trop longs) écartés ; aucune connexion sortante (CSP testée) |
| Persistance | **livré** | Rechargement : journal identique octet pour octet (scénario navigateur) |
| Restauration | **livré** | Export → import sur appareil vierge : mêmes liens, quantités, portions (`sync.test.ts`) |
| Ergonomie | **partiel** | axe : **0 violation** sur 11 écrans ; clavier seul (ouvrir un créneau, Échap, focus rendu) ; déplacer par bouton ; zoom 200 % sans débordement horizontal ; contraste ≥ 4,5:1 calculé en clair et sombre. **VoiceOver réel et Safari iOS réel non testés** |
| Synchro réelle | **livré** | Deux navigateurs : lien de 0,8 Ko, code faux refusé, même liste des deux côtés, absence de Sam → 450 g de poulet chez les deux |

### V2.2 (rattrapage des meilleures apps, `BENCHMARK.md`)

| Fonction | Statut | Preuve |
|---|---|---|
| Synchro automatique chiffrée, rejoindre par le code | **prêt, non activé** | Protocole testé contre un serveur local qui reproduit l'API Supabase et la RLS (`relay.test.ts`) ; parcours complet à deux téléphones sur relais simulé (`e2e/synchro-auto.mjs`) : rejoindre par code, mêmes courses, coche propagée, rien en clair. **Non testé contre le vrai Supabase** : le projet n'existe pas encore |
| Import d'une adresse web | **prêt, non activé** | Extracteur testé sur 5 variantes schema.org (`web.test.ts`) ; parcours d'import dans l'app sur fonction simulée. **Non testé sur les vrais sites** : accès réseau bloqué depuis cet environnement |
| Glisser-déposer + aperçu | **livré** | Navigateur : fantôme, cible, aperçu « ce midi : rien → curry » |
| Varier / réutiliser dans les propositions | **livré** | Test : pas de poulet deux jours de suite ; le gratin remonte car il reprend la crème de la tarte |
| Qui cuisine, ordre des rayons, mode magasin, agenda .ics, saisie assistée, conseil d'installation iPhone | **livré** | Tests unitaires (ics, rayons, cuisinier) + navigateur (fichier .ics téléchargé, rayons réordonnés, mode magasin) ; axe : 0 défaut |

Zéro erreur console sur l'ensemble des scénarios navigateur.

## 3. Plan concret pour la suite

**Étape A — Mise en service (Julien, ~10 min)**
1. Fusionner la branche dans `main` : GitHub Pages publie `https://julienchesneau1-arch.github.io/mes-comptes/foyer/`.
2. Sur chaque iPhone : ouvrir l'adresse dans Safari → Partager → « Sur l'écran d'accueil ». iOS 16.4 minimum (compression des liens).
3. Téléphone 1 : créer le foyer. Puis Aujourd'hui → « Envoyer le lien ».
4. Téléphone 2 : copier le lien reçu → ouvrir Foyer depuis l'écran d'accueil → « L'autre téléphone a déjà Foyer » → Coller → taper le code (Maison › Réglages › Synchro sur le téléphone 1).

**Étape B — Première semaine (charge minimale)**
- Toucher 10 à 15 classiques à la création. Compléter les ingrédients **seulement** des 5 plats les plus fréquents (« Coller une recette » accepte un texte de notes ou de site).
- Étiqueter « rapide », « week-end », « plat entier » : c'est ce qui rend les propositions justes.
- Dimanche : Semaine → « Proposer les repas vides » → ajuster → Courses → « Partager ».

**Étape C — Mesure sur 2 puis 4 semaines (critères V2 §18, inchangés)**
À noter chaque dimanche, une ligne : temps de planification, blocages, saisies abandonnées, soirs sans plan, liens de synchro échangés.
- Objectifs de conception (non acquis) : repas du soir et action suivante en ≤ 30 s ; absence modifiée en ≤ 30 s ; planification de la semaine ≤ 10 min.
- Arrêt d'une extension si elle crée une saisie régulièrement abandonnée.

**Étape D — Décisions conditionnelles**
| Décision | Déclencheur mesuré | Contenu |
|---|---|---|
| Activer le relais (synchro auto + import web) | **Construit (V2.2)** ; activation dès votre accord | Projet Supabase gratuit dédié « foyer » (2ᵉ projet gratuit de votre organisation, Assemblages non touché) : migration `supabase/migrations/`, fonction `foyer-import`, adresse dans `src/ui/config.ts` et `index.html` |
| V1B OCR des dates | Plus de 5 produits surveillés par semaine **et** saisie de date ressentie comme un frein | Audit Savore (accès au dépôt requis), corpus réel, confirmation champ par champ |
| Rappels hors de l'app | Tâches « la veille » oubliées malgré Aujourd'hui | Fichier agenda (.ics) des tâches de la semaine, comme Mes Comptes ; notifications iOS impossibles sans serveur |

## 4. Limites connues (assumées, documentées)

- Tant que le relais n'est pas activé : synchro **manuelle** par lien (le compteur « N changements pas encore envoyés » le rappelle). Relais activé : automatique toutes les 20 s, pas instantané.
- Projet Supabase gratuit : mis en pause après une semaine sans aucune activité ; Foyer continue alors en local et par lien.
- Le lien contient tout le journal (≈ 1 Ko au départ, quelques dizaines de Ko après des mois) ; compactage non fait.
- Un seul navigateur testé (Chromium). Safari iOS et VoiceOver restent à vérifier sur les téléphones.
- Glisser-déposer non implémenté (le bouton « Déplacer » est l'interface obligatoire du PRD).
- Rayon « Tomates » en boîte classé « Fruits & légumes » par défaut : un geste pour le changer, mémorisé.

## 5. Journal de session

| Horodatage | Catégorie | Action | Statut | Risque résiduel |
|---|---|---|---|---|
| 2026-10-04 | Audit | Dépôt, CI, Pages, Mes Comptes inspectés ; Savore/n8n inaccessibles | livré | Reprise Meal Planner non automatisée |
| 2026-10-04 | Spécification | PRD V2.1 : 9 incohérences corrigées, 9 ajouts | livré | Hypothèses d'usage non mesurées |
| 2026-10-04 | Cœur | Fractions exactes, unités, parser, journal rejoué, portions, courses | livré | — |
| 2026-10-04 | Synchro | AES-GCM + PBKDF2, fusion idempotente, restauration | livré | Synchro manuelle |
| 2026-10-04 | Interface | 4 écrans, une vingtaine de feuilles, accueil, découverte, mode cuisine | livré | Safari iOS non testé |
| 2026-10-04 | Vérification | 34 tests, 2 scénarios navigateur, axe 0 violation | livré | VoiceOver non testé |
| 2026-10-04 | Isolation | Service worker de Mes Comptes limité à ses caches | livré | — |
| 2026-10-04 | Comparatif | AnyList, Paprika, Mealie, Jow, Mealime vérifiés en ligne ; notes pondérées | livré | Notes attribuées par l'auteur |
| 2026-10-04 | V2.2 | Glisser-déposer, variété/réutilisation, qui cuisine, rayons, mode magasin, agenda | livré | iPhone non testé |
| 2026-10-04 | V2.2 | Relais chiffré + import web (code, migration, fonction, tests simulés) | prêt, non activé | Supabase réel non testé |
