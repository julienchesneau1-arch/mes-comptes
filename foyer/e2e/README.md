# Scénarios navigateur

Hors CI (ils demandent un navigateur). Depuis `foyer/` :

```
npm run build
python3 -m http.server 8765 --bind 127.0.0.1 &
npm i --no-save playwright-core @axe-core/playwright
CHROMIUM_PATH=/chemin/vers/chromium node e2e/parcours.mjs
CHROMIUM_PATH=/chemin/vers/chromium node e2e/deux-telephones.mjs
CHROMIUM_PATH=/chemin/vers/chromium node e2e/synchro-auto.mjs   # sert lui-même une copie de l'app sur le port 8767
```

- `parcours.mjs` : création du foyer, recette complétée, proposition de semaine, courses, Aujourd'hui, feuille d'un créneau, rechargement (journal identique), mode découverte, grille ordinateur, zoom 200 % ; axe-core WCAG 2.0/2.1/2.2 A et AA sur 11 écrans.
- `deux-telephones.mjs` : vraie synchro par lien chiffré entre deux navigateurs (mauvais code refusé), mêmes courses des deux côtés, absence reçue et recalculée, déplacement avec aperçu, « on a mangé » avec rendement réel, navigation au clavier.

- `synchro-auto.mjs` : synchro automatique sur une copie de l'app pointée vers un relais simulé (API REST + RLS + fonction d'import) : le second téléphone rejoint avec le seul code, import d'une adresse web, mêmes courses, coche propagée, aucun texte en clair dans le relais.

Le relais réel étant configuré dans l'app, `parcours.mjs` et `deux-telephones.mjs` le remplacent par un relais muet propre à chaque téléphone (aucun appel sortant ; la synchro par lien est éprouvée seule).

Les captures vont dans `captures/` (non versionné). Résultat attendu : toutes les étapes ✓ et « erreurs : aucune ».
