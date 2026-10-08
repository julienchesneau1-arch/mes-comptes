# Foyer — architecture

## Décisions

**ADR-1 — Rester dans la stack du dépôt.** Le PRD V2 demande de conserver la stack maintenable du dépôt. Celui-ci (Mes Comptes) est une PWA sans framework, sans dépendance d'exécution, publiée sur GitHub Pages. Foyer suit ce modèle, en **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`) compilé par `tsc` vers `js/`, servi tel quel. Pas de Next.js/Supabase/Tailwind : rien à héberger, rien à payer, rien qui casse sans réseau. Le JavaScript compilé est versionné pour que Pages le serve ; la CI vérifie qu'il correspond exactement aux sources.

**ADR-2 — Journal d'événements rejoué.** L'état n'est jamais stocké : seul le journal l'est (qui, quoi, quand). L'état est recalculé en rejouant les événements dans un **ordre commun** (horloge de Lamport, puis appareil, puis identifiant). Deux téléphones qui possèdent les mêmes événements obtiennent le même état, quel que soit l'ordre de réception. Chaque événement est **revalidé** au rejeu : s'il est devenu impossible (dernière portion déjà prise, créneau occupé entre-temps), il est écarté avec sa raison et montré comme conflit aux deux. C'est l'équivalent local des « transactions + version attendue » du PRD, sans serveur.

**ADR-3 — Idempotence et annulation.** Identifiant unique par événement : une synchro reçue deux fois n'ajoute rien. Annuler = ajouter un événement `undo` ; avant de le proposer, l'app rejoue le journal sans l'événement et **refuse** l'annulation si une action faite depuis deviendrait impossible (« Sam a depuis déclaré une portion mangée »).

**ADR-4 — Synchro chiffrée par lien.** Lien = journal complet, compressé (deflate), chiffré AES-GCM 256 avec une clé PBKDF2-SHA256 (210 000 itérations, sel aléatoire) tirée du **code du foyer**. Le code ne voyage jamais avec le lien. Fusion = union par identifiant puis rejeu. Tout événement reçu passe une validation stricte (types, longueurs, valeurs) ; tout texte est échappé à l'affichage. Même principe que Mes Comptes, déjà utilisé par le foyer.

**ADR-5 — Quantités exactes.** Fractions d'entiers (`rational.ts`) ; aucun flottant dans un calcul métier. Affichage arrondi seulement à l'écran, signalé par « ≈ ».

**ADR-6 — Dates de calendrier.** Une date est une chaîne `AAAA-MM-JJ` en heure de Paris (Intl, fuseau explicite) ; l'arithmétique se fait en jours entiers ; les instants (ISO) ne servent qu'à l'affichage. Testé autour de minuit et des changements d'heure.

**ADR-8 — Relais chiffré (synchro automatique).** Table Supabase `foyer_relais` (migration `supabase/migrations/`) : chaque ligne = une étiquette de foyer, un appareil, un bloc chiffré. Étiquette et clé AES-GCM sont tirées du code du foyer par PBKDF2 (210 000 itérations) avec deux sels distincts : l'étiquette ne permet pas de déchiffrer. La règle RLS n'autorise lecture et ajout qu'avec l'étiquette dans l'en-tête `x-foyer` ; aucune modification ni suppression. Les téléphones déposent les événements que le relais ne connaît pas encore et relèvent depuis leur dernier numéro ; la fusion reste l'union idempotente + rejeu (ADR-2). Le téléphone mémorise la liste des types d'événements de la version qui a relevé (`SCHEMA`) : si elle change après une mise à jour, il relit le relais depuis le début, pour récupérer ce qu'une ancienne version avait écarté. Sans relais configuré (`src/ui/config.ts`), l'app fonctionne exactement comme avant. En service sur un projet Supabase dédié (`foyer`, eu-west-3) ; la clé de l'app est la clé publique « publishable » (pas un JWT : l'en-tête `Authorization` n'est ajouté que pour une ancienne clé JWT).

