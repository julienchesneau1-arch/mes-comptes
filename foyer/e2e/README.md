# Scénarios navigateur

Hors CI (ils demandent un navigateur). Depuis `foyer/` :

```
npm run build
python3 -m http.server 8765 --bind 127.0.0.1 &
npm i --no-save playwright-core @axe-core/playwright
CHROMIUM_PATH=/chemin/vers/chromium node e2e/parcours.mjs
CHROMIUM_PATH=/chemin/vers/chromium node e2e/deux-telephones.mjs
```

- `parcours.mjs` : création du foyer, recette complétée, proposition de semaine, courses, Aujourd'hui, feuille d'un créneau, rechargement (journal identique), mode découverte, grille ordinateur, zoom 200 % ; axe-core WCAG 2.0/2.1/2.2 A et AA sur 11 écrans.
- `deux-telephones.mjs` : vraie synchro par lien chiffré entre deux navigateurs (mauvais code refusé), mêmes courses des deux côtés, absence reçue et recalculée, déplacement avec aperçu, « on a mangé » avec rendement réel, navigation au clavier.

Les captures vont dans `captures/` (non versionné). Résultat attendu : toutes les étapes ✓ et « erreurs : aucune ».
