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
| Synchro automatique chiffrée, rejoindre par le code | **en service** | Projet Supabase dédié `foyer` (Paris, eu-west-3). Vérifié sur le vrai relais : dépôt accepté (201) ; la bonne étiquette relit son bloc ; autre étiquette ou aucune → liste vide ; lecture de la colonne étiquette, suppression, appel sans clé → refusés (401) ; conseiller de sécurité Supabase : 0 alerte. Protocole aussi testé contre un serveur local qui reproduit l'API et la RLS (`relay.test.ts`) et parcours à deux téléphones sur relais simulé (`e2e/synchro-auto.mjs`) : rejoindre par code, mêmes courses, coche propagée, rien en clair |
| Import d'une adresse web | **en service** | Fonction `foyer-import` déployée. Vraies pages : Marmiton (nom, 3 personnes, 9 ingrédients, 5 étapes) et 750g ; le test réel a révélé un défaut (accents encodés deux fois sur 750g : « &amp;eacute; »), corrigé avec test de régression. Clé absente ou fausse → 401 ; adresse IP (métadonnées cloud) → 400. Extracteur testé sur 5 variantes schema.org (`web.test.ts`) |
| Glisser-déposer + aperçu | **livré** | Navigateur : fantôme, cible, aperçu « ce midi : rien → curry » |
| Varier / réutiliser dans les propositions | **livré** | Test : pas de poulet deux jours de suite ; le gratin remonte car il reprend la crème de la tarte |
| Qui cuisine, ordre des rayons, mode magasin, agenda .ics, saisie assistée, conseil d'installation iPhone | **livré** | Tests unitaires (ics, rayons, cuisinier) + navigateur (fichier .ics téléchargé, rayons réordonnés, mode magasin) ; axe : 0 défaut |

### V2.3 (commande au drive Auchan, sans faux-semblant)

| Fonction | Statut | Preuve |
|---|---|---|
| Commander chez Auchan, article par article | **livré** | Courses → « Commander chez Auchan » : page du produit retenu (sinon recherche Auchan), « Ajouté au panier » coche l'article sur les deux téléphones. Navigateur : « Article 1 sur 5 · Poulet · 600 g · 2 × 300 g », passage à l'article 2 ; axe : 0 défaut. Aucune page Auchan ouverte pendant les tests |
| Produit retenu + nombre de paquets | **livré** | 5 tests (`drive.test.ts`) : lien Auchan normalisé, tout autre site refusé ; contenance « 300 g », « 4 x 125 g », « 6 pièces » ; 450 g à acheter en paquets de 300 g → 2 ; besoin en grammes et contenance en pièces → pas de nombre inventé ; produit partagé entre les deux téléphones |
| Panier rempli en un clic (comme Jow) | **non fait, volontairement** | Jow passe par des partenariats avec les enseignes ; aucune API publique de panier Auchan trouvée ; CGU d'auchan.fr : robots d'extraction interdits sauf licence écrite |

### V2.4 (propositions à la Jow, sans aspirer ni inventer)

| Fonction | Statut | Preuve |
|---|---|---|
| Catalogue Wikilivres (CC BY-SA 4.0) | **livré** | Généré en CI par l'API officielle : environ 1 500 pages lues, 423 recettes retenues, 139 avec nombre de personnes. Lecteur testé sur de vraies pages (personnes, quantités en lettres ou entre parenthèses, ustensiles écartés, desserts et bases reconnus) ; test du fichier publié (relu sans rejet, attribué) |
| Découvertes dans « Proposer la semaine » | **livré** | Tests : 3 au plus, familles variées, jamais sans nombre de personnes, une seule quand vos plats suffisent, déterministe ; accepter ajoute le plat avec sa source et les courses le comptent |
| « Découvrir des recettes » | **livré** | Navigateur : filtre, recherche, aperçu, ajout refusé tant que le nombre de portions manque ; axe : 0 défaut |
| Aspirer Marmiton | **non fait, volontairement** | CGU de Marmiton (base de données non reproductible) ; droit des producteurs de bases de données |

### V2.5 (rappels en notification sur le téléphone)