**ADR-9 — Import web côté serveur, analyse côté téléphone.** Un navigateur ne peut pas lire la page d'un autre site (CORS). La fonction `supabase/functions/foyer-import` télécharge la page (8 s, 3 Mo maximum, ni adresse IP ni nom local) et n'en renvoie que les données schema.org extraites par `recipe-web.ts`, fichier identique à celui de l'app (un test le vérifie). Le téléphone analyse ensuite les lignes avec le même lecteur que la saisie. Déployée sans vérification JWT par la plateforme (la clé publishable n'est pas un JWT) : la fonction refuse elle-même tout appel sans la clé publique du projet ; CORS limité à l'adresse GitHub Pages.

**ADR-7 — Rien de magique.** Pas d'IA, pas de champ `safe=true`, pas de stock déduit du calendrier, pas de durée de conservation. Les seuls textes sanitaires sont des libellés factuels issus de la fiche DGCCRF citée.

**ADR-10 — Drive Auchan assisté, sans robot.** Pas d'API publique de panier Auchan, CGU hostiles aux robots, et le navigateur ne peut pas écrire chez un autre site : Foyer ouvre des pages Auchan (lien `target=_blank`, aucune requête de Foyer vers auchan.fr, CSP inchangée). L'événement `product.set` retient, pour un ingrédient, une adresse de page produit (format vérifié : `https://www.auchan.fr/…/pr-…`) et une contenance optionnelle ; `drive.ts` en déduit le nombre de paquets en fractions exactes.

**ADR-11 — Catalogue de découvertes en fichier statique, généré en CI.** Le Livre de cuisine de Wikilivres (CC BY-SA 4.0) est lu par l'API MediaWiki dans GitHub Actions (`scripts/catalogue.mjs`, workflow `catalogue`), analysé par `wikibook.ts` (déterministe, testé sur de vraies pages) et versionné en `catalogue.json`. L'app le charge à la demande (`ui/catalog.ts`), le relit (`readCatalog`) et le garde hors ligne (sw.js). Aucun serveur, aucune requête vers Wikilivres depuis le téléphone ; CSP inchangée. Une recette acceptée devient un événement `recipe.save` ordinaire, avec l'attribution dans la note.

**ADR-12 — Rappels en notification sans que le serveur les lise.** Une app web sur iPhone (iOS 16.4+, installée) reçoit des notifications Web Push, mais il faut un serveur pour les envoyer à l'heure. Le téléphone dépose dans `foyer_rappel` l'heure et un bloc chiffré (AES-GCM, clé tirée du code du foyer, données associées `foyer-rappel-v1`) ; `pg_cron` appelle toutes les 5 min la fonction `foyer-push`, qui marque les rappels échus et envoie une notification **vide** (VAPID ES256, clé privée dans le coffre Supabase) aux abonnements du foyer ; le service worker relit les rappels envoyés de son foyer, les déchiffre avec la clé rangée (non exportable) dans IndexedDB et les affiche ; message générique s'il n'y arrive pas (iOS exige une notification visible). Adresses d'abonnement limitées à Apple, Google, Mozilla et Microsoft (contrainte en base et dans la fonction). Rejeté : contenu chiffré dans la notification (RFC 8291) — plus de code serveur pour rien de plus, le texte restant de toute façon illisible pour le serveur.

