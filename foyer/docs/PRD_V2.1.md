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

---

## 8. V2.2 — rattraper les meilleures apps là où Foyer était derrière (4 octobre 2026)

Bilan comparatif dans `BENCHMARK.md`. Décisions :

| Écart constaté | Décision V2.2 | Garde-fou |
|---|---|---|
| Partage à deux par lien manuel (AnyList, Mealie : temps réel) | **Synchro automatique par relais** : chaque téléphone dépose ses événements **chiffrés de bout en bout** et relève ceux de l'autre (au démarrage, au retour dans l'app, toutes les 20 s, après chaque changement). **Rejoindre le foyer = taper le code**, sans lien à copier | Le relais (table Supabase dédiée) ne voit qu'une étiquette et des blocs illisibles ; règle RLS par en-tête ; le lien chiffré reste disponible en secours ; désactivable |
| Saisie des recettes (Paprika, Mealie : import d'une adresse) | **Import d'une adresse web** : une fonction serveur lit les données schema.org « Recipe » de la page ; Foyer les analyse comme une saisie | Sans IA ; relecture obligatoire avant enregistrement ; source notée dans la recette |
| Planning figé (AnyList, Mealie : glisser-déposer) | **Glisser-déposer** (souris, ou appui long au doigt) | Ouvre toujours l'aperçu des conséquences ; le bouton « Déplacer » reste |
| Propositions sans contexte | **Varier** (pas la même viande deux jours de suite) et **réutiliser** les produits frais déjà prévus (la crème de la tarte sert au gratin) | Règle déterministe, raison affichée |
| Rappels hors de l'app | **Agenda (.ics)** : tâches de la veille à 19 h, du matin à 8 h, boîtes à 21 h, repas en option | Identifiants stables ; rien dans le passé |
| Courses en magasin | **Ordre des rayons de votre magasin**, **mode magasin** (écran allumé, seulement ce qui reste), saisie assistée | — |
| Répartition des tâches à deux | **Qui cuisine** par repas, visible partout | Aucun score ni comparaison entre les membres |

[ANOMALIE_LOGIQUE 10 — résolue] La V2.1 justifiait la synchro manuelle par l'absence de serveur. Or la synchro manuelle est la principale source de friction restante, et un relais qui ne voit que des données chiffrées respecte le même contrat de vérité et de vie privée. Le relais est donc adopté, à condition d'être **chiffré de bout en bout, désactivable et non indispensable**.

## 9. V2.3 — commander au drive Auchan (4 octobre 2026)

Demande : « un système à la Jow », chaque recette mise automatiquement dans le panier Auchan Drive.

[ANOMALIE_LOGIQUE 11 — arbitrée] « Automatiquement » suppose un accès au panier Auchan. Jow l'a par contrat avec les enseignes (page « Auchan x Jow » sur auchan.fr) ; aucune API publique de panier Auchan n'a été trouvée, et les CGU d'auchan.fr (12/06/2026) interdisent les robots d'extraction sauf licence écrite. Un remplissage automatique serait donc soit un faux-semblant, soit un script non officiel, fragile et risqué pour le compte. Choix du foyer : **panier assisté**.

| Règle | Contenu |
|---|---|
| Rien n'est lu sur auchan.fr | Foyer ne garde que ce que le foyer saisit : le lien de la page produit et la contenance d'un paquet |
| Nombre de paquets exact ou absent | Arrondi au paquet supérieur, conversion seulement dans la même dimension ; besoin en grammes et contenance en pièces → « à juger », jamais deviné |
| Coche = décision humaine | « Ajouté au panier » coche l'article ; rien n'est coché parce qu'une page a été ouverte |
| Pas de prix ni de promotion | Ils restent sur Auchan |

## 10. V2.4 — proposer des plats nouveaux, à la Jow (4 octobre 2026)

Demande : « nous n'avons pas encore de recettes ; sois fort de proposition, scrape comme pour Assemblages et fais-nous des propositions comme Jow ».

[ANOMALIE_LOGIQUE 12 — arbitrée] Aspirer Marmiton ou un site équivalent n'est pas permis : les CGU de Marmiton déclarent les recettes intégrées à une base de données dont la reproduction est interdite, et le droit des producteurs de bases de données (CPI, art. L341-1 et suivants) protège contre l'extraction d'une partie substantielle. Inventer des recettes est exclu par la règle anti-hallucination. Source retenue : le **Livre de cuisine de Wikilivres**, sous licence libre CC BY-SA 4.0, lu par son **API officielle** (pas de page aspirée), avec attribution.

| Règle | Contenu |
|---|---|
| Catalogue | Généré en CI (`scripts/catalogue.mjs`) ; une recette n'entre que si elle est un plat de repas (ni dessert, ni boisson, ni base, ni accompagnement), avec au moins 3 ingrédients dont la moitié chiffrés et 2 étapes |
| Propositions | Vos plats d'abord ; une découverte quand il n'en reste plus, et au moins une par semaine ; 3 au plus (au-delà, trop d'achats inhabituels) ; classiques français et recettes courtes préférés ; familles variées d'un jour à l'autre |
| Jamais d'office | Une recette sans nombre de personnes (les quantités ne se calculeraient pas) ; un plat déjà dans « Nos plats » |
| Accord | Accepter une découverte l'ajoute à « Nos plats » avec sa source et sa licence ; « Découvrir des recettes » passe par la relecture habituelle |

Limites assumées : catalogue modeste et inégal (contributions bénévoles, certaines recettes exotiques ou approximatives) ; pas de photos ; durée connue pour peu de recettes.

## 11. V2.5 — rappels en notification sur le téléphone (4 octobre 2026)

Demande retenue : « Notifications iPhone ». Le PRD V2.1 les écartait (« impossibles sans serveur ») ; le relais existe désormais, la contrainte tombe.

| Règle | Contenu |
|---|---|
| Quels rappels | Les mêmes que l'agenda : tâche « la veille » à 19 h, sinon le jour même à 8 h ; boîte à préparer (la veille à 21 h pour un midi, à 17 h pour un soir) ; plus « la semaine prochaine est vide » le dimanche à 18 h si on mange à la maison |
| Activation | Par téléphone, à la demande (Réglages), jamais à l'ouverture ; désactivable ; effacer Foyer retire l'abonnement |
| Vie privée | Le serveur ne lit aucun texte : heures et blocs chiffrés seulement ; rappels effacés 2 jours après |
| Honnêteté | Rappel illisible (hors ligne, relais indisponible) → « Un rappel pour vos repas : ouvrez Foyer », jamais un texte deviné |

Limites assumées : 5 minutes de précision ; réception sur iPhone non vérifiée à ce jour (geste 11 de `PLAN.md`).

## 12. V2.6 — l'agenda du mois ajuste les repas ; prise en main (4 octobre 2026)

Demande : « que l'app ait accès à nos emplois du temps sur le mois entier et que, dès qu'un événement peut changer les repas, elle le prenne en compte et fasse le nécessaire » ; « une personne novice peut-elle comprendre l'app ? ».

[ANOMALIE_LOGIQUE 13 — arbitrée] « Accès » et « dès que » : une app web n'a pas accès au Calendrier de l'iPhone et ne tourne pas en arrière-plan sur iOS. Arbitrage : lecture d'une adresse iCal par agenda, relue à chaque ouverture et toutes les 30 min quand l'app est ouverte. « Faire le nécessaire » sans jamais demander supposerait de deviner le sens de chaque événement : une décision par titre d'événement (« pareil les prochaines fois »), ensuite c'est automatique.

| Règle | Contenu |
|---|---|
| Ce qui change un repas | Événement « occupé » pendant au moins la moitié du créneau (midi 12 h-14 h, soir 19 h-21 h 30) ; titre parlant de repas (resto, dîner, apéro…) dès qu'il touche le créneau ; absence de plusieurs jours (vacances, déplacement, séminaire…) ; télétravail, RTT, congé, férié → midi à la maison ; « à la maison », « on reçoit » → invités (nombre demandé) |
| Ce qui ne change rien | Événement « disponible » ; journée entière sans mot d'absence (« Anniversaire de Léa ») ; repas déjà commencé ou passé ; repas déjà noté mangé |
| Priorité | Un réglage fait à la main l'emporte toujours ; un repas dehors annoncé l'emporte sur une journée à la maison, qui l'emporte sur un simple « occupé » |
| Retour arrière | Événement supprimé ou déplacé → la présence revient à l'habitude ; jamais sur une lecture d'agenda ratée |
| Plat sans convives | Décalé au prochain repas à la maison sans plat (6 jours au plus), s'il n'est pas commencé et ne nourrit pas d'autres repas |
| Vie privée | Adresse dans le journal chiffré ; serveur sans mémoire ; événements en cache sur le téléphone seulement |

Prise en main : « Premiers pas » (gestes cochés d'après l'état réel), « Comment ça marche », libellés clarifiés ; la phrase d'accueil « sans compte ni serveur » corrigée (le relais existe, même s'il ne lit rien).

## 13. V2.7 — une app belle, ludique et comprise en 10 secondes (5 octobre 2026)

Demande : « couleurs vives, DA moderne et attractive comme les meilleurs ; des propositions comme Jow, pas une liste à cliquer ; hyper ludique ; compréhensible en 10 s ».

| Règle | Contenu |
|---|---|
| Un écran, une action | Aujourd'hui : une grande carte pour le prochain repas et un bouton principal ; Semaine : « ✨ Proposer le menu », le reste sous « Plus d'options » |
| Propositions | Une carte à la fois : je prends / autre idée / pas de plat ; « Garder tout le menu » pour aller vite ; récapitulatif avant d'enregistrer |
| Ludique sans piège | Confettis à la validation, tampons « MIAM / AUTRE », cases qui « claquent » ; rien n'est enregistré sans « Valider » ; tout est annulable |
| Accessible | Contraste AA vérifié en clair et en sombre ; gestes doublés de boutons ; mouvements coupés sur demande de l'appareil |

Limite assumée : visuels par emoji, pas de photos de plats.

## 14. V2.8 — batch cooking le dimanche, courses le samedi, économies visibles (8 octobre 2026)

Demande : « se mettre au batch cooking le dimanche, choix des courses finales le samedi pour un drive le dimanche matin ; comment le mettre en avant pour s'y mettre et faire des économies ».

| Règle | Contenu |
|---|---|
| Un rituel, pas un réglage caché | Présenté une fois sur Aujourd'hui ; activé en un geste ; ensuite chaque jour du rituel a sa carte en tête d'Aujourd'hui et son rappel |
| Le batch se décide dans le menu | Les repas des 5 jours suivant le batch sont proposés « 👩‍🍳 Batch » ; un toucher pour en retirer un |
| La séance guide sans inventer | Plats, boîtes à remplir avec J+n, légumes de tous les plats à préparer en une fois, « C'est prêt » par plat ; aucune durée de conservation ni de cuisson calculée |
| Économies mesurées, pas promises | Prix notés par le foyer → panier estimé, coût par portion, budget, montant payé, bilan ; ingrédients partagés signalés ; jetés comptés. Aucun chiffre d'économie annoncé sans mesure |

[ANOMALIE_LOGIQUE corrigée] Un plat déjà déclaré préparé faisait encore apparaître ses ingrédients dans « Pas encore pris » : ils sont désormais ignorés.

## 15. V2.9 — aucune redondance, un maximum de nouveautés, moins de charge mentale (8 octobre 2026)

Demande : « aucune redondance dans les recettes proposées, un maximum de nouveau ; l'app est-elle facile à comprendre et assez pratique pour enlever de la charge mentale ? »

| Règle | Contenu |
|---|---|
| Nouveau par défaut | Une recette jamais cuisinée à chaque repas tant que le catalogue en a ; vos plats complètent. Réglable (Équilibré, Surtout nos plats) dans Réglages et depuis le menu en cartes |
| Aucune redondance | Jamais deux fois le même plat dans la semaine ; pas un plat prévu il y a moins de 2 semaines s'il reste autre chose ; pas deux plats du même genre ; une découverte déjà montrée passe en dernier. La règle cède plutôt que de laisser un repas vide |
| Équilibré sans moraliser | Repères officiels comptés sur les plats prévus, par personne, source en lien ; les propositions comblent ; aucun score, aucune interdiction |
| Une action à la fois | Aujourd'hui : ce soir, ce qu'il reste à faire, une seule action pour la semaine, une seule étape des premiers pas ; les mots du batch sont ceux de la cuisine (« boîte à emporter », « Prêt »), plus de J+n |
| Ce qui dépend d'une donnée absente ne s'affiche pas | Ordre du batch sans durées, panier estimé sans 80 % des prix, grammes sans quantité : rien d'inventé, le manque est dit |

[ANOMALIE_LOGIQUE corrigée] Un plat cuisiné au batch dimanche restait marqué « À cuisiner » le jour où il est mangé : il est affiché « 👩‍🍳 Cuisiné au batch dim. ».
[ANOMALIE_LOGIQUE corrigée] Après le montant payé, les articles restaient « Pas encore acheté » tant qu'ils n'étaient pas cochés un par un : « Tout est arrivé du drive ? Oui, tout cocher ».

## 16. V3.0 — rien à saisir, le panier suit le menu, qualité-prix (9 octobre 2026)

Demande : « comme Jow, que l'import au drive se fasse pareil, sans noter les prix ou quoi que ce soit ; l'étude du meilleur rapport qualité-prix des produits de nos recettes ; le tout économe en tokens ».

| Règle | Contenu |
|---|---|
| Zéro saisie | Aucun prix demandé ; estimation automatique, source et couverture affichées |
| Le panier suit le menu | Prêt dès « Valider la semaine » ; après un changement, seulement ce qui change (＋ / −) |
| Qualité-prix lisible | Trois choix par article (meilleur rapport, moins cher, mieux noté), règles de points affichées, prix daté et lieu du relevé |
| Zéro token | Aucune IA ; données ouvertes figées chaque semaine par la CI, aucun appel pendant l'usage |

[ANOMALIE_LOGIQUE] « Exactement comme Jow » : Jow remplit le panier Auchan par un partenariat privé ; Auchan n'a pas d'API publique et ses CGU (art. 8) interdisent l'extraction automatisée sans licence. Décision du foyer : Foyer prépare tout, un toucher par article sur Auchan. Les prix « en temps réel » d'Auchan restent hors d'atteinte ; remplacés par des relevés datés et les moyennes Insee.

Fin du PRD V2.1 (révisions V2.2 à V3.0 incluses).
