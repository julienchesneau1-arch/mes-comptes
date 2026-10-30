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

### V3.1 (factures du drive : les prix réellement payés)

| Fonction | Statut | Preuve |
|---|---|---|
| Lire une facture | **livré (format générique)** | Courses › « 🧾 Lire la facture du drive » (aussi dans le Budget) : PDF lu sur le téléphone par pdf.js 6.3.289 embarqué (`vendor/pdfjs/`, 1,8 Mo chargés seulement à cet usage, aucun `eval`, CSP inchangée), sans IA ni envoi. Lignes « produit · quantité · prix · montant » lues par des règles fixes et vérifiées par le calcul (quantité × prix = montant ; poids × prix au kg) ; total et date de la facture ; contenance lue dans le nom (« 4x125g », « 6 x 1 L », « x12 »). Texte collé accepté aussi. Navigateur : facture fictive lue, total contrôlé, 4 prix retenus, 13,00 € notés |
| Vérifier avant de retenir | **livré** | Ingrédient proposé pour chaque produit (le plus précis gagne : « sauce tomate » avant « tomate » ; « crème dessert » jamais rattachée à « crème fraîche ») ; champ modifiable, vide = ignoré ; contrôle « les lignes lues font le total de la facture » ou écart affiché |
| Prix payés dans le panier | **livré** | Événement `price.paid` (dernier prix par ingrédient, la facture la plus récente gagne). Coût d'une ligne : prix payé › prix noté › prix relevé › prix moyen Insee. Au poids : prix au kg × quantité ; emballé : articles entiers de la contenance achetée ; « 2 oignons » et filet de 1 kg : poids moyen d'une pièce (USDA). Contenance inconnue : pas de montant inventé |
| Le même produit que la dernière fois | **livré** | La commande guidée affiche « Déjà acheté : … » et ouvre la recherche Auchan sur ce nom exact |
| Montant payé automatique | **livré** | Case cochée par défaut : total de la facture noté pour la semaine des courses (celle de la facture, ou la suivante dès le vendredi si des plats y sont prévus) |
| Données personnelles | **livré** | Seules les lignes portant un montant sont lues ; seuls nom du produit, contenance et prix sont gardés. Test : faux nom, fausse adresse et numéro de commande jamais retenus ni affichés |
| Calage sur une vraie facture Auchan | **livré** (25 octobre 2026) | Trois factures Auchan drive du foyer, lues avec les données personnelles masquées avant lecture, jamais versées au dépôt : 69 lignes sur 69, toutes vérifiées par le calcul, somme égale au « Total à payer », date de commande juste (avant : 2 lignes lues sur 69 dont 2 lignes de paiement, et la date du téléchargement). Format reproduit avec un contenu fictif (`AUCHAN_ROWS`), testé en unitaire et en navigateur |

### V3.2 (une seule file « À régler », décisions automatiques — spec `spec-file-exceptions.md`)

