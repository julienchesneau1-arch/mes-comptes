# Dépôt mes-comptes

Deux apps, publiées par GitHub Pages dès que `main` est poussé (`https://julienchesneau1-arch.github.io/mes-comptes/`) :

- racine : **Mes Comptes** (budget du foyer) : `index.html`, `core.js`, `sw.js`, `test.js`. Pas de build.
- `foyer/` : **Foyer** (repas et courses) : voir `foyer/README.md`.

## Mes Comptes : règles

- Tests : `node test.js` doit finir sans erreur (la CI le relance).
- Dépôt public : aucun vrai libellé, montant, numéro de compte, nom, commerce ou lieu dans le code, les tests ou les messages de commit. Données fictives uniquement.
- Les vrais relevés sont dans `releves/`, sur le Mac seulement (ignoré par git, jamais publié). Une session cloud ne les a pas : si la lecture des relevés (PDF, CSV, OFX) change, le dire, à vérifier sur le Mac avec `node verifier-releves.mjs`.
- Zéro dépendance : aucun serveur, aucun service tiers (ni agrégateur bancaire, ni IA) dans l'app.
- Chaque foyer est isolé sur ses téléphones : personne, testeurs compris, ne voit les données d'un autre.
- Pas de rouge dans l'app : vert, ambre, orange brûlé, gris.
- Chaque publication : monter la version du cache `C` dans `sw.js` (`mescomptes-vNN`). Foyer partage le site : ne toucher qu'aux caches et clés `mescomptes*`.
- iPhone : le stockage est un coffre chiffré (`mescomptes-coffre`). Ne jamais l'écraser par un état qui a perdu des opérations ; la copie « -secours » existe pour ça (voir `flush` dans `index.html`).
- Tester les imports avec des noms de fichiers réalistes (accents, apostrophes, « (1) »), pas seulement les fichiers de test.
- Sur le Mac : ne jamais pousser les branches locales `archive-*`.