| Fonction | Statut | Preuve |
|---|---|---|
| Rappels : tâche de la veille (19 h), boîte à préparer, semaine suivante vide (dimanche 18 h) | **livré** | 5 tests (`push.test.ts`) : heures exactes de part et d'autre du changement d'heure ; identifiants stables ; le passé jamais renvoyé |
| Contenu chiffré, illisible pour le serveur | **livré** | Test : rappel chiffré avec la clé du foyer, relu par l'app **et par le service worker publié** ; autre clé → rien ; dépôt au relais sans aucun mot en clair |
| Envoi serveur (Web Push VAPID, notification vide) | **en service** | Fonction `foyer-push` déployée, appelée toutes les 5 min (`pg_cron`, 1ʳᵉ exécution 18:10 UTC : 200). Vrai serveur : rappel échu marqué envoyé, jeton VAPID signé, envoi effectué, abonnement expiré (410) retiré ; abonnement vers une adresse non Apple/Google/Mozilla/Microsoft → 400 ; autre foyer → 401 ; fonctions serveur appelées par le public → 401 ; rappel déjà envoyé non effaçable, rappel à venir effaçable ; relecture par le service worker : seuls les rappels envoyés de son foyer |
| Bouton « Activer les rappels » | **livré** | Navigateur : permission refusée → message clair (« Réglages de l'iPhone › Notifications › Foyer »), rien d'activé ; axe : 0 défaut |
| Réception réelle sur iPhone | **à vérifier** | Impossible ici (pas d'iPhone ; le navigateur de test ne s'abonne pas). Geste 11 ci-dessous |

### V2.6 (l'agenda du mois ajuste les repas ; prise en main)

| Fonction | Statut | Preuve |
|---|---|---|
| Lecture d'agendas iCalendar (Google, iCloud, Outlook) | **livré** | 5 tests (`ical.test.ts`) : récurrences hebdomadaires, mensuelles (« 2ᵉ jeudi », « dernier vendredi »), annuelles, nombre d'occurrences, date de fin, un sur deux ; exception (EXDATE) ; occurrence déplacée qui garde son identifiant ; changement d'heure du 25 octobre ; journées entières ; fuseau Windows (Outlook) ; fuseau inconnu signalé ; ce qui n'est pas compris écarté avec sa raison. Vrai agenda Google public (jours fériés, 209 événements, 82 Ko) lu sur le serveur sans rejet |
| Fonction `foyer-agenda` | **en service** | Déployée ; code en ligne identique au dépôt (sha256 comparés) ; même code de lecture que l'app (copie vérifiée par un test). Fournisseurs autorisés seulement (adresse interne → 400), mauvaise clé → 401, adresse secrète fausse → 404 avec message clair, redirections revérifiées, 12 Mo et 12 s au plus, période ≤ 62 jours (refus testé), rien d'enregistré. Relecture critique : un agenda ancien et chargé (8 150 événements, 150 récurrences depuis 2015) prenait 23 s de calcul, au-delà du plafond d'une fonction ; corrigé (0,5 s), test de non-régression |
| Agenda → repas | **livré** | 6 tests (`agenda.test.ts`) : foot à l'heure du dîner (à confirmer), resto, télétravail (midi à la maison), vacances de plusieurs jours, invités (nombre demandé), « disponible » et journées sans absence ignorés, repas commencé jamais touché ; une décision puis automatique ; deux téléphones qui appliquent en même temps : rien en double ; événement supprimé → retour à l'habitude ; lecture ratée → rien de défait ; réglage à la main prioritaire ; « jamais » et « pas cette fois » ; deux événements sur un même repas : un seul gagne, pas de va-et-vient ; plat décalé quand plus personne ne le mange (dans le même geste, ou ensuite quand deux téléphones ont appliqué chacun le sien) |
| Jours fériés | **livré** | Calculés (Code du travail, art. L3133-1 ; Pâques vérifié 2024-2027) ; férié en semaine → « midi à la maison » proposé ; une décision vaut pour tous les fériés |
| Écrans agenda | **livré** | Navigateur (fonction simulée) : brancher un agenda (adresse webcal convertie, appel vérifié), « Ce que l'agenda change », Appliquer + « pareil les prochaines fois », « Pas cette fois », « Fait d'après l'agenda » avec Annuler, bandeau d'Aujourd'hui disparu ; axe : 0 défaut. Deux défauts trouvés et corrigés : deux boutons « agenda » en collision (test ajouté sur tous les gestionnaires), feuille rouverte aussitôt fermée qui n'était plus rafraîchie |
| Prise en main | **livré** | « Premiers pas » sur Aujourd'hui (gestes cochés d'après l'état réel), « Comment ça marche » (8 explications), libellés clarifiés (« Restes à venir », « Préparé »), accueil corrigé (« sans serveur » n'était plus vrai) ; navigateur + axe : 0 défaut |
| Lire l'agenda de l'iPhone directement | **non fait, impossible** | Une app web n'a pas accès au Calendrier de l'iPhone : il faut l'adresse iCal (Google) ou le lien « Calendrier public » (iCloud) |

### V2.7 (refonte visuelle ; propositions en cartes à la Jow)