**ADR-13 — Agenda du mois → repas, par règles fixes et décisions mémorisées.** Une app web ne lit pas le Calendrier de l'iPhone ; elle lit une adresse iCal (Google : adresse secrète ; iCloud : calendrier public ; Outlook : lien publié). Le navigateur ne peut pas la télécharger (CORS) : la fonction `foyer-agenda` la télécharge (fournisseurs connus seulement), la lit avec `ical.ts` (copie exacte, testée) et ne renvoie que les occurrences du mois ; le téléphone les garde en cache local (jamais dans le journal). `agenda.ts` en déduit, sans IA, les présences à changer (mots du titre, chevauchement des heures de repas) ; un seul événement gagne par repas et par personne ; tout changement est une proposition tant que le foyer n'a pas décidé « pareil les prochaines fois » (`agenda.rule`). Les présences posées d'après l'agenda (`agenda.mark`) gardent leur occurrence d'origine : retirées si l'événement disparaît (seulement après une lecture réussie), figées si quelqu'un les modifie à la main. Rejeté : connexion OAuth à Google (validation de l'application, jetons expirant au bout de 7 jours en mode test, rien pour iCloud) ; lecture sur le serveur sans le téléphone (le serveur devrait garder l'adresse et lire les repas : contraire au chiffrement de bout en bout).

**ADR-14 — Une identité visuelle sans images téléchargées.** Chaque plat reçoit un emoji et un fond coloré par règles fixes (`visual.ts`) : rendu immédiat, hors ligne, identique sur les deux téléphones, aucune requête externe (CSP inchangée), aucun droit d'image à gérer. Police Nunito (OFL) servie par l'app. Propositions en cartes (`sheets/deck.ts`) : gestes par événements de pointeur, boutons équivalents pour le clavier et VoiceOver, aucune animation si l'appareil demande moins de mouvement, aucune transparence dans les animations d'entrée (le contraste reste mesurable). Rejeté pour l'instant : photos de plats (pas de source libre fiable pour vos propres plats).

**ADR-15 — Rituel batch et budget : ce que le foyer déclare, rien de plus.** Le rituel (`settings.ritual` : jour et heure des courses, jour et heure du batch) et le batch d'un plat (`prep.batch` : jour où il est cuisiné, distinct du repas où il est servi) sont des événements du journal, donc synchronisés et annulables. Le plat garde son créneau de service : portions, boîtes, restes et courses ne changent pas de calcul ; seuls « la veille / le matin », les rappels et « Pas encore pris » se rapportent au jour du batch. `batch.ts` dérive la vue d'un batch (plats, J+n, boîtes, mise en place commune, ingrédients partagés), ce que le rituel demande aujourd'hui et la série de batchs. Les prix sont un champ du produit retenu (`product.set.price`, centimes, gardé si un téléphone pas encore à jour renvoie le produit sans prix) ; le montant payé est un événement par semaine (`shop.spent`) ; `budget.ts` n'additionne que des prix notés et marque l'estimation « au moins » s'il en manque. Rejeté : durée de conservation calculée (aucune source officielle ne donne une durée par plat maison ; repère [ANSES](https://www.anses.fr/fr/content/comment-bien-conserver-ses-aliments-et-ne-pas-interrompre-la-chaine-du-froid) en lien), ordre de cuisson calculé (pas de durées dans les recettes), prix lus sur auchan.fr (CGU).

## Carte des modules

```
src/core/            logique pure, sans DOM, testée sous Node
  rational.ts        fractions exactes
  units.ts           unités, dimensions, conversions exactes intra-dimension
  text.ts            normalisation des noms (singulier, accents, articles), échappement HTML
  ingredients.ts     saisie libre → ligne structurée ; rayons (dictionnaire + choix mémorisé)
  recipe-text.ts     coller une recette ; texte éditable aller-retour
  dates.ts           heure de Paris, semaines, créneaux, libellés français fixes
  model.ts           types, événements, validation stricte de tout ce qui arrive
  reduce.ts          rejeu déterministe, rejets motivés, fabrication des événements
  plan.ts            présences, portions à servir / préparer / libres
  shopping.ts        deriveShopping : agrégation, vérifications versionnées, coches
  status.ts          état lisible d'un créneau, problèmes à résoudre
  today.ts           écran Aujourd'hui (cartes, tâches, « pas encore pris », idées)
  propose.ts         proposition de semaine, copie de semaine, restes
  commands.ts        commandes métier → événements (poser, déplacer, retirer, manger)
  preview.ts         previewChange : simulation + différences lisibles
  watch.ts           produits surveillés : contrôles limités et sourcés
  describe.ts        phrase d'une action (conflits)
  sync.ts            chiffrement, lien, fusion, sauvegarde
  relay.ts           relais : étiquette et clé, dépôt et relève chiffrés
  recipe-web.ts      lecture schema.org d'une page de recette (partagé avec la fonction serveur)
  ics.ts             rappels de la semaine pour l'agenda
  reminders.ts       rappels en notification : heures exactes (Paris → UTC), identifiants stables, semaine vide
  wikibook.ts        lecture du wikitexte Wikilivres → recette de catalogue (ou raison d'écart)
  catalog.ts         catalogue : relecture, recherche, découvertes classées, recette → contenu
  diag.ts            diagnostic du téléphone (fonctions disponibles, conséquence de chaque manque)
  drive.ts           drive Auchan : lien produit, contenance, nombre de paquets, articles à commander
  ical.ts            lecture iCalendar : récurrences, exceptions, fuseaux (copié dans la fonction foyer-agenda)
  agenda.ts          agenda → repas : classement des événements, propositions, automatismes, retour arrière, plat décalé
  feries.ts          jours fériés français (Pâques calculé)
  visual.ts          visuel d'un plat (emoji + fond par famille)
  batch.ts           rituel batch : jours, plats du batch, J+n, mise en place commune, ce que le rituel demande aujourd'hui
  budget.ts          panier estimé (prix notés), montant payé, bilan des semaines ; money.ts : centimes et euros
  classics.ts        plats classiques proposés au démarrage
src/ui/              interface (HTML échappé, délégation d'événements, <dialog> natifs, glisser-déposer, synchro automatique, rappels : push.ts, menu en cartes : sheets/deck.ts)
supabase/            migrations (relais, rappels) et fonctions foyer-import, foyer-push et foyer-agenda (déployées le 4 octobre 2026 sur le projet dédié)
tests/               node --test, TypeScript exécuté directement par Node 22
```

## Événements

`household.init`, `members.set`, `settings.set`, `recipe.save` (nouvelle version), `recipe.archive`, `slot.presence`, `slot.guests`, `slot.cook`, `slot.from` (restes/boîte), `slot.outside`, `slot.clear`, `slot.move` (déplacer/échanger), `slot.eaten`, `prep.recipe`, `prep.extra`, `prep.start`, `prep.done` (rendement réel, version figée), `prep.correct`, `prep.discard` (motif), `task.set`, `shop.check`, `shop.pantry`, `shop.item`, `staple.set`, `aisle.set`, `product.set` (produit Auchan retenu), `agenda.set` (agenda branché), `agenda.rule` (décision mémorisée), `agenda.mark` (présence d'après l'agenda), `watch.save`, `watch.close`, `conflict.ack`, `undo`.

Correspondance avec les entités du PRD V2 §14 : WeekPlan/MealSlot/Attendance → créneaux + présences ; PreparationPlan/MealAllocation → `prep` + `slot.from` ; PortionBatch/Reservation/Event → `prep.done` + réservations implicites des créneaux liés + `slot.eaten`/`prep.discard` ; ShoppingSnapshot/PantryCheck → `deriveShopping` + `shop.pantry` signé par le besoin ; SensitiveItem/DateDeclaration → `watch.save` ; AuditEvent → le journal lui-même.

## Sécurité et vie privée

- CSP : `script-src 'self'`, `style-src 'self'`, `connect-src 'self'` plus, seulement si un relais est configuré, son adresse exacte ; aucun script ni style en ligne (testé).
- Données : sur le téléphone (localStorage relu après écriture, copies de secours IndexedDB). Avec le relais : seulement des blocs chiffrés de bout en bout ; le relais voit une étiquette pseudonyme, des identifiants d'appareil, des heures et des tailles.
- Rappels : le serveur voit l'étiquette du foyer, l'heure de chaque rappel, un bloc chiffré et l'adresse d'abonnement du téléphone (chez Apple, Google, Mozilla ou Microsoft) ; rappels effacés 2 jours après leur heure.
- Agenda : l'adresse iCal est dans le journal chiffré ; la fonction `foyer-agenda` la reçoit à chaque lecture, télécharge l'agenda, renvoie le mois et ne conserve rien ; les événements lus restent en cache sur le téléphone (`foyer:agenda`), jamais au relais.
- Hébergement partagé avec Mes Comptes : clés de stockage préfixées `foyer:`, base IndexedDB `foyer`, caches `foyer-*`, service worker de portée `foyer/`. Le service worker de Mes Comptes ne supprime plus que ses propres caches.
- Données personnelles minimales : prénoms, plats, dates déclarées. Sauvegarde JSON lisible (non chiffrée, à garder pour soi) ; liens de synchro chiffrés.
