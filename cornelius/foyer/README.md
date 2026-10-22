# Module Cornelius « foyer »

Cornelius lit Foyer comme un troisième téléphone du foyer, **en lecture seule** : ce qu'on mange ce soir et demain midi, les tâches de la veille (« sortir le poulet »), les boîtes à préparer, ce qui n'est pas encore acheté, et la liste de courses de la semaine.

## Comment il lit

- Il relève les blocs chiffrés du relais de Foyer (même table, même règle d'accès que les téléphones), les déchiffre avec le **code du foyer**, puis rejoue le journal avec le code de Foyer lui-même (`foyer/src/core` : `relay`, `reduce`, `today`, `shopping`). Aucun calcul n'est refait à part : la carte dit exactement ce que montre l'écran « Aujourd'hui ».
- **Jamais d'écriture** : toute requête autre qu'un GET de la table `foyer_relais` est refusée avant de partir (testé).
- Le code du foyer est un jeton de Cornelius (`CORNELIUS_FOYER_CODE`, ou **Mise en route → Clés et jetons**) : il reste sur le serveur, n'est jamais envoyé au navigateur ni au modèle, et est masqué dans le journal. Comme les autres jetons de Cornelius, il est gardé **en clair** dans la base locale (`data/cornelius.sqlite`) : protégez l'ordinateur.
- Le relevé vaut 10 minutes au plus, et jamais au-delà de 15 h ou de minuit (le menu affiché change à ces heures-là).
- Le journal déjà lu reste en mémoire : chaque relevé ne demande que les blocs nouveaux, avec le même curseur que les téléphones. Le premier relevé après un démarrage de Cornelius relit tout, jusqu'au dernier bloc même au-delà de 10 000 (testé).

## Réglages

1. Dans Foyer : **Maison › Réglages › Synchro**, noter le code du foyer (12 lettres et chiffres). La synchro automatique doit être active sur au moins un téléphone.
2. Dans Cornelius : **Modules → Foyer**, saisir le code, puis **Ajouter une source** pour le **foyer** (pas pour une personne : ce sont les repas de toute la maison).
3. Facultatif : **Afficher en permanence** pour voir « Ce soir / Demain midi / À faire » sur le miroir ou la tablette.

## À la voix

Outil `foyer__read`, argument facultatif `vue` :

| Demande | Vue | Carte |
| --- | --- | --- |
| « On mange quoi ce soir ? », « qu'est-ce qu'il faut sortir du congélateur ? » | `aujourdhui` (par défaut) | Ce soir, demain midi, à faire, pas encore acheté |
| « Qu'est-ce qu'il reste à acheter ? » | `courses` | Articles restants de la semaine, par rayon |

## Ce qu'il dit quand ça ne va pas

| Situation | Réponse |
| --- | --- |
| Code absent ou mal formé | « Réglage incomplet », aucune requête envoyée |
| Code d'un autre foyer, ou synchro jamais activée | « Introuvable » — jamais « rien de prévu » |
| Blocs illisibles avec ce code | « Identifiants refusés » |
| Relais en panne | Vue du jour et affichage permanent : échec au premier relevé, ensuite le dernier relevé, annoncé comme tel. Une demande avec `vue` (la liste de courses) est toujours relue en direct par Cornelius : échec annoncé, jamais une ancienne liste |
| Réponse coupée | « Réponse illisible », jamais une liste partielle |
| Aucun plat posé | « Rien de prévu », dit comme un fait du menu |

## Tests

```sh
cd <Cornelius> && CORNELIUS_MODULES_DIR=<mes-comptes>/cornelius npm run test:modules
```

Le relais est simulé (même règle d'accès par étiquette) et les blocs sont chiffrés par Foyer avec le journal de démonstration. **Non vérifié ici** : la lecture du vrai relais Supabase (inaccessible depuis l'environnement de test) — à essayer avec **Tester** dans l'administration de Cornelius.

## Limites

- Heure de Paris, comme Foyer.
- Le journal lu est gardé en mémoire tant que Cornelius tourne (sa taille suit l'historique, non mesurée sur un vrai foyer) ; la dérivation des clés (≈ 0,2 s) n'est refaite qu'au démarrage ou si le code change.
- Si Foyer change le format de ses événements, le module suit automatiquement (il importe le code de Foyer) ; une version ancienne de Cornelius chargée avec un Foyer plus récent ne pose pas de problème, l'inverse non plus.