| Fonction | Statut | Preuve |
|---|---|---|
| File « À régler » | **livré** | `exceptions.ts`, fonction pure de l'état et de l'heure, rien d'enregistré : conflits et alertes existants, personne à la maison mais un plat prévu (déplacer vers un repas où quelqu'un mange, retirer, invités), cuisson commencée jamais déclarée prête (« C'est prêt (n) »), restes libres sans repas prévu, repas sans plat. Remplace « À vérifier » et « À décider ». 5 cartes au plus, triées (échéance proche, blocage, repas), le reste replié. Navigateur : mode découverte, restes du chili placés ce midi d'un toucher |
| Règle des restes | **livré** | Réglage `leftovers` (`auto` par défaut, `suggest`, `manual`) dans `settings.set` : rejoué, synchronisé, annulable. « auto » = prochain déjeuner libre proposé d'office, jamais posé sans un toucher |
| Plus tard | **livré** | Événement `exc.snooze` : par personne, 24 h au plus (borné au rejeu), échus purgés ; remise 3 fois → « Décider une règle pour toujours » |
| Décisions automatiques | **livré** | Réglages : restes, boîtes du midi (déplacé depuis le rythme), décisions d'agenda mémorisées, avec un exemple pour chaque règle |
| Batch après le repas (`batch-bloque`) | **sans objet** | Le réducteur refuse déjà un batch après le repas et retire le batch d'un plat avancé (`unbatchIfLate`) : la situation ne peut pas exister |
| Liste unique dans Mes Comptes | **non fait** | [ANOMALIE_LOGIQUE] deux apps installées sur l'écran d'accueil n'ont pas de stockage commun garanti, et Mes Comptes n'a ni journal ni réducteur. Choix du foyer : chaque app sa liste |
| Compteur sur tablette | **non fait** | Foyer n'a pas de mode tablette |
| Robustesse des tests | **livré** | `parcours.mjs` à horloge figée (9 octobre) : depuis le 23 octobre, le 11 novembre férié entrait dans les 31 jours lus et ajoutait une décision attendue |

### V3.3 (la semaine arrive prête — spec `spec-semaine-generee.md` ; budget tenu comme chez Pimzi)

| Fonction | Statut | Preuve |
|---|---|---|
| Liste d'approbation | **livré** | « Proposer le menu » : toute la semaine en liste, « ✅ Tout approuver », « ↻ Autre idée » (2e, 3e suggestion…) et « ✕ Retirer » par repas (ses restes partent avec lui), bascules « Batch », nombre de personnes d'une recette qui ne le dit pas. Cartes à la Jow en option (« Voir en cartes »). Navigateur : veto, retrait, approbation → panier prêt |
| Budget tenu d'office (Pimzi) | **livré** | `fitBudget` : tant que la semaine (plats déjà prévus compris) dépasse le budget, le plat le plus cher est remplacé par la première alternative au moins 15 % moins chère, chaque repas une fois au plus, jamais vers un plat dont moins de 80 % des ingrédients ont un prix. Sinon : « Au-dessus du budget : aucune alternative nettement moins chère dont le prix soit bien connu ». Coût d'un plat proportionnel aux quantités (`dishCost`, prix payé › noté › relevé › Insee) ; coût par portion affiché seulement s'il est fiable ; « reste » du budget affiché seulement si l'estimation est complète |
| Brouillon partagé | **livré** | Événements `week.draft` (compact : un identifiant par repas, 14 au plus, bornés à la semaine, sans doublon) et `week.discard` (à l'approbation). L'autre téléphone retrouve le même menu ; un repas rempli entre-temps ou une recette indisponible est écarté, jamais écrasé. « À régler » : « Menu de la semaine proposé par … : N repas à approuver » remplace « N repas sans plat » |
| Durées dans le choix | **livré** | Vos plats : rapide (≤ 30 min déclarées) +10 un soir de semaine, plus d'une heure −15 ; plus de 45 min bienvenu le week-end — mêmes règles que les découvertes |
| Approbation jour par jour | **non fait** | Les boîtes (restes du dîner de la veille) relient deux jours : approuver mardi avant lundi casserait le lien. « ✕ Retirer » couvre le besoin |
| Saison, corvées, prévision du mois | **non fait** | [DONNÉE_MANQUANTE] calendrier de saison sourcé ; corvées absentes de Foyer ; prévision du mois dans Mes Comptes (stockage séparé). La spec demande de ne rien simuler |
| Couverture des prix | **limite constatée** | Menu de découvertes réelles : « au moins 5,64 € » pour 63 articles — la plupart des ingrédients n'ont pas de prix connu, donc le budget ne peut pas être tenu par remplacement. Les factures lues (V3.1) et le calibrage prévu en PR D l'améliorent |

### V3.4 (reprises Pimzi : allergies, calage sur les factures, budget à l'accueil, placard)

| Fonction | Statut | Preuve |
|---|---|---|
| Allergies et refus | **livré** | Réglage `exclude` (`settings.set`, `household.init`) : 14 allergènes de l'annexe II du règlement (UE) n° 1169/2011 et 20 aliments refusés au plus. `allergens.ts` lit le nom de l'ingrédient (expressions les plus longues d'abord ; faux amis testés : lait de coco, noix de muscade, noix de Saint-Jacques, pâté, farine de sarrasin, pâtes sans gluten) : « contient » → plus jamais proposé (vos plats et découvertes ; à la main, signalé) ; « étiquette à vérifier » (bouillon, sauce soja, charcuterie, chocolat) → signalé dans les courses, la ligne et le drive. « Porc » couvre la charcuterie de porc, « alcool » les vins et alcools. Navigateur : menu réel sans pâtes, farine, lait ni beurre ; fiche d'un plat avec ses allergènes |
| Calage sur les factures | **livré** | `calibration` : médiane payé ÷ Insee sur les articles comparables (même unité, sans forme), 5 au moins, bornée [0,5 ; 2], appliquée aux seules estimations Insee ; dit dans le budget (« −5 %, médiane de N articles ») et au drive (« × 0,95 d'après vos factures ») |
| Budget et allergies à l'accueil | **livré** | 4e étape facultative ; aucun montant suggéré ([DONNÉE_MANQUANTE] source d'un budget type) |
| Déjà au placard ? | **livré** | `surpluses` : paquets entiers pris la semaine précédente − besoin d'alors ; carte « À régler » quand la liste en redemande : « On en a » (`shop.pantry`), « Plus rien » (`task.set`) | 
| Calage sur une facture Auchan réelle | **prêt** | Le lecteur lit désormais les vraies factures Auchan (V3.6) ; le coefficient magasin s'active dès que le foyer en lit dans l'app (5 articles payés comparables) |
| Enseigne au choix (Pimzi : 20) | **non fait** | Foyer est bâti sur le drive Auchan du foyer ; d'autres enseignes demanderaient leurs propres recherches et contenances |
| Placard en navigateur | **livré** | `e2e/placard.mjs` : deux semaines à horloge figée, paquet de 500 g retenu et pris pour 300 g, la semaine suivante « À régler » propose 200 g, « On en a » laisse 100 g à acheter ; axe sur la carte |

### V3.5 (préparer juste, trouver vite — retours de Julien du 25 octobre 2026)

| Fonction | Statut | Preuve |
|---|---|---|
| Portions en plus reprises | **livré** (correctif) | Défaut : « + 2 en plus » lundi soir puis le même plat mardi midi créait une seconde préparation (2 + 2 + 2 = 6). `setDish` reprend un plat cuisiné jusqu'à 6 jours avant avec des portions en plus (ou prêt avec assez de portions libres) ; `setLeftovers` (« en cuisiner plus ») et les boîtes d'une semaine générée baissent aussi les portions en plus. « Cuisiner à nouveau » garde l'autre choix. Navigateur : 600 g de spaghetti, pas 900 g |
| Fiche recette en lecture | **livré** | Un plat s'ouvre sur ses ingrédients, étapes, allergènes et « Cuisiner (n) » s'il est prévu ; écran allumé ; « Modifier » ouvre le formulaire. Un plat réduit à son nom s'ouvre directement pour être complété |
| Usage compté, raccourcis | **livré** | `usage.ts` : compteurs par jour sur le téléphone seulement ; raccourcis en haut d'Aujourd'hui (épinglés, puis servis 3 fois en 30 jours ; 4 au plus ; recalculés une fois par jour) ; Réglages › Votre usage : le plus servi, épingler, outils pas servis depuis 30 jours (après 14 jours de mesure), couper, effacer |
| Masquer les outils jamais servis | **non fait** | Rien n'est masqué : un outil saisonnier (agenda, facture) disparaîtrait au moment d'en avoir besoin. Ils restent à leur place, hors des raccourcis |

Gestes pour ouvrir une recette (d'après le code, avant → après) :

| Tâche | Avant | Après |
|---|---|---|
| Recette du repas de ce soir | 1 si elle a des étapes, sinon 2 (Voir › Recette) ; arrivée sur le formulaire | 1 (« Étapes » ou « Recette ») ; fiche en lecture |
| Une recette souvent ouverte | 2 à 3 (Maison › plat, puis déplier les étapes) ; formulaire | 1 (raccourci d'Aujourd'hui, dès 3 ouvertures en 30 jours ou épinglée) |
| N'importe quelle recette | 3 (Maison › plat › déplier) ; formulaire | 2 (Maison › plat) ; fiche en lecture |
| Un outil souvent servi (drive, facture, découvrir…) | 2 (onglet › bouton) | 1 (raccourci) |

### V3.8 (combler les écarts avec les meilleurs — demande de Julien du 26 octobre 2026)

| Fonction | Statut | Preuve |
|---|---|---|
| Photos des plats | **livré** (photos téléchargées par la CI) | Image principale libre de chaque recette prête (Commons), 500 px, servie par Foyer ; auteur, licence et source sur la fiche et dans « Crédits des photos ». Affichées dans les idées, les cartes du menu, la carte du repas, Nos plats, la semaine. Premier passage CI le 26 octobre 2026 : **110 photos sur 424 recettes** (7,4 Mo ; 130 images trouvées, dont 86 prises dans le texte de la page faute d'image principale ; écartées : petites images, auteurs inconnus, téléchargements refusés ou trop lourds). Rendu vérifié en navigateur avec les vraies photos (fiche « Akpessi igname », crédit « African Hope · CC BY-SA 4.0 ») |
| Synchro quasi instantanée | **livré** | Signal vide Supabase Realtime après chaque dépôt ; navigateur (serveur simulé) : changement reçu en ≈ 1,4 s au lieu de 20 s au plus ; vrai relais : contrôle CI `realtime` |
| Rappel « Ce soir » | **livré** | 17 h 30 par défaut (16 h 30 à 18 h 30, ou coupé) : le plat prévu ou « rien de prévu » ; rien si personne ne mange |
| Pastille sur l'icône | **livré** (non vérifié sur iPhone) | Nombre de cartes À régler ; iOS 16.4+, app installée, notifications acceptées |
| Commande au drive en un clic | **non fait** | Impossible sans partenariat avec Auchan (CGU, aucune API publique) |
| Widget, Apple Watch | **non fait** | Impossible pour une app web |
| Correction Supabase (pg_net) | **en attente** | La confirmation du serveur Supabase n'arrive pas jusqu'au téléphone : correction à faire dans l'éditeur SQL (une ligne, voir § 4) |

### V3.9 (produits de la maison — demande de Julien du 26 octobre 2026)

« Dentifrice, papier toilette, Sopalin… : des choses très soudaines ; une catégorie mise à jour automatiquement en termes de
timing, pas toutes les semaines. » Foyer suit 29 produits (15 d'office, 14 à cocher selon l'équipement ou l'usage) et des
produits ajoutés par le foyer ; chacun revient dans les courses, rayon Maison & hygiène, la seule semaine où il devrait manquer.

| Fonction | Statut | Preuve |
|---|---|---|
| Catalogue et estimation de départ | **livré** | Hypothèse écrite par produit (contenance et usage courants), rapportée au nombre de personnes ; affichée sous chaque produit (tableau ci-dessous) |
| Rythme appris | **livré** | Un intervalle connu : moyenne avec l'estimation ; deux ou plus : médiane des 3 derniers (un achat oublié ne fausse pas tout) ; deux achats à moins de 5 jours = un seul passage. 7 tests (`tests/v39.test.ts`) |
| Dans les courses au bon moment | **livré** | Semaine des prochaines courses : ce qui manque d'ici sa fin, retard compris ; semaine suivante : ce qui manquera seulement là ; jamais acheté depuis le suivi : supposé à moitié entamé. E2E `maison.mjs` : rien la première semaine, gel douche, essuie-tout, papier toilette, mouchoirs la suivante |
| Achat noté d'un geste | **livré** | Coche dans la liste (décoche = retiré), « Oui, tout cocher » après le drive, « Acheté aujourd'hui » sur la fiche |
| Facture du drive | **livré** | Les produits suivis reconnus sur la facture sont notés achetés au jour de la facture (case à décocher) ; E2E : papier WC et lessive notés au 3 octobre |
| Il en faut / il en reste / rythme choisi / produit à soi | **livré** | « Il en faut maintenant » : dans les courses de la semaine ; « Il en reste encore » : reporté d'un quart du rythme (une semaine au moins) ; rythme fixe de 7 à 180 jours ; produit ajouté avec son rythme |
| Prix des produits de la maison dans le budget | **non fait** | Aucun prix de référence fiable pour ces produits : le panier estimé ne les compte pas (rien d'inventé) |

| Produit | Groupe | Suivi d'office | Base | Pour 2 personnes | Hypothèse de départ |
|---|---|---|---|---|---|
| Dentifrice | Hygiène | oui | 50 j pour 1 personne | 25 j | tube de 75 ml (≈ 100 g) : ≈ 1 g par brossage, 2 brossages par jour |
| Brosses à dents | Hygiène | oui | 90 j, un par personne | 90 j | à changer tous les 3 mois, le conseil courant des dentistes |
| Papier toilette | Hygiène | oui | 48 j pour 1 personne | 24 j | ≈ 1 rouleau tous les 4 jours par personne |
| Gel douche | Hygiène | oui | 25 j pour 1 personne | 13 j | flacon de 250 ml : ≈ 10 ml par douche, une douche par jour |
| Shampooing | Hygiène | oui | 60 j pour 1 personne | 30 j | flacon de 250 ml : ≈ 10 ml par lavage, 3 lavages par semaine |
| Déodorant | Hygiène | oui | 45 j, un par personne | 45 j | ≈ 6 semaines par déodorant |
| Savon pour les mains | Hygiène | oui | 40 j pour 1 personne | 20 j | flacon de 300 ml : ≈ 1,5 ml par lavage, 5 lavages par jour |
| Mouchoirs | Hygiène | oui | 40 j pour 1 personne | 20 j | boîte d'≈ 100 : 2 à 3 par jour en moyenne sur l'année |
| Cotons-tiges | Hygiène | non | 200 j pour 1 personne | 100 j | boîte d'≈ 200 : ≈ 1 par jour |
| Cotons démaquillants | Hygiène | non | 45 j pour le foyer | 45 j | paquet d'≈ 80 : ≈ 2 par jour |
| Lames de rasoir | Hygiène | non | 30 j pour le foyer | 30 j | paquet de 4 : ≈ 1 lame par semaine |
| Protections périodiques | Hygiène | non | 28 j pour le foyer | 28 j | un cycle ≈ 28 jours |
| Essuie-tout (Sopalin) | Cuisine et entretien | oui | 40 j pour 1 personne | 20 j | ≈ 1 rouleau tous les 10 jours par personne |
| Liquide vaisselle | Cuisine et entretien | oui | 60 j pour 1 personne | 30 j | flacon de 500 ml : ≈ 1 mois pour 2 personnes |
| Éponges | Cuisine et entretien | oui | 21 j pour le foyer | 21 j | une éponge neuve par semaine, pour l'hygiène |
| Sacs poubelle | Cuisine et entretien | oui | 80 j pour 1 personne | 40 j | ≈ 1 sac tous les 4 jours par personne |
| Lessive | Cuisine et entretien | oui | 105 j pour 1 personne | 53 j | bidon d'≈ 30 lavages : ≈ 2 machines par semaine et par personne |
| Nettoyant multi-usage | Cuisine et entretien | oui | 45 j pour le foyer | 45 j | un spray ≈ 6 semaines |
| Nettoyant WC | Cuisine et entretien | oui | 45 j pour le foyer | 45 j | un flacon ≈ 6 semaines |
| Tablettes lave-vaisselle | Cuisine et entretien | non | 80 j pour 1 personne | 40 j | boîte de 40 : ≈ 1 lavage tous les 2 jours par personne |
| Sel lave-vaisselle | Cuisine et entretien | non | 120 j pour le foyer | 120 j | ≈ 1 kg tous les 4 mois (selon la dureté de l'eau) |
| Liquide de rinçage | Cuisine et entretien | non | 90 j pour le foyer | 90 j | un flacon ≈ 3 mois |
| Adoucissant | Cuisine et entretien | non | 105 j pour 1 personne | 53 j | comme la lessive : ≈ 30 lavages |
| Eau de Javel | Cuisine et entretien | non | 90 j pour le foyer | 90 j | une bouteille ≈ 3 mois |
| Papier aluminium | Cuisine et entretien | non | 120 j pour le foyer | 120 j | un rouleau ≈ 4 mois |
| Film alimentaire | Cuisine et entretien | non | 120 j pour le foyer | 120 j | un rouleau ≈ 4 mois |
| Papier cuisson | Cuisine et entretien | non | 90 j pour le foyer | 90 j | un rouleau ≈ 3 mois |
| Sacs congélation | Cuisine et entretien | non | 90 j pour le foyer | 90 j | une boîte ≈ 3 mois |
| Filtres à café | Cuisine et entretien | non | 60 j pour le foyer | 60 j | boîte de 80 : ≈ 1 à 2 par jour |

### V3.10 (petit-déjeuner et placard — demande de Julien du 26 octobre 2026)

« Comment gérer aussi l'alimentaire du petit-déjeuner, thé, sucre… ? » Choix de Julien : comme les produits de la maison
(rythme estimé puis appris, dans la liste seulement quand ça manque) et une seule ligne quand une recette en demande aussi.
La feuille devient « 🔁 Produits du quotidien » : petit-déjeuner, placard, hygiène, entretien.

| Fonction | Statut | Preuve |
|---|---|---|
| 25 produits petit-déjeuner et placard | **livré** | Aucun coché d'office (café ou thé, tartines ou céréales) ; hypothèse écrite par produit (tableau ci-dessous) ; chacun dans son rayon (sucre : Épicerie sucrée, lait : Crèmerie, jus : Boissons) ; produit ajouté par le foyer : rayon deviné d'après son nom |
| Une seule ligne avec les recettes | **livré** | Sucre dû et crêpes au menu : une ligne « Sucre », le paquet de la réserve à droite, la part des crêpes dessous ; la cocher note aussi l'achat de la réserve ; la décocher l'enlève. E2E `maison.mjs` (sucre et lait) |
| Facture du drive | **livré** | Les aliments se lisent en tête du nom du produit (marque retirée) : lait ≠ lait de coco ni chocolat au lait, café ≠ filtres à café, sel ≠ sel lave-vaisselle, sucre ≠ sucre glace (4 tests, `tests/v310.test.ts`) |
| Commande guidée au drive avec la réserve | **non fait** | La commande guidée suit les lignes des recettes ; la réserve du quotidien s'achète à part |

| Produit | Groupe | Rayon | Achat | Pour 2 personnes | Hypothèse de départ |
|---|---|---|---|---|---|
| Café | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 paquet | 9 j | paquet de 250 g : ≈ 7 g par tasse, 2 tasses par jour |
| Thé | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 boîte | 6 j | boîte de 25 sachets : 2 tasses par jour |
| Tisane | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 boîte | 10 j | boîte de 20 sachets : 1 tasse par jour |
| Chocolat en poudre | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 boîte | 10 j | boîte d'≈ 400 g : ≈ 20 g par bol, un bol par jour |
| Sucre | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 kg | 50 j | ≈ 10 g par jour (deux morceaux ou cuillères) |
| Lait | Petit-déjeuner | Crèmerie & œufs | 6 briques d'1 L | 12 j | ≈ 25 cl par jour (café au lait, céréales) |
| Céréales | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 paquet | 6 j | paquet de 500 g : ≈ 40 g par bol |
| Flocons d'avoine | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 paquet | 6 j | paquet de 500 g : ≈ 40 g par bol |
| Confiture | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 pot | 13 j | pot d'≈ 370 g : ≈ 15 g par jour |
| Miel | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 pot | 25 j | pot de 500 g : ≈ 10 g par jour |
| Pâte à tartiner | Petit-déjeuner | Épicerie sucrée & petit-déj | 1 pot | 14 j | pot d'≈ 400 g : ≈ 15 g par jour |
| Beurre | Petit-déjeuner | Crèmerie & œufs | 1 plaquette de 250 g | 13 j | ≈ 10 g par jour sur les tartines |
| Pain de mie | Petit-déjeuner | Pain | 1 paquet | 5 j | paquet d'≈ 20 tranches : 2 par jour |
| Biscottes | Petit-déjeuner | Épicerie salée | 1 paquet | 5 j | paquet d'≈ 30 : 3 par jour |
| Jus d'orange | Petit-déjeuner | Boissons | 1 L | 3 j | un verre de 20 cl par jour |
| Yaourts | Petit-déjeuner | Crèmerie & œufs | 1 pack de 8 | 4 j | un par jour |
| Œufs | Petit-déjeuner | Crèmerie & œufs | 1 boîte de 6 | 6 j | un œuf tous les 2 jours, hors recettes |
| Huile | Placard | Épicerie salée | 1 bouteille d'1 L | 33 j | ≈ une cuillère à soupe (15 ml) par jour pour la cuisine |
| Vinaigre | Placard | Épicerie salée | 1 bouteille | 50 j | bouteille de 50 cl : ≈ 5 ml par jour |
| Sel | Placard | Épicerie salée | 1 paquet | 80 j | paquet de 500 g : ≈ 3 g par jour pour la cuisine |
| Poivre | Placard | Épicerie salée | 1 boîte | 50 j | boîte d'≈ 50 g : ≈ 0,5 g par jour |
| Moutarde | Placard | Épicerie salée | 1 pot | 20 j | pot d'≈ 200 g : ≈ 5 g par jour |
| Mayonnaise | Placard | Épicerie salée | 1 pot | 23 j | pot d'≈ 235 g : ≈ 5 g par jour |
| Ketchup | Placard | Épicerie salée | 1 flacon | 50 j | flacon d'≈ 500 g : ≈ 5 g par jour |
| Farine | Placard | Épicerie sucrée & petit-déj | 1 kg | 50 j | ≈ 10 g par jour hors recettes chiffrées (sauces, pâtisserie) |

### V3.20 (photo de la date en un toucher — accord de Julien du 29 octobre 2026)

« Oui pour le bouton photo en un toucher » (proposé en V3.16 : lecture embarquée, 3 à 5 Mo). Avant : la date se lisait seulement
avec « Scanner le texte » de l'iPhone (deux touchers dans un menu) ou se tapait.

| Fonction | Statut | Preuve |
|---|---|---|
| Bouton photo | **livré** | « 📸 Prendre la date en photo » en tête de la feuille « Scanner une date limite » (et sur un produit déjà suivi) : `capture="environment"`, l'appareil photo arrière s'ouvre d'un toucher ; « Scanner le texte » reste proposé dessous (E2E `photo.mjs`) |
| Lecture sur le téléphone | **livré** | Tesseract 5 (tesseract.js 7.0.0, Apache-2.0) auto-hébergé dans `vendor/tesseract/`, chargé à la première photo (≈ 3,8 Mo : 5 fichiers), rien avant ; modèle français LSTM ; aucun appel réseau hors de l'app (E2E : requêtes comptées) ; lecteur gardé une minute, puis mémoire rendue ; préchargé à l'ouverture de la feuille une fois la photo déjà utilisée |
| Image préparée | **livré** | `core/scan.ts` (fonctions pures, `tests/v320.test.ts`) : seuil local, texte penché redressé (profil de projection, −20° à 20°), impression à points reconnue (taches rondes de même taille, pas régulier) puis reliée (fermeture morphologique au pas mesuré), bords d'étiquette effacés ; seuil Sauvola de Tesseract pour le texte plein |
| Jamais deviné | **livré** | Date retenue par `core/printed.ts` (comme le texte scanné). Confiance ≥ 80 : reportée, « vérifiez avec l'emballage » ; en dessous : seulement proposée (« Utiliser jeu. 12 nov. 2026 ») ; rien lu : la marche à suivre est dite (de plus près, « Scanner le texte », ou taper). Texte lu affiché (« Texte lu sur la photo ») |
| Taux de lecture mesuré | **livré** | `e2e/lecture-photo.mjs`, 190 étiquettes **simulées** (10 dates × 19 styles), Chromium : texte imprimé net, mono, serif, gris clair, sur couleur, flou, bruité, petit, reflet, penché 8° : **100/100** ; penché 15° : 7/10 ; impression à points (jet d'encre, matrice 5×7) : **13/70** ; tout cumulé : 2/10. Total 122/190 justes, 14 fausses, 54 non lues. Confiance ≥ 80 : 108 justes, 1 fausse ; en dessous : 14 justes, 13 fausses. 0,12 à 1,8 s par photo sur ce serveur (Chromium ; iPhone non mesuré) |
| Dates à points | **partiel** | Lecture rare (13/70) : l'aide et le message d'échec renvoient à « Scanner le texte » de l'iPhone pour ces dates |
| Vraies photos, iPhone | **non fait** | `[DONNÉE_MANQUANTE]` : aucune photo réelle d'emballage ni mesure sur iPhone (temps, mémoire) ; hors ligne après la première photo : service worker (https), non vérifiable en E2E local (http) |

### V3.19 (un plat le soir = dîner + boîtes du lendemain ; texte à l'envers — demande de Julien du 29 octobre 2026)

« Quand on crée une recette, ça écrit à l'envers dans l'encart. » « À chaque fois l'application nous dit de faire 14 repas : on fait
un repas, mais à chaque fois des boîtes, donc deux portions en plus. Pas la peine de proposer 14 repas ; trouver une solution pour
comprendre facilement. » Avant : chaque lettre tapée dans « Chercher ou créer un plat » redessinait la feuille et remettait le curseur
au début (« Gratin » devenait « nitarG ») ; le bilan comptait des repas (14 pour un foyer à la maison midi et soir) et seuls les midis
où tout le monde emporte une boîte suivaient le dîner de la veille.

| Fonction | Statut | Preuve |
|---|---|---|
| Texte tapé dans le bon ordre | **livré** | `ui/dom.ts` (`paint`) : le redessin d'une feuille rend le focus **et la position du curseur** au champ ; insertion au milieu comprise (E2E `bilan.mjs` : « Gratin » tapé lettre par lettre, « GratXin » au milieu) |
| Compter en plats à cuisiner | **livré** | `core/coverage.ts` : un midi nourri par le dîner de la veille (prévu, ou à prévoir) n'est pas un plat de plus ; « il manque 7 plats à cuisiner », « 7 midis suivent le dîner de la veille (portions en plus le soir) », « Semaine couverte : 7 plats pour 14 repas » ; même compte dans Aujourd'hui, « À régler » et après chaque plat posé (« encore 6 plats à cuisiner cette semaine ») (`tests/v319.test.ts`) |
| Réglage « le midi = restes du dîner » | **livré** | `settings.lunchFromDinner` (`core/plan.ts`, `fedByDinner`) : tous les midis où l'on mange, boîte ou maison, suivent le dîner de la veille ; proposé à l'accueil (« On cuisine le soir, avec des portions en plus pour les boîtes du lendemain midi », premier choix), dans Décisions automatiques et par le bilan (« 🥡 Oui : le midi = restes du dîner » quand 2 midis ou plus se cuisinent encore) ; ancien appareil : réglage ignoré, sans erreur |
| +2 portions toutes seules | **livré** | `core/commands.ts` (`withLunch`) : un dîner posé (vos plats, nouveau plat, recette prête) relie le midi du lendemain s'il est vide et nourri par ce dîner ; portions « en plus » d'un plat entier reprises d'abord ; message « · +2 portions pour mercredi midi » ; dîner posé avant le réglage : « ♻️ Curry aussi mardi midi (+2 portions la veille) » d'un toucher |
| Semaine générée | **livré** | `proposeWeek` : chaque midi nourri reprend le dîner de la veille (« midi : restes du dîner de la veille ») ; sans dîner la veille, le midi se cuisine ; 7 plats proposés pour 14 repas |
| Vérifié sur iPhone | **non fait** | Chromium mobile seulement |

### V3.18 (bilan de la semaine — demande de Julien du 29 octobre 2026)

« Un système qui prend en compte notre agenda : quand on met plusieurs plats, qu'il nous dise qu'on n'a pas assez de plats pour
finir la semaine, ou trop de plats et qu'on aura des restes. » Avant : « N repas sans plat » dans Aujourd'hui seulement, restes et
plats sans personne en cartes séparées, rien dans l'écran Semaine ni au moment de poser un plat.

| Fonction | Statut | Preuve |
|---|---|---|
| Bilan calculé | **livré** | `core/coverage.ts` : repas à venir de la semaine où quelqu'un mange (présence de chacun, agenda appliqué, invités) ; manque = repas sans plat (et leurs portions) ; trop = portions « en plus » d'un plat pas encore cuisiné, restes déjà préparés et libres, plat posé sur un repas où personne ne mange (`tests/v318.test.ts`) |
| Dit dans Semaine | **livré** | Carte « Bilan de la semaine » en haut : « Pas assez de plats : il manque 9 repas… », « Trop de plats : 2 portions en trop… de quoi faire ≈ 1 repas de restes », ou « Semaine couverte : 8 repas à la maison, tous prévus, rien en trop » ; agenda compris, ou dit comment le brancher ; changements d'agenda à décider signalés |
| Dit en posant un plat | **livré** | Le message après chaque plat posé (vos plats, restes, recettes prêtes) finit par « · encore 13 repas sans plat cette semaine », « · 4 portions en trop cette semaine » ou « · semaine couverte ✓ » |
| Gestes d'un toucher | **livré** | « ♻️ Pâtes demain midi » : portions en plus (6 jours au plus après la cuisson) ou restes reprises sur un repas sans plat, rien de plus à cuisiner ; « Déplacer Curry à mercredi soir » : plat d'un repas où personne ne mange vers un repas sans plat ; « ✨ Compléter la semaine » pour le reste (E2E `bilan.mjs`) |
| Agenda à décider compris dans le bilan | **non fait** | Volontairement : un changement d'agenda pas encore décidé n'est pas compté (il serait deviné) ; la carte le signale et renvoie à l'agenda |

### V3.17 (dates limites, menus et agenda liés — demande de Julien du 29 octobre 2026)

« En fonction de la date de péremption ou de la date limite recommandée, que l'application propose un menu plutôt qu'un autre ; et si
l'emploi du temps décale des plats qui risquent d'arriver à péremption, qu'elle le dise tout de suite, et qu'elle l'impose ou propose
le plat selon l'emploi du temps. » « Date limite de commande » compris comme date limite de consommation : confirmé par Julien le 29 octobre 2026.
Avant : seuls vos plats étaient mis en avant par une DLC (pas les recettes prêtes, proposées d'abord par défaut, ni la DDM) ; un plat
que l'agenda vidait partait au repas libre suivant, même après la DLC.

| Fonction | Statut | Preuve |
|---|---|---|
| Une seule notion des dates qui comptent | **livré** | `core/limits.ts` : produit surveillé fermé, DLC (impérative) ou DDM (« de préférence avant », indicative), au jour près ; DLC d'abord, puis la plus proche ; même rapprochement produit ↔ ingrédient que V3.14 (`tests/v317.test.ts`) |
| Menu proposé selon les dates | **livré** | « Proposer le menu » réserve d'abord, sur le premier repas où quelqu'un mange d'ici la date, un plat qui utilise le produit : recette prête en « maximum de nouveautés » (défaut), vos plats sinon (« mes plats » : jamais une recette prête) ; rien si un plat prévu l'utilise déjà à temps ; jamais remplacé pour tenir le budget (jeter coûterait plus). Raison affichée : « ⏳ à utiliser : crème fraîche (DLC ven. 9 oct.) » (E2E `dates.mjs`, catalogue réel) |
| Idées et choix d'un plat | **livré** | Bonus dans les 3 jours avant la date pour vos plats et, nouveau, pour les recettes prêtes : DLC +30, DDM +15, raison « utilise poulet (DLC mar. 6 oct.) » |
| Agenda : plat décalé avant la DLC | **livré** | Plus personne au repas du plat : repas libre le plus proche d'ici la DLC (après, sinon avant) ; sinon un plat sans urgence lui laisse sa place et part au repas libre suivant ; sinon décalé quand même et dit « ⚠️ … après la DLC ». Appliqué seul quand l'événement est déjà décidé (« pareil les prochaines fois »), proposé sinon ; toujours dit dans le message ou la carte de l'agenda |
| Carte « personne » et aperçu d'un déplacement | **livré** | Repas réglé à la main sans personne : seulement des repas d'ici la DLC, sinon « (après la DLC) » ; déplacer un plat après la DLC d'un produit qu'il utilise : « ⚠️ … après la DLC » dans l'aperçu, avant d'enregistrer |
| DDM dans l'agenda | **non fait** | Volontairement : une DDM passée ne rend pas le produit dangereux (DGCCRF) ; elle oriente les menus, elle ne bloque aucun déplacement |
| Non vérifié | — | Agenda réel (Google, iCloud, Outlook) et iPhone : scénarios unitaires seulement pour la partie agenda (`tests/v317.test.ts`) |

### V3.16 (bouton de scan visible — retour de Julien du 29 octobre 2026)

« On ne trouve pas le bouton scanner pour la DLC : il faut qu'il soit plus visible et accessible. » Avant : un seul bouton, après la
liste et les autres actions, en bas de Courses (et « Ajouter » dans Maison › À surveiller) ; dans la feuille, le champ venait après
le produit, et « Scanner le texte » de l'iPhone, caché dans le menu du champ, n'était décrit qu'en une phrase.

| Fonction | Statut | Preuve |
|---|---|---|
| Bouton dans l'en-tête d'Aujourd'hui | **livré** | « 📷 Scanner une date » dans l'en-tête collant, à côté de « Ça coince ? » : à 0,08 écran, toujours visible en défilant. Pas de raccourci en double |
| Bouton en haut de Courses | **livré** | « 📷 Scanner une date limite » sous le bouton du drive, avant la liste (0,29 écran dans le scénario `dates.mjs` ; contrôlé sous la moitié de l'écran) ; retiré du bas de page |
| Rappel au bon moment | **livré** | Produit frais (boucherie, frais, crèmerie) coché et pas encore surveillé → « Poulet : acheté. Scannez la date limite » avec « 📷 Scanner » (nom repris) et « Plus tard » (écarté pour la semaine, sur ce téléphone) |
| Zone de scan en premier | **livré** | La feuille commence par la zone « 📷 Scanner la date » (champ agrandi, pointillés, « 📷 Touchez ici pour scanner »), puis le produit ; étapes iPhone numérotées avec l'icône « Scanner le texte », masquées dès qu'une date est lue ; Maison › À surveiller : « 📷 Scanner une date » |
| Accessibilité | **livré** | Libellés visibles = noms accessibles, cibles de 44 px au moins, étapes reliées au champ (`aria-describedby`), icône décorative masquée ; axe WCAG 2.2 AA sur le rappel, la zone de scan, la feuille et la carte (E2E `dates.mjs`) |
| Ouvrir l'appareil photo de l'iPhone en un toucher | **non fait** | Aucune interface web ne déclenche « Scanner le texte » : il faut toucher le champ puis le menu. Chemin exact du menu selon la version d'iOS non vérifié sur iPhone : `[DONNÉE_MANQUANTE]` |

### V3.15 (couverture des prix sans rien aspirer — choix de Julien du 26 octobre 2026)

« N'avoir que 17 € de certifié sur 90 € ne mène pas à grand-chose » (chiffres du scénario de test fictif). Aspirer les prix
d'auchan.fr est refusé (V3.14) ; à la place : plus de sources libres, des noms d'ingrédients mieux rapprochés, et la part sûre dite.
Mesure reproductible : `node scripts/couverture.mjs` (424 recettes prêtes, 75 produits du quotidien, sans facture, sans réseau).

| Fonction | Statut | Preuve |
|---|---|---|
| Nom d'achat d'un ingrédient | **livré** | `buyKeys` (`core/refprice.ts`) : « oignon haché », « comté râpé », « vin blanc sec », « carottes coupées en dés » se chiffrent comme oignon, comté, vin blanc, carotte ; jaune ou blanc d'œuf comme un œuf ; « oignon de Roscoff » reste sans prix (pas de rapprochement hasardeux). Prix Insee et relevés Open Prices (`tests/v315.test.ts`) |
| Le gratuit ne compte pas | **livré** | Eau (tiède, froide, chaude, bouillante), bouquet garni, poivre du moulin : ni dans le montant ni « sans prix » ; eau gazeuse ou en bouteille comptée |
| 21 groupes Open Prices de plus | **livré** | Café, confiture, miel, pâte à tartiner, céréales, jus d'orange, mayonnaise, ketchup, vinaigre, eau, sodas, sirop, vin, bière, biscuits, fruits secs, chips, comté, sauce soja, huile d'arachide, olives noires. CI `prix` du 26 octobre 2026 : 52 groupes sur 52 ; produits · chiffrés : miel 14 · 13, biscuits 14 · 13, céréales 14 · 12, vinaigre 14 · 12, mayonnaise 11 · 10, confiture 12 · 8, chips 14 · 8, pâte à tartiner 10 · 7, ketchup 11 · 7, sodas 10 · 7, jus d'orange 9 · 5, fruits secs 11 · 5, comté 8 · 4, café 8 · 3, sirop 8 · 3, sauce soja 8 · 3, eau 8 · 2, bière 8 · 2, huile d'arachide 6 · 1, olives noires 8 · 1, **vin 8 · 0** |
| Contenances du quotidien | **livré** | Reprises des hypothèses écrites (confiture 370 g, miel 500 g, pâte à tartiner 400 g, céréales 500 g, mayonnaise 235 g, ketchup 500 g, moutarde 200 g, vinaigre 50 cl, sirop 75 cl, sodas 6 × 33 cl, biscuits 200 g, gâteaux 300 g, fruits secs 200 g) : le relevé au kilo ou au litre devient un prix de paquet |
| Part sûre dite dans le budget | **livré** | « N articles au prix payé sur vos factures du drive (X € sûrs) », puis les estimés et les « sans prix » ; « Eau du robinet, sel, poivre et épices non comptés » (E2E `facture.mjs`) |
| Ticket de caisse scanné | **livré** | Lecteur de factures : « Ou coller le texte de la facture, ou scanner un ticket de caisse », aide « Scanner le texte » reliée au champ ; ticket fictif au format générique : 4 lignes, total vérifié, quantité seule ignorée (`tests/v315.test.ts`, E2E `facture.mjs`). **Pas vérifié sur iPhone ni sur de vrais tickets** : `[DONNÉE_MANQUANTE]` |
| Couverture mesurée | **livré** | Lignes d'ingrédients des recettes prêtes chiffrées sans facture : **29 % → 36 %** (551 → 670 relevé, 367 → 436 Insee ; 3 133 → 3 045 lignes, l'eau et le poivre du moulin ne comptant plus). Produits du quotidien : **15 % → 35 %** (7 → 22 relevé, 4 Insee, sur 75) |
| Ail, herbes fraîches, bouillons, poulet, vin | **non fait** | Sans prix les plus fréquents : ail (81 lignes), vin blanc (20 + 10 « sec »), persil (17), échalote (14), bouillon de légumes (13), basilic (12), poulet (10). Pas de référence Insee chargée ; Open Prices : poulet 8 produits · 0 chiffré, vin 8 · 0. La première facture ou le premier ticket les chiffre |
| Hygiène et entretien | **non fait** | Les 29 produits de la maison restent sans prix avant la première facture : recherche Open Food Facts (alimentaire) seulement ; Open Products Facts et Open Beauty Facts non essayés : `[DONNÉE_MANQUANTE]` |
| Prix Auchan aspirés chaque mois | **refusé** | Rappel V3.14 : CGU d'auchan.fr (12/06/2026) et CPI, art. L342-1 |

### V3.14 (dates limites lues et utiles — demande de Julien du 26 octobre 2026)

« Les dates de consommation ne servent pas à grand-chose : il faut un OCR qui les reconnaisse, et que l'app suggère de mettre tel
plat avant si la date est proche. » Avant : un formulaire à remplir (type, précision, date), et une date proche ne servait qu'au
moment de proposer un menu.

| Fonction | Statut | Preuve |
|---|---|---|
| Lecture de la date imprimée | **livré** | `core/printed.ts` : « à consommer jusqu'au » → DLC, « de préférence avant » → DDM, jour, mois ou année ; 28/10/2026, 07.10.26, 28 OCT 2026, 03/2027, « fin 2027 » ; confusions O/0 et l/1 de l'OCR ; dates d'emballage, de ponte, de fabrication écartées ; DLC sans année : année déduite et signalée ; poids, volumes, pourcentages et années absurdes jamais lus comme une date (`tests/v314.test.ts`) |
| Scanner avec l'appareil photo | **livré** | Sur iPhone, « Scanner le texte » (Live Text, iOS 15+, puce A12+) dans le champ « Date imprimée » insère le texte reconnu, relu aussitôt ; aucune bibliothèque d'OCR embarquée, rien n'est envoyé. Fonctionnement vérifié en navigateur avec le texte inséré ; **pas sur iPhone** |
| Saisie en quelques gestes | **livré** | Produits frais de la liste (viande, poisson, traiteur, crèmerie) proposés en un toucher ; saisie à la main repliée ; « Enregistrer et scanner un autre » pour le retour des courses. E2E `dates.mjs` |
| Avancer un plat avant la DLC | **livré** | `core/dlc.ts` : DLC dans 3 jours au plus, produit fermé, plat prévu qui l'utilise cuisiné après la DLC (jour du batch compris) → carte « Date limite » dans À régler : « Avancer mercredi soir » (échange de créneaux, annulable) |
| Prévoir un plat qui l'utilise | **livré** | Aucun plat prévu ne l'utilise → un de vos plats qui en contient, sur un repas libre d'ici la DLC, un toucher ; « Déjà utilisé » ferme le suivi. Rapprochement par mots (« Poulet » ↔ « blanc de poulet »), aussi dans les propositions de menu |
| OCR sur photo hors iPhone | **non fait** | Pas de bibliothèque embarquée (plusieurs Mo, lecture médiocre des dates imprimées en points) ; ailleurs, la date se tape dans le même champ |
| Durées de conservation calculées | **non fait** | Volontairement : seule la date imprimée compte (DGCCRF) ; produit ouvert = date non applicable |
| Prix Auchan aspirés chaque mois | **refusé** | CGU d'auchan.fr (version du 12/06/2026) : robots d'extraction interdits sans licence écrite ; droit du producteur d'une base de données (CPI, art. L342-1). Les prix viennent des factures, d'Open Prices et de l'Insee (53 références) |

### V3.13 (lisibilité — choix de Julien du 26 octobre 2026)

Question de Julien : « l'app est-elle assez simple et lisible pour être au niveau des meilleures ? » Mesure des écrans
(`e2e/lisibilite.mjs`) : deux points faibles nets, l'écran Courses (liste sous le premier écran, six blocs avant elle) et la feuille
« Produits du quotidien » (1 103 mots, 154 éléments touchables).

| Fonction | Statut | Preuve |
|---|---|---|
| Courses : liste d'abord | **livré** | Avant la liste : seulement le plat sans quantités (une ligne), le panier à mettre à jour, « 🛒 Commander au drive · N articles » et la saisie ; facture, produits du quotidien et date à surveiller regroupés après la liste, avant le budget ; note de bas de page versée dans l'aide. Premier rayon à 0,61 écran au lieu de 0,84 ; 304 → 268 mots |
| Produits du quotidien allégés | **livré** | Suivis d'abord, triés par prochaine date ; catalogue replié par groupe (« 2 suivis · 8 à ajouter »), le paquet seul (l'hypothèse est sur la fiche) ; groupe ouvert gardé après une coche ; premier choix : maison dépliée, aliments repliés. 1 103 → 182 mots, 154 → 24 touchables |
| Dernier élément jamais caché | **livré** | Défaut trouvé par l'E2E `rituel.mjs` : en bas de page, le dernier élément restait sous le message d'action (6 s) ; marge du bas portée à 10 rem et `scroll-padding` pour les barres fixes (focus clavier visible, WCAG 2.4.11) |
| Comparaison chiffrée avec les autres apps | **non fait** | Aucune mesure équivalente possible sans les apps `[DONNÉE_MANQUANTE]` |

### V3.12 (commande guidée en moins de gestes — choix de Julien du 26 octobre 2026)

Question de Julien : « est-ce réellement impossible que la liste arrive directement sur le site du drive ? » Réponse vérifiée :
remplir le panier Auchan à distance est réservé aux partenaires commerciaux (Jow, recettes Miam dans l'appli Auchan) ; les API
Auchan publiques connues servent les vendeurs de la marketplace, pas le panier d'un client ; aucun import de liste trouvé sur
auchan.fr `[DONNÉE_MANQUANTE]` ; un robot sur la session du client passerait par des fonctions internes non documentées, et les CGU
d'Auchan n'ont pas pu être relues (site injoignable depuis l'environnement) `[DONNÉE_MANQUANTE]`. Choix de Julien : garder la
commande guidée et en retirer des gestes.

| Fonction | Statut | Preuve |
|---|---|---|
| « ✓ Ajouté · ouvrir le suivant » | **livré** | Un toucher coche l'article et ouvre la page Auchan du suivant (même geste, sinon le navigateur bloque la fenêtre). Dans Foyer : 1 toucher par article au lieu de 2 (« Ouvrir » + « Ajouté »). E2E `parcours.mjs` : 32 articles, 32 touchers, 31 pages ouvertes d'office (Auchan simulé, aucune vraie page chargée) |
| Bouton principal selon le moment | **livré** | Page pas encore ouverte : « Ouvrir chez Auchan » en tête ; déjà ouverte (retour d'Auchan) : « ✓ Ajouté » en tête, « Rouvrir » et le conseil qualité-prix dessous |
| « 📋 Retenir le produit copié » | **livré** | Presse-papiers lu sur demande : 1 toucher (plus la confirmation « Coller » du navigateur) au lieu d'ouvrir le formulaire, coller, valider ; autre chose qu'une page produit ou collage refusé : le champ s'ouvre, rien n'est deviné. E2E `maison.mjs` |
| Un seul onglet Auchan réutilisé | **non fait** | Sans `noopener`, la page Auchan garderait un accès à Foyer (`window.opener`) ; avec, réutilisation non vérifiée, iPhone compris `[DONNÉE_MANQUANTE]` |
| Contenance lue dans l'adresse du produit | **non fait** | Format des adresses Auchan réelles inconnu : les exemples connus ne portent pas la contenance `[DONNÉE_MANQUANTE]` |
| Panier rempli sans passer par Auchan | **non fait** | Réservé aux partenaires d'Auchan (voir ci-dessus) |

### V3.11 (desserts, fruits, boissons, goûter ; drive complet — demande de Julien du 26 octobre 2026)

« Il nous manque les desserts ; que manque-t-il pour faire le tour des courses et des repas ? » Choix de Julien : desserts du
quotidien seulement (yaourts, compotes, glaces : suivis comme le reste, sans recette de dessert ni changement des repas), fruits à
croquer, boissons, goûter, et le drive complet : les produits du quotidien dans la commande guidée et leur prix dans le budget.

| Fonction | Statut | Preuve |
|---|---|---|
| 21 produits desserts, fruits, boissons, goûter | **livré** | Aucun coché d'office ; hypothèse écrite par produit (tableau ci-dessous) ; chacun dans son rayon (glaces : Surgelés, fruits : Fruits & légumes) ; les yaourts passent du petit-déjeuner aux desserts. 75 produits au total |
| Facture du drive | **livré** | Pommes ≠ pommes de terre, eau ≠ eau de Javel ni eau gazeuse, tablette ≠ chocolat en poudre, chips ≠ biscuits, raisins secs ≠ raisin frais, marque en capitales retirée (`tests/v311.test.ts`) |
| Commande guidée au drive avec la réserve | **livré** | Un produit du quotidien dû est un article de la commande (« Besoin : 1 kg (≈ 6) », recherche Auchan sur son nom ou sur le dernier libellé payé) ; avec une ligne de recette : un seul article, le paquet de la réserve ; « Ajouté au panier » note l'achat. E2E `maison.mjs` (pommes) |
| Prix du quotidien dans le budget | **livré** | Prix payé (facture) rapporté à la contenance du paquet, au kilo pour le vrac, un par personne pour « chacun » ; sinon prix noté du produit retenu ; sinon prix moyen Insee × contenance ; sinon « sans prix de référence », jamais deviné. Le coût par portion reste celui des recettes seules. Panier prêt et aperçu du menu comptent aussi la réserve |
| Recettes de desserts | **non fait** | Choix de Julien : seulement le quotidien |

| Produit | Groupe | Rayon | Achat | Pour 2 personnes | Hypothèse de départ |
|---|---|---|---|---|---|
| Yaourts | Desserts | Crèmerie & œufs | 1 pack de 8 | 4 j | un par jour |
| Compotes | Desserts | Épicerie sucrée & petit-déj | 1 pack de 8 | 8 j | ≈ une tous les 2 jours |
| Crèmes dessert | Desserts | Crèmerie & œufs | 1 pack de 4 | 7 j | ≈ 2 par semaine |
| Fromage blanc ou petits-suisses | Desserts | Crèmerie & œufs | 1 pack | 7 j | pack de 6 : ≈ 3 par semaine |
| Glaces | Desserts | Surgelés | 1 bac ou 1 boîte | 11 j | ≈ 2 portions par semaine |
| Pommes | Fruits à croquer | Fruits & légumes | 1 kg (≈ 6) | 7 j | ≈ 3 par semaine |
| Bananes | Fruits à croquer | Fruits & légumes | 1 kg (≈ 5) | 6 j | ≈ 3 par semaine |
| Oranges ou clémentines | Fruits à croquer | Fruits & légumes | 1 kg | 6 j | ≈ 4 par semaine |
| Poires | Fruits à croquer | Fruits & légumes | 1 kg (≈ 6) | 7 j | ≈ 3 par semaine |
| Fruits de saison | Fruits à croquer | Fruits & légumes | 1 barquette ou 1 kg | 4 j | fraises, pêches, raisin, kiwis… selon la saison : ≈ 4 fruits par semaine |
| Biscuits | Goûter et en-cas | Épicerie sucrée & petit-déj | 1 paquet | 5 j | paquet d'≈ 200 g : ≈ 20 g par jour |
| Madeleines et gâteaux | Goûter et en-cas | Épicerie sucrée & petit-déj | 1 paquet | 5 j | paquet d'≈ 300 g : ≈ 30 g par jour |
| Barres de céréales | Goûter et en-cas | Épicerie sucrée & petit-déj | 1 boîte | 6 j | boîte de 6 : une tous les 2 jours |
| Chocolat (tablettes) | Goûter et en-cas | Épicerie sucrée & petit-déj | 1 tablette | 5 j | tablette de 100 g : ≈ 2 carrés (10 g) par jour |
| Fruits secs et oléagineux | Goûter et en-cas | Épicerie sucrée & petit-déj | 1 sachet | 7 j | sachet de 200 g : ≈ 15 g par jour |
| Chips et biscuits apéritif | Goûter et en-cas | Épicerie salée | 1 paquet | 7 j | ≈ 2 fois par semaine |
| Eau en bouteille | Boissons | Boissons | 1 pack de 6 × 1,5 L | 3 j | si on ne boit que de l'eau en bouteille : ≈ 1,5 L par jour |
| Eau gazeuse | Boissons | Boissons | 1 pack de 6 × 1 L | 6 j | ≈ 50 cl par jour |
| Sodas | Boissons | Boissons | 1 pack de 6 canettes | 6 j | ≈ une canette tous les 2 jours |
| Sirop | Boissons | Boissons | 1 bouteille | 10 j | bouteille de 75 cl : ≈ 4 cl par jour |
| Vin | Boissons | Boissons | 1 bouteille | 11 j | ≈ 2 verres par semaine |
| Bière | Boissons | Boissons | 1 pack de 6 | 11 j | ≈ 2 par semaine |

### V3.7 (apprendre de l'usage réel — choix de Julien du 25 octobre 2026)

| Fonction | Statut | Preuve |
|---|---|---|
| « On refait ? » après le repas | **livré** | Carte « Votre avis » dans À régler pour un plat cuisiné mangé aujourd'hui ou hier : 👍 favori (proposé plus souvent), 👎 rangé (plus jamais proposé, recette prête du même nom écartée), « Sans avis ». Une fois par plat. Navigateur : « On a mangé » → carte → 👍 → étiquette « favori » |
| « Ça coince ? » | **livré** | Bouton dans le bandeau de chaque écran ; note = écran, genre, un mot, derniers gestes ; sur le téléphone seulement ; Réglages › Ça coince : voir, copier, effacer, masquer le bouton. Navigateur : note prise sur Semaine, liste copiée |
| Mode essentiel | **livré** | Foyer neuf : ni promo batch, ni budget, ni facture, ni Bilan ; Réglages › Fonctions les affiche ; une fonction déjà en service reste affichée. Navigateur : « Factures du drive » coché → bouton visible |
| Correction Supabase (pg_net hors de `public`) | **en attente** | La confirmation demandée par le serveur Supabase est restée sans réponse ; rien n'a été modifié (rappels intacts) |

**Essai de deux semaines (étape C)** : gel des nouveautés ; vérification iPhone (20 gestes) ; chaque gêne notée avec « Ça coince ? » ; à J+14 : liste copiée + « Votre usage » → décider quoi garder, simplifier ou retirer.

### V3.6 (recettes prêtes, comme chez Jow — demande de Julien du 25 octobre 2026)

| Fonction | Statut | Preuve |
|---|---|---|
| Recettes prêtes dans « Choisir un plat » | **livré** | Section « Recettes prêtes » : les 4 meilleures pour ce repas (même classement que les propositions), ou les 6 qui répondent à la recherche ; un toucher prévoit le plat et l'ajoute à « Nos plats » ; « Voir » ouvre la fiche avec ce repas en premier. Navigateur : recherche « poulet », fiche, « Demain soir » prévu |
| Idées d'Aujourd'hui | **livré** | Jusqu'à 3 recettes prêtes à côté de vos plats et restes, dès le premier jour (foyer sans aucun plat). Navigateur : idée prévue d'un toucher, courses calculées |
| Fiche d'une recette prête | **livré** | « Prévoir » sur les 6 prochains repas libres, « Ajouter à nos plats », « Modifier avant d'ajouter », ingrédients avec allergènes, étapes, source et licence |
| Page sans nombre de personnes | **livré** | 243 plats sur 424 : le foyer choisit 1 à 8 ; « Ajouter » et « Prévoir » absents avant (navigateur) ; jamais proposés d'office |
| Catalogue plus grand | **partiel** | 424 plats de repas (le catalogue n'a pas grossi : desserts, boissons et pages sans quantités restent écartés), mais 181 avec nombre de personnes (lecture élargie) au lieu de 139 proposables. Aucune autre source libre vérifiable ; rien d'inventé |
| Desserts | **non fait** | Écartés volontairement (planning de repas) |

Gestes pour prévoir un plat qu'on n'a jamais saisi (d'après le code, avant → après) :

| Tâche | Avant | Après |
|---|---|---|
| Un plat pour ce midi, foyer neuf | 2 (« Trouver une idée » › « Je prends » ; une idée à la fois) | 1 (idée d'Aujourd'hui, 3 au choix ; « Trouver une idée » reste) |
| Un plat précis (« poulet ») pour un repas, hors recherche tapée | 10 (Maison › Nos plats › Découvrir › recette › Ajouter › Enregistrer, puis Semaine › repas › Choisir un plat › plat) | 4 (Semaine › repas › Choisir un plat › plat) |

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

- Synchro : signal temps réel après chaque dépôt (≈ 1 à 2 s), relève toutes les 20 s (5 s en mode magasin) en secours ; le signal ne passe qu'app ouverte (iOS coupe les connexions en arrière-plan). Sans réseau, relais en pause ou synchro auto désactivée : synchro **manuelle** par lien (le compteur « N changements pas encore envoyés » le rappelle).
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
- Factures : lecture dédiée au format Auchan drive (calée sur trois factures réelles d'octobre 2026) ; les autres formats passent par des règles génériques. La cagnotte Waaoh gagnée n'est pas déduite du prix (elle sert à un achat suivant). Rapprochement : 27 produits sur 69 proposés d'office avec la liste de base (les autres le sont quand l'ingrédient est au menu) ; il reste des cas ambigus (« ANDROS POMME CHÂTAIGNE », une compote, proposé « pomme »), corrigés par la personne qui vérifie. Une ligne non vérifiable par le calcul est signalée « calcul non vérifiable ». PDF scanné (image) ou protégé par mot de passe : non lu, message clair. Le lecteur pdf.js (1,8 Mo) demande une connexion la première fois.
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
| 2026-10-09 | V3.1 | Lecteur de factures du drive : pdf.js embarqué (sur le téléphone, sans IA), lecture vérifiée par le calcul, rattachement aux ingrédients vérifié par la personne, prix payés prioritaires dans le panier, montant payé noté, « déjà acheté » dans la commande guidée | livré (format générique) | Calage sur une facture Auchan réelle en attente |
| 2026-10-09 | Vérification | 119 tests (dont extraction d'un vrai PDF par pdf.js) ; 5 scénarios navigateur, 0 erreur, 0 appel hors de l'app, axe 0 défaut sur la feuille de vérification | livré | Non vérifié sur iPhone ; format Auchan réel non testé |
| 2026-10-23 | Analyse | Pimzi (pimzi.app, lu par la recherche web : enseigne et budget au départ, dîners remplacés jusqu'à passer sous le budget, prix calés par enseigne ±10 %, liste par rayon, « déjà au placard », allergènes) et deux specs du foyer (file d'exceptions, semaine générée) confrontées au code | livré | Lecture directe du site impossible (crédits Firecrawl épuisés, domaine refusé par le réseau de l'environnement) |
| 2026-10-23 | V3.2 | File « À régler » + Décisions automatiques (PR A de 4) | livré | Mes Comptes, semaine générée et reprises Pimzi : PR B, C, D |
| 2026-10-23 | Mes Comptes | File d'exceptions côté Mes Comptes (PR B de 4) : « prévu échu » et « dépense commune payée en perso » dans la liste « À faire » existante, adaptés à son modèle (pas de journal ; décision gardée dans `shared`, fusionnée à la synchro, le remboursement fait l'emporte) ; cache hors ligne v41 | livré | Pas d'écran de réglage du seuil de 20 € (la spec interdit de toucher l'interface au-delà de la liste) ; pas de propriétaire par opération dans Mes Comptes : les statistiques par compte ne bougent pas |
| 2026-10-23 | V3.3 | Semaine générée en liste d'approbation, budget tenu d'office (Pimzi), brouillon partagé, durées dans le choix (PR C de 4) | livré | Couverture des prix encore faible sur les recettes du catalogue ; approbation jour par jour non faite |
| 2026-10-23 | V3.4 | Reprises Pimzi (PR D de 4) : allergies et refus, estimations calées sur les factures, budget et allergies à l'accueil, « déjà au placard ? » | livré | Lecture du nom de l'ingrédient seulement (un produit transformé peut contenir un allergène non signalé : l'étiquette fait foi) ; calage inactif tant que moins de 5 articles payés comparables |
| 2026-10-25 | V3.5 | Retours de Julien : portions en plus reprises par un repas suivant (défaut corrigé : 6 → 4), fiche recette en lecture, usage compté sur le téléphone et raccourcis à navigation fixe (split menu, épinglables) | livré | Mesure locale à un téléphone (pas de cumul à deux) ; seuils (3 fois, 30 jours, 4 raccourcis) choisis, pas mesurés |
| 2026-10-25 | V3.6 | Demande de Julien : recettes prêtes comme chez Jow, dans le choix d'un plat, les idées d'Aujourd'hui et Nos plats ; lecture Wikilivres élargie (181 plats sur 424 avec nombre de personnes) | livré | Catalogue limité à Wikilivres (424 plats contre plus de 5 000 chez Jow) ; 243 pages demandent le nombre de personnes ; pas de photos |
| 2026-10-29 | V3.18 | Bilan de la semaine : repas où quelqu'un mange (agenda compris) face aux plats prévus, « pas assez de plats » ou « trop de plats » dans Semaine et après chaque plat posé, restes repris ou plat déplacé d'un toucher | livré | Changements d'agenda pas encore décidés non comptés (signalés) ; non vérifié sur iPhone |
| 2026-10-29 | V3.19 | Texte tapé dans le bon ordre (curseur gardé au redessin) ; semaine comptée en plats à cuisiner, réglage « le midi = restes du dîner » (accueil, Décisions automatiques, bilan), dîner posé = +2 portions pour le lendemain midi, menus générés de même | livré | Non vérifié sur iPhone |
| 2026-10-29 | V3.20 | « 📸 Prendre la date en photo » : lecture sur le téléphone (Tesseract auto-hébergé, 3,8 Mo à la première photo), image redressée, points du jet d'encre reliés, date reportée si sûre, seulement proposée sinon ; « date limite de commande » = DLC confirmé | livré | Mesuré sur 190 étiquettes simulées (texte net 100/100, points 13/70) ; aucune vraie photo ni iPhone |
| 2026-10-30 | V3.21 | Fiabilité : une recette prête (15 sur 424 : ligne d'ingrédient de plus de 80 caractères) ou une ligne longue tapée dans une recette ne disparaît plus au rechargement ni à la synchro (recette ramenée dans les limites, suite gardée en note) ; garde-fou : ce qui serait écarté au rechargement n'est jamais montré comme fait (« Non enregistré », rien n'a changé) ; « ✕ Retirer » annoncé comme tel au lecteur d'écran ; « Proposer le menu » 5 à 16 fois plus rapide (rayon et nom normalisé des ingrédients gardés une fois calculés, menu identique) ; parcours iPhone (WebKit) et Android (Chromium) dans la CI : accueil, menu approuvé, 4 onglets en clair et sombre (WCAG 2.2 AA), rechargement, hors ligne | livré | Défaut trouvé par le nouveau test téléphone ; iPhone réel non vérifié (WebKit sous Linux) |
| 2026-10-30 | V3.22 | Écrans hiérarchisés (retours : « trop d'infos ») : « À régler » montre les 2 cartes les plus pressantes, le reste replié ; explications de carte sur 2 lignes ; « Pas encore acheté » en une ligne vers Courses ; détail du bilan de la semaine et méthode de l'équilibre repliés ; bannière d'installation raccourcie. Mesuré (exemple, téléphone) : Aujourd'hui 240 → 161 mots visibles, Semaine 281 → 180 (premier écran 111 → 65) | livré | Courses reste une liste longue (c'est son contenu) |
| 2026-10-29 | V3.17 | Dates limites, menus et agenda liés : menu proposé qui utilise d'abord les produits à DLC ou DDM (recettes prêtes comprises, raison affichée), plat décalé par l'agenda gardé avant la DLC (repas libre, sinon échange, sinon ⚠️), carte « personne » et aperçu de déplacement qui le disent | livré | Agenda réel et iPhone non vérifiés ; « date limite de commande » = DLC, confirmé le 29 octobre 2026 |
| 2026-10-29 | V3.16 | Bouton de scan des dates limites visible : en-tête d'Aujourd'hui, haut de Courses, rappel après l'achat d'un produit frais ; zone de scan en premier dans la feuille, étapes iPhone affichées | livré | « Scanner le texte » reste à deux touchers dans le menu d'iOS (pas d'interface web pour l'ouvrir) ; non vérifié sur iPhone |
| 2026-10-26 | V3.15 | Couverture des prix sans rien aspirer : nom d'achat des ingrédients, eau du robinet non comptée, 21 groupes Open Prices de plus, contenances du quotidien, part payée dite en euros, ticket de caisse scanné ; mesuré sans facture : recettes 29 → 36 % des lignes chiffrées, quotidien 15 → 35 % | livré | 64 % des lignes de recettes et 65 % des produits du quotidien restent sans prix avant la première facture (ail, herbes, bouillons, poulet, vin, hygiène, entretien) ; tickets non vérifiés sur iPhone ni sur de vrais tickets |
| 2026-10-26 | V3.14 | Dates limites lues (texte scanné par l'iPhone ou tapé : DLC, DDM, précision, année déduite) et utiles : avancer d'un toucher le plat prévu après la DLC, ou prévoir un plat qui l'utilise | livré | « Scanner le texte » non vérifié sur iPhone ; rapprochement par mots (« lait » pourrait désigner « lait de coco ») |
| 2026-10-26 | V3.13 | Lisibilité mesurée : Courses avec la liste d'abord (premier rayon à 0,61 écran au lieu de 0,84), feuille du quotidien allégée (1 103 → 182 mots), dernier élément jamais caché par un message ; benchmark mis à jour (4,3 → 4,5, notes de l'auteur) | livré | Mesure en navigateur, pas sur iPhone ; aucune mesure équivalente des concurrents |
| 2026-10-26 | V3.12 | Commande guidée en moins de gestes : « ✓ Ajouté · ouvrir le suivant » (1 toucher par article au lieu de 2), bouton principal selon le moment, produit retenu d'un toucher depuis le presse-papiers | livré | Panier rempli à distance impossible hors partenariat Auchan ; onglet unique et confirmation « Coller » non vérifiés sur iPhone |
| 2026-10-26 | V3.11 | Desserts du quotidien, fruits à croquer, boissons, goûter (21 produits, 75 au total) ; drive complet : produits du quotidien dans la commande guidée, leur prix dans le budget (facture, prix noté, prix Insee × contenance) | livré | Rien d'office ; estimations = hypothèses écrites ; prix Insee absent pour la plupart des desserts, boissons et goûters (comptés « sans prix » jusqu'à la première facture) ; non vérifié sur iPhone |
| 2026-10-26 | V3.10 | Petit-déjeuner et placard (25 produits : café, thé, sucre, lait, céréales, beurre, huile, sel…) suivis comme les produits de la maison, chacun dans son rayon ; une seule ligne quand une recette en demande aussi | livré | Rien d'office (habitudes propres à chaque foyer) ; estimations = hypothèses écrites ; non vérifié sur iPhone |
| 2026-10-26 | V3.9 | Produits de la maison : 29 produits suivis au bon rythme (estimation par personne, puis rythme appris des achats notés et des factures), dans les courses seulement la semaine où ils manquent | livré | Estimations de départ = hypothèses écrites, corrigées par l'usage ; non vérifié sur iPhone ; prix non comptés dans le budget |
| 2026-10-26 | V3.8 | Photos libres des plats (CI, auto-hébergées, crédits), synchro quasi instantanée (signal Realtime), rappel « Ce soir », pastille sur l'icône | livré | 110 photos sur 424 recettes (pages Wikilivres illustrées sous licence libre) ; signal mesuré à 7 ms sur le vrai relais par la CI ; signal temps réel et pastille non vérifiés sur iPhone |
| 2026-10-25 | V3.7 | Avis 👍/👎 après le repas, « Ça coince ? » (gênes notées sur le téléphone), mode essentiel (fonctions avancées affichées à l'usage ou à la demande) | livré | Seuils et choix par défaut posés, pas encore mesurés ; à juger pendant l'essai de deux semaines |
| 2026-10-25 | Factures | Lecteur calé sur trois factures Auchan réelles (masquées avant lecture, jamais versées) : colonnes vérifiées par deux calculs (remise, TVA), nom du produit sur deux lignes et deux pages, date de commande, paiements (cagnotte, carte cadeau) écartés, produit rapproché par son nom de tête, abréviations (« PLT », « PDT »…) | livré | Une seule enseigne calée ; format susceptible de changer côté Auchan (lecture générique en secours, « Aucune ligne reconnue » sinon) |
| 2026-10-23 | Vérification | « Déjà au placard ? » éprouvé en navigateur sur deux semaines (`placard.mjs`, 4 étapes, axe 0 défaut) | livré | Non vérifié sur iPhone |