| Fonction | Statut | Preuve |
|---|---|---|
| Direction artistique vive | **livré** | Palette tomate / soleil / basilic / océan, police ronde Nunito (OFL, 39 Ko, servie par l'app : CSP inchangée), barre d'onglets flottante, nouvelle icône. Contraste du texte ≥ 4,5:1 vérifié par test en clair et en sombre ; axe : 0 défaut en clair et en sombre (Aujourd'hui, Semaine, cartes, Courses) |
| Visuel de chaque plat | **livré** | Emoji + fond coloré par famille de plat, choisi par règles fixes (nom puis ingrédients), sans photo ni téléchargement ; test : les classiques ont un visuel parlant, stable |
| Propositions en cartes | **livré** | « Proposer le menu » : une carte par repas ; glisser à droite / ❤ = je prends, à gauche / ↻ = autre idée (vos plats puis les découvertes), ✕ = pas de plat ; « Garder tout le menu » ; récapitulatif (plats, restes, nombre d'articles de courses) puis « Valider la semaine » et confettis. Navigateur : autre idée change le plat, geste de la souris vers la droite → carte suivante, validation ; flèches du clavier ; animations coupées si l'appareil le demande |
| Aujourd'hui en 10 secondes | **livré** | Grande carte illustrée pour le prochain repas, une action principale (« ✨ Trouver une idée » si rien n'est prévu : une carte d'idée à la fois), idées en carrousel, « Bonjour/Bonsoir » ; actions secondaires de la semaine rangées sous « Plus d'options » |
| Défauts trouvés et corrigés | **livré** | Bouton « Pas de plat » invisible (classe en collision avec le lien d'évitement) ; style écrit dans le HTML refusé par la CSP (barre de progression) ; animations d'entrée avec transparence qui faussaient le contrôle de contraste ; police absente d'un scénario de test (copie de fichiers incomplète) |
| Photos de plats | **non fait** | Pas de source de photos libre et fiable pour vos propres plats ; possible plus tard avec vos photos (stockées sur le téléphone) |

Zéro erreur console sur l'ensemble des scénarios navigateur.

### V2.8 (rituel batch du week-end ; économies visibles)

| Fonction | Statut | Preuve |
|---|---|---|
| Rituel de la semaine | **livré** | Maison › Réglages › Rituel batch (ou carte « Batch cooking le dimanche ? » sur Aujourd'hui) : courses finales un jour et une heure (samedi 17 h par défaut), batch un autre (dimanche 9 h). Événement `settings.set` (`ritual`), validé strictement ; tests unitaires |
| Plats cuisinés au batch | **livré** | Événement `prep.batch` : un plat est cuisiné le jour du batch et mangé plus tard ; refusé si le batch tombe après le repas ou si le plat est déjà préparé ; un plat déplacé avant son batch en sort. Menu en cartes : pastille « 👩‍🍳 Batch » sur les repas des 5 jours suivant le batch, à décocher dans le récapitulatif ; plats étiquetés « batch » mis en avant pour ces repas. Navigateur : 4 plats au batch, 1 retiré, 3 marqués dans la semaine |
| Feuille du batch | **livré** | Plats, portions, boîtes à remplir avec leur jour et leur J+n, mise en place commune (fruits et légumes de tous les plats additionnés), ingrédients partagés, courses du batch ; le jour J : « C'est prêt » d'un geste par plat, progression, célébration. Conservation non évaluée : J+n affiché, repère officiel ANSES en lien |
| Aujourd'hui selon le rituel | **livré** | Avant : « Batch dimanche : quels plats ? » ou « le menu d'abord » ; jour des courses : articles à commander, panier estimé, « Commander au drive » ; jour du batch : « C'est l'heure du batch ! ». Tâches « la veille » rapportées au jour du batch ; « Pas encore pris » regroupe les ingrédients du batch |
| Rappels du rituel | **livré** | Notification le jour des courses à l'heure choisie (« 🛒 Courses du batch à commander » ou « 🗓️ Menu à choisir avant les courses ») et le jour du batch (« 👩‍🍳 Batch cooking aujourd'hui : 4 plats · 16 portions ») ; remplace « semaine suivante vide ». Tests : heures exactes, tâche la veille du batch |
| Prix et budget | **livré** | Prix d'un paquet noté une fois sur le produit retenu (jamais lu sur Auchan) → « 6 × 4,99 € = 29,94 € » au drive, panier estimé (« ≥ » tant que des articles n'ont pas de prix), coût par portion, budget hebdomadaire avec jauge, montant payé noté après le drive (`shop.spent`). Montants en centimes entiers |
| Bilan | **livré** | Maison › Bilan : payé sur 4 semaines, coût par portion réel (payé ÷ portions cuisinées), portions cuisinées, jetés, batchs d'affilée ; tableau des 8 dernières semaines (navigable au clavier) |
| Défauts trouvés et corrigés | **livré** | Carrousel d'idées (V2.7) qui élargissait Aujourd'hui à 498 px sur téléphone (élément de grille sans `min-width: 0`) ; deux pastilles superposées sur une carte ; un plat déjà préparé laissait ses ingrédients dans « Pas encore pris » ; scénario « deux téléphones » dépendant de l'heure du test (horloge figée) |
| Nouveau scénario navigateur | **livré** | `e2e/rituel.mjs`, horloge figée samedi puis dimanche : rituel activé, menu, feuille du batch, drive avec prix, budget, payé, bilan, séance jusqu'à la célébration ; axe 0 défaut en clair et en sombre |

### V2.9 (aucune redondance, un maximum de nouveautés ; moins de charge mentale)

| Fonction | Statut | Preuve |
|---|---|---|
| Maximum de nouveautés | **livré** | Réglage « Propositions de repas » (Maison › Réglages, et pastille dans le menu en cartes) : **Maximum de nouveautés** (par défaut), Équilibré, Surtout nos plats ; événement `settings.set` (`variety`), validé strictement. En maximum : une recette du catalogue jamais cuisinée à chaque repas tant qu'il en reste, vos plats ensuite ; les pages sans nombre de personnes deviennent proposables, le nombre (2, 4 ou 6) se choisit dans le récapitulatif et s'enregistre avec la recette. Test : 7 découvertes distinctes sur un catalogue de 7, vos 2 plats complètent |
| Aucune redondance | **livré** | Jamais deux fois le même plat dans la semaine ; un plat prévu il y a moins de 13 jours laisse sa place s'il reste autre chose ; un plat du même genre (pâtes, gratin, curry… par règles fixes) déjà dans la semaine passe derrière ; une découverte déjà montrée sur ce téléphone depuis moins de 8 semaines passe en dernier ; les idées d'Aujourd'hui suivent les mêmes règles. Tests unitaires dédiés |
| Équilibre de la semaine | **livré** | Carte sous la semaine (dès 3 repas prévus) : poisson 2 fois dont 1 gras, légumes secs au moins 2 fois, viande hors volaille 500 g au plus et charcuterie 150 g au plus, **par personne** (celle qui en mange le moins pour le poisson, le plus pour la viande), d'après les ingrédients des plats prévus ; sources Santé publique France en lien. Les propositions remontent ce qui manque (« poisson de la semaine ») et descendent la viande au-delà de 4 repas. Une quantité absente est signalée, jamais devinée |
| Durées et ordre du batch | **livré** | Préparation et cuisson facultatives sur une recette ; lues à l'import web (`prepTime`, `cookTime` de schema.org ; fonction `foyer-import` redéployée, version 3). Feuille du batch : « Par quoi commencer » (une personne prépare à la suite, les cuissons tournent en même temps, la plus longue d'abord) et l'heure de fin estimée ; rien d'affiché si une durée manque (plats listés) |
| Synchro en magasin | **livré** | Toutes les 5 s en mode magasin (20 s sinon) ; l'écran n'est redessiné que si quelque chose change (une section ouverte reste ouverte) |
| Clarté (audit novice) | **livré** | Revue par un agent jouant un couple novice : clarté 4/10, charge mentale 5/10, 8 défauts. Corrigés : Aujourd'hui réduit à une action principale (« ✨ Compléter cette semaine (N repas) » ou « ✨ Choisir les repas du 12 au 18 oct. ») et une seule étape des premiers pas ; plat du batch affiché « 👩‍🍳 Cuisiné au batch dim. » au lieu de « À cuisiner » ; « 🛒 Commander au drive » en tête des courses ; après le montant payé, « Tout est arrivé du drive ? Oui, tout cocher » ; quantités à l'unité arrondies (« 2 pièces », « il en faut 1,5 pièce ») ; lignes sans quantité regroupées ; panier estimé montré seulement si 80 % des prix sont connus ; vocabulaire du batch simplifié (plus de J+n ni de « mise en place ») ; prix au drive replié (facultatif) ; « ajouté à vos plats (pas encore au menu) ». Notes après correction non mesurées |
| Défauts trouvés et corrigés | **livré** | « D’ail », « D’huile d’olive » dans les courses (apostrophe typographique du catalogue non retirée : test ajouté) ; « 1,5 pièces » (pluriel français à partir de 2) ; synchro périodique qui refermait les sections ouvertes |

### V3.0 (rien à saisir, le panier suit le menu, qualité-prix)

| Fonction | Statut | Preuve |
|---|---|---|
| Prix sans saisie | **livré** | Champ « prix d'un paquet » retiré. Panier estimé avec le prix relevé du produit conseillé (Open Prices), sinon le prix moyen Insee du mois (`prix.json`, 53 séries : 41 relevées chaque mois, 12 arrêtées fin 2019 et actualisées par l'indice des prix de leur famille ; légumes à la pièce pesés avec le poids moyen USDA). Le montant dit combien d'articles il couvre (« au moins 7,98 € · 10 articles chiffrés sur 29, hors sel et épices »). Un prix noté avant la V3.0 reste prioritaire. Tests sur données Insee réelles |
| Le panier suit le menu | **livré** | Après « Valider la semaine » : feuille « Panier prêt » (articles, estimation, « Remplir le panier Auchan »). Si le menu change après des articles mis au panier : carte « Panier Auchan à mettre à jour » sur Courses et Aujourd'hui (＋ à ajouter, − en trop, plus au menu), « Ajouter les manquants » relance la commande guidée sur l'écart seul, « Retiré » / « Tout est à jour » pour le reste. Ce qui s'achète à l'unité compare des unités entières (1,75 oignon reste couvert par les 2 pris). Navigateur : tout au panier, une portion de plus, mise à jour proposée puis faite |
| Qualité-prix | **livré** | `produits.json` (31 groupes d'ingrédients → catégorie Open Food Facts, produits vendus chez Auchan, nom du produit contrôlé) : points Nutri-Score (A +2 … E −2), NOVA (1 +2 … 4 −2), bio, Label Rouge, AOP/IGP (+1 chacun) ; prix relevé chez Auchan d'abord, sinon médiane des relevés récents en France. « Meilleur rapport » : chaque point de qualité justifie jusqu'à 20 % de prix en plus que le moins cher. Affiché dans la commande guidée et sur la fiche d'un article. Navigateur : crème fraîche → crème entière Auchan, NOVA 3, 4,80 €/l relevé chez Auchan |
| Mise à jour hebdomadaire | **livré** | Workflow `prix.yml` : chaque lundi (relevés Open Prices de la semaine ; prix Insee dès leur publication mensuelle) et à chaque changement des scripts, régénère `prix.json` et `produits.json`, les enregistre. Aucun appel réseau pendant l'usage de l'app, aucune IA |
| Remplissage automatique du panier Auchan | **non fait** | [ANOMALIE_LOGIQUE] Jow le fait par un partenariat privé avec Auchan ; aucune API publique, CGU Auchan art. 8 (15/11/2024) : extraction automatisée interdite sans licence écrite. Choix du foyer (9 octobre 2026) : Foyer prépare tout, un toucher par article sur Auchan |
| Défauts trouvés et corrigés | **livré** | Règle « +25 % » qui recommandait une crème allégée ultra-transformée : remplacée par « 1 point = 20 % » ; écart de 0,5 gousse proposé alors qu'une gousse entière suffisait ; montant « au moins » sans dire ce qu'il couvre |

## 3. Plan concret pour la suite

**Étape A — Mise en service (Julien, ~10 min)**
1. Fusionner la branche dans `main` : GitHub Pages publie `https://julienchesneau1-arch.github.io/mes-comptes/foyer/`.
2. Sur chaque iPhone : ouvrir l'adresse dans Safari → Partager → « Sur l'écran d'accueil ». iOS 16.4 minimum (compression des liens).
3. Téléphone 1 : créer le foyer. Le code du foyer s'affiche sur Aujourd'hui.
4. Téléphone 2 : ouvrir Foyer depuis l'écran d'accueil → « L'autre téléphone a déjà Foyer » → taper le code. Ensuite tout se synchronise seul (au démarrage, au retour dans l'app, toutes les 20 s).

**Vérification iPhone (15 minutes, une fois, sur les deux téléphones)** — Foyer n'a été testé que dans Chromium. Noter ✓ ou ✗ ; en cas de ✗, envoyer le texte de Maison › Réglages › « Diagnostic de ce téléphone » › Copier.

| # | Geste | Attendu |
|---|---|---|
| 1 | Ouvrir Foyer depuis l'icône de l'écran d'accueil | Plein écran, sans barre Safari ; Diagnostic : ✓ Installée, iOS ≥ 16.4 |
| 2 | Couper le réseau (mode avion), rouvrir Foyer | L'app s'ouvre et affiche la semaine |
| 3 | Téléphone 2 : rejoindre avec le code | La même semaine apparaît en moins de 20 s |
| 4 | Téléphone 1 : déclarer une absence ; téléphone 2 : revenir dans l'app | Portions et courses recalculées des deux côtés |
| 5 | Courses → Mode magasin, attendre 2 min sans toucher | L'écran reste allumé |
| 6 | Courses → « Commander chez Auchan » → « Chercher chez Auchan » | La recherche Auchan s'ouvre (noter : dans Safari ou dans l'app Auchan) ; retour dans Foyer sur le même article |
| 7 | Copier l'adresse d'une page produit Auchan, la coller dans « Retenir le produit », contenance « 300 g » | « À mettre au panier : N × 300 g » |
| 8 | Semaine → « Exporter vers mon agenda » (.ics) → ouvrir le fichier | iOS propose d'ajouter les rappels au Calendrier |
| 9 | Maison → Coller une recette (texte de Notes) | Ingrédients et étapes reconnus, relecture avant enregistrement |
| 10 | VoiceOver (triple clic sur le bouton latéral si activé) : parcourir Aujourd'hui | Chaque bouton est annoncé avec un nom clair |
| 11 | Maison › Réglages › « Activer les rappels » → Autoriser, puis « Envoyer un rappel d'essai », verrouiller le téléphone | « 🔔 Essai Foyer » arrive en moins de 6 minutes (si « Un rappel pour vos repas : ouvrez Foyer » arrive à la place : envoyer le Diagnostic) |
| 12 | Maison › Réglages › Agendas › « Brancher un agenda » avec l'adresse iCal (Google) ou le lien « Calendrier public » (iCloud) | « Agenda de … branché : N événements » ; un événement du soir apparaît dans « Ce que l'agenda change » |
| 13 | Semaine › « ✨ Proposer le menu », glisser une carte vers la droite puis vers la gauche | La carte suit le doigt, « MIAM » / « AUTRE » apparaît, la carte suivante (ou une autre idée) s'affiche |
| 14 | Maison › Réglages › Rituel batch › Activer ; samedi 17 h (rappels activés) | Notification « 🛒 Courses du batch à commander » ; Aujourd'hui affiche « Jour des courses » |
| 15 | Au drive, sur un produit retenu : noter le prix vu chez Auchan ; après la commande, Courses › « Montant payé » | « N × prix = total » au drive ; la jauge du budget et Maison › Bilan se remplissent |
| 16 | Dimanche : Aujourd'hui › « Lancer la session », toucher « Prêt » sur chaque plat | Progression, puis « Batch terminé ! » ; les repas de la semaine passent à « Préparé » sur les deux téléphones |
| 17 | Semaine › « ✨ Proposer le menu » sur une semaine vide | Des recettes jamais cuisinées à chaque repas, aucune deux fois, pas deux plats du même genre ; « Équilibre de la semaine » apparaît sous la semaine après validation |
| 18 | Les deux téléphones en mode magasin, cocher un article sur l'un | La coche apparaît sur l'autre en moins de 10 s |
| 19 | Semaine › « ✨ Proposer le menu » › « Valider la semaine » › « Remplir le panier Auchan » | La recherche Auchan s'ouvre pour chaque article ; « Chercher ce produit chez Auchan » trouve le produit conseillé (noter ✗ sinon) |
| 20 | Après quelques articles au panier, ajouter une portion à un plat | Courses et Aujourd'hui affichent « Panier Auchan à mettre à jour » sur les deux téléphones |

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
| Activer le relais (synchro auto + import web) | **Fait le 4 octobre 2026** | Projet Supabase gratuit dédié « foyer » (2ᵉ projet gratuit de l'organisation, Assemblages non touché) : table et RLS appliquées, fonction `foyer-import` déployée, adresse dans `src/ui/config.ts` et `index.html` |
| V1B OCR des dates | Plus de 5 produits surveillés par semaine **et** saisie de date ressentie comme un frein | Audit Savore (accès au dépôt requis), corpus réel, confirmation champ par champ |
| Repas ajustés d'après l'agenda | **Fait le 4 octobre 2026** | Réglages › Agendas ; première semaine : décider une fois par événement récurrent |
| Rappels hors de l'app | **Fait le 4 octobre 2026** | Notifications par téléphone (Réglages › « Activer les rappels ») ; le fichier agenda (.ics) reste disponible |

## 4. Limites connues (assumées, documentées)

- Synchro automatique toutes les 20 s (5 s en mode magasin), pas instantanée. Sans réseau, relais en pause ou synchro auto désactivée : synchro **manuelle** par lien (le compteur « N changements pas encore envoyés » le rappelle).
- Projet Supabase gratuit : mis en pause après une semaine sans aucune activité ; Foyer continue alors en local et par lien.
- Le lien contient tout le journal (≈ 1 Ko au départ, quelques dizaines de Ko après des mois) ; compactage non fait.
- Un seul navigateur testé (Chromium). Safari iOS et VoiceOver restent à vérifier sur les téléphones.
- Rayon « Tomates » en boîte classé « Fruits & légumes » par défaut : un geste pour le changer, mémorisé.
- Rappels : jusqu'à 5 minutes de retard (passage du serveur toutes les 5 min). Les deux téléphones abonnés reçoivent les rappels du foyer. Un téléphone pas encore synchronisé peut retirer un rappel déposé par l'autre : chaque téléphone ouvert redépose sa liste au moins une fois par heure, mais si aucun des deux n'est ouvert entre-temps, ce rappel manque.
- Rappels hors ligne au moment de l'envoi, ou relais injoignable : notification générique « Un rappel pour vos repas : ouvrez Foyer » (iOS impose d'afficher quelque chose).
- Agenda : relu à l'ouverture de Foyer, au retour dans l'app et toutes les 30 min app ouverte ; iOS ne permet pas à une app web de travailler en arrière-plan : un événement ajouté quand personne n'ouvre Foyer est pris en compte à la prochaine ouverture (le rappel « semaine vide » du dimanche aide).
- Agenda : règles par mots du titre et heures des repas (midi 12 h-14 h, soir 19 h-21 h 30), sans IA ; un titre ambigu est proposé, jamais appliqué sans une première décision. Le premier mois, des propositions inutiles sont probables : « Jamais pour … » les fait taire.
- Agenda : l'adresse iCal donne accès en lecture à tout l'agenda ; elle est dans le journal chiffré et dans les sauvegardes exportées ; le serveur la reçoit à chaque lecture (rien n'est conservé). Couper l'accès : « Réinitialiser » (Google) ou désactiver « Calendrier public » (iCloud).
- Un plat décalé par l'agenda ne revient pas tout seul si l'événement est ensuite supprimé (la présence, elle, revient).
- Batch : Foyer n'évalue ni la conservation ni la durée de cuisson. Il affiche le nombre de jours entre le batch et chaque repas (J+n) et renvoie au repère officiel de l'[ANSES](https://www.anses.fr/fr/content/comment-bien-conserver-ses-aliments-et-ne-pas-interrompre-la-chaine-du-froid) ; frigo ou congélateur reste une décision du foyer. Ordre de la séance seulement pour les plats dont les durées sont connues (17 recettes du catalogue sur 423 en ont une ; les vôtres à saisir) ; il suppose une seule personne et des cuissons simultanées (feux, four) : à vous de juger si la cuisine le permet.
- Prix : estimations, jamais les prix du site Auchan (CGU). Prix moyens Insee (métropole, mois publié) ou relevés Open Prices par des contributeurs (datés, parfois anciens ou d'une autre enseigne, indiqués à l'écran). Couverture partielle : légumes et fruits comptés à la pièce seulement s'ils ont un poids moyen, épicerie seulement si un produit Auchan relevé ou une série Insee correspond ; le montant est alors un minimum et dit combien d'articles il couvre. Un article ajouté à la main n'est jamais chiffré.
- Qualité-prix : produits de la base Open Food Facts marqués « vendus chez Auchan » par des contributeurs (pas le catalogue Auchan complet) ; Nutri-Score ou NOVA parfois absents ; rafraîchi chaque lundi.
- Panier Auchan : un toucher par article (pas de remplissage automatique sans partenariat). Les changements « en trop » se retirent à la main sur Auchan.
- Un batch couvre les repas du jour même au sixième jour suivant ; ses courses sont celles de la semaine qui commence le lendemain du batch.
- Nouveautés : catalogue de 423 recettes bénévoles (Wikilivres), de qualité inégale ; à 8 nouveautés par semaine, environ un an avant d'avoir tout vu (calcul : 423 ÷ 8 ≈ 53 semaines). « Déjà vue » est retenu par téléphone (8 semaines), pas synchronisé.
- Équilibre : repères comptés par mots des ingrédients (règles fixes), sans quantité de légumes, de fruits ni de féculents ; un plat mal nommé peut échapper au compte. Ce n'est pas un avis nutritionnel.
- Conseiller de sécurité Supabase : 1 avertissement (extension `pg_net` créée dans le schéma `public` ; le déplacement a expiré depuis l'outil). Correction en une fois dans l'éditeur SQL : `drop extension pg_net; create extension pg_net with schema extensions;`.

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
| 2026-10-04 | V2.2 | Relais chiffré + import web (code, migration, fonction, tests simulés) | livré | — |
| 2026-10-04 | Mise en service | Projet Supabase « foyer » créé (eu-west-3) ; schéma appliqué instruction par instruction (l'outil de migration expirait) ; fonction d'import déployée | livré | Projet gratuit : pause après 7 jours sans activité |
| 2026-10-04 | Vérification réelle | RLS du relais éprouvée sur le vrai serveur ; import testé sur Marmiton et 750g, défaut d'encodage trouvé et corrigé | livré | Autres sites non testés |
| 2026-10-04 | Vérification | 44 tests ; 3 scénarios navigateur (relais muet ou simulé), 0 erreur, axe 0 défaut | livré | iPhone et VoiceOver non testés |
| 2026-10-04 | Comparatif | Critère « commander au drive » ajouté : Foyer 4,6 → 4,25 (puis 4,3 avec le panier assisté) | livré | Notes attribuées par l'auteur |
| 2026-10-04 | V2.3 | Drive Auchan assisté : produit retenu, paquets calculés, commande guidée | livré | Liens auchan.fr vers l'app Auchan sur iPhone non vérifiés ; pas de prix |
| 2026-10-04 | Fiabilité | Relais relu depuis le début quand la version de l'app lit d'autres types d'événements (test : l'événement écarté par l'ancienne version revient) | livré | — |
| 2026-10-04 | iPhone | Écran « Diagnostic de ce téléphone » (9 contrôles, texte à copier) + liste de vérification en 10 gestes | livré | Vérification réelle à faire par vous |
| 2026-10-04 | V2.4 | Catalogue Wikilivres en CI, découvertes dans les propositions (3 au plus), « Découvrir des recettes » | livré | Qualité inégale des recettes bénévoles |
| 2026-10-04 | Test | Contrôle « rien en clair » du relais rendu fiable (base64url pur) ; workflow catalogue protégé contre les pushes concurrents | livré | — |
| 2026-10-04 | Test | Scénario navigateur corrigé : une coche de test cochait toutes les lignes (`.first()` re-résolu) ; défaut du test, pas de l'app (vérifié sur le cœur) | livré | — |
| 2026-10-04 | V2.5 | Rappels chiffrés en notification : tables + RLS, fonction `foyer-push` (VAPID), tâche toutes les 5 min, service worker qui déchiffre | livré | Réception sur iPhone non vérifiée |
| 2026-10-04 | Vérification réelle | Rappels : dépôt, doublon ignoré, autre foyer refusé, abonnement interdit refusé, envoi + abonnement expiré retiré, exécution planifiée 200 | livré | Avertissement `pg_net` dans `public` (correction manuelle) |
| 2026-10-04 | Livraison | PR fusionnée dans `main` (V2.2 à V2.5) ; nettoyage SQL destructif bloqué côté outil, laissé à faire dans l'éditeur SQL | livré | Ligne d'essai et extension `http` encore présentes |
| 2026-10-04 | V2.6 | Agenda du mois → repas : lecteur iCalendar, fonction `foyer-agenda`, règles, décisions, retour arrière, plat décalé, jours fériés | livré | iPhone non testé ; règles par mots-clés |
| 2026-10-05 | V2.7 | Refonte visuelle (palette vive, police ronde, visuels de plats, icône), menu en cartes à balayer, Aujourd'hui en carte héros ; 4 défauts trouvés par les tests navigateur et corrigés | livré | Gestes non testés sur un vrai iPhone |
| 2026-10-04 | Performance | Lecteur d'agenda : 23 s → 0,5 s sur un agenda chargé (dates hors fenêtre écartées sans calcul d'heure, récurrences sautées jusqu'au mois utile) ; fonction redéployée | livré | — |
| 2026-10-04 | Prise en main | Premiers pas, « Comment ça marche », libellés clarifiés, phrase d'accueil rendue exacte | livré | Pas de test avec une personne novice réelle |
| 2026-10-08 | V2.8 | Rituel batch (courses samedi, batch dimanche) : `prep.batch`, feuille du batch, mise en place commune, J+n, rappels ; prix notés, panier estimé, budget, montant payé, bilan | livré | Conservation laissée au foyer ; prix saisis à la main |
| 2026-10-08 | Vérification | 94 tests ; 4 scénarios navigateur dont `rituel.mjs` (horloge figée), axe 0 défaut clair et sombre ; défaut de largeur du carrousel (V2.7) trouvé et corrigé | livré | Gestes 14 à 16 non vérifiés sur iPhone |
| 2026-10-08 | V2.9 | Maximum de nouveautés par défaut, aucune redondance (13 jours, genres, déjà vues), équilibre de la semaine (repères Santé publique France), durées et ordre du batch, synchro 5 s en magasin | livré | Qualité inégale du catalogue ; équilibre par mots-clés |
| 2026-10-08 | Clarté | Audit novice (4/10 clarté, 5/10 charge mentale) : 8 défauts corrigés, Aujourd'hui réduit à une action | livré | Pas de test avec une vraie personne novice |
| 2026-10-08 | Vérification | 100 tests ; 4 scénarios navigateur, 0 erreur, axe 0 défaut clair et sombre ; fonction `foyer-import` redéployée (v3) | livré | Appel réel de la fonction non testé depuis l'environnement (accès réseau refusé) ; gestes 17-18 non vérifiés sur iPhone |
| 2026-10-09 | V3.0 | Prix sans saisie (Insee + Open Prices), panier prêt dès le menu validé et mis à jour quand le menu change, conseil qualité-prix par article (Open Food Facts), workflow mensuel `prix.yml` | livré | Estimations, couverture partielle ; produits « vendus chez Auchan » selon les contributeurs |
| 2026-10-09 | Décision | Remplissage automatique du panier Auchan (comme Jow) : impossible sans partenariat (pas d'API, CGU art. 8). Le foyer choisit « Foyer prépare tout » et « Open Food Facts + Insee, mensuel » | livré | Un toucher par article sur Auchan |
| 2026-10-09 | Vérification | 110 tests ; 4 scénarios navigateur, 0 erreur, axe 0 défaut ; CI `prix.yml` : 53/53 séries Insee (août 2026), 31 groupes Open Food Facts dont 30 avec produits Auchan et 28 avec au moins un prix relevé (aucun pour lait de coco, fromage blanc, filets de poulet) | livré | Gestes 19-20 non vérifiés sur iPhone ; synchro-auto : 1 écart d'affichage entre téléphones sur 6 exécutions, non reproduit (diagnostic détaillé ajouté au test) |
| 2026-10-09 | Données | Catégories Open Food Facts corrigées d'après des produits réels (7 groupes) ; chapelure retirée (aucun produit Auchan) ; garde-fou sur le nom du produit (compote, croque-monsieur, ketchup écartés) | livré | Catalogue Auchan de la base incomplet (contributeurs) |
| 2026-10-09 | Prix en direct | Vérifié : aucune enseigne n'offre d'API publique de prix (Auchan, Leclerc d'après Pepesto, Carrefour Links réservé aux marques) ; Jow passe par des partenariats. Choix du foyer : relevés Open Prices chaque semaine + lecture de nos factures Auchan | en cours | Lecteur de factures en attente d'une facture réelle |
| 2026-10-09 | CI | Workflow `prix.yml` hebdomadaire (lundi) | livré | — |
