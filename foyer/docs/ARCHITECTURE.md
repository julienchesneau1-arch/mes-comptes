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
  wikibook.ts        lecture du wikitexte Wikilivres → recette de catalogue (ou raison d'écart)
  catalog.ts         catalogue : relecture, recherche, découvertes classées, recette → contenu
  diag.ts            diagnostic du téléphone (fonctions disponibles, conséquence de chaque manque)
  drive.ts           drive Auchan : lien produit, contenance, nombre de paquets, articles à commander
src/ui/              interface (HTML échappé, délégation d'événements, <dialog> natifs, glisser-déposer, synchro automatique)
supabase/            migration du relais et fonction d'import web (déployées le 4 octobre 2026 sur le projet dédié)
tests/               node --test, TypeScript exécuté directement par Node 22
```

## Événements

`household.init`, `members.set`, `settings.set`, `recipe.save` (nouvelle version), `recipe.archive`, `slot.presence`, `slot.guests`, `slot.cook`, `slot.from` (restes/boîte), `slot.outside`, `slot.clear`, `slot.move` (déplacer/échanger), `slot.eaten`, `prep.recipe`, `prep.extra`, `prep.start`, `prep.done` (rendement réel, version figée), `prep.correct`, `prep.discard` (motif), `task.set`, `shop.check`, `shop.pantry`, `shop.item`, `staple.set`, `aisle.set`, `product.set` (produit Auchan retenu), `watch.save`, `watch.close`, `conflict.ack`, `undo`.

Correspondance avec les entités du PRD V2 §14 : WeekPlan/MealSlot/Attendance → créneaux + présences ; PreparationPlan/MealAllocation → `prep` + `slot.from` ; PortionBatch/Reservation/Event → `prep.done` + réservations implicites des créneaux liés + `slot.eaten`/`prep.discard` ; ShoppingSnapshot/PantryCheck → `deriveShopping` + `shop.pantry` signé par le besoin ; SensitiveItem/DateDeclaration → `watch.save` ; AuditEvent → le journal lui-même.

## Sécurité et vie privée

- CSP : `script-src 'self'`, `style-src 'self'`, `connect-src 'self'` plus, seulement si un relais est configuré, son adresse exacte ; aucun script ni style en ligne (testé).
- Données : sur le téléphone (localStorage relu après écriture, copies de secours IndexedDB). Avec le relais : seulement des blocs chiffrés de bout en bout ; le relais voit une étiquette pseudonyme, des identifiants d'appareil, des heures et des tailles.
- Hébergement partagé avec Mes Comptes : clés de stockage préfixées `foyer:`, base IndexedDB `foyer`, caches `foyer-*`, service worker de portée `foyer/`. Le service worker de Mes Comptes ne supprime plus que ses propres caches.
- Données personnelles minimales : prénoms, plats, dates déclarées. Sauvegarde JSON lisible (non chiffrée, à garder pour soi) ; liens de synchro chiffrés.
