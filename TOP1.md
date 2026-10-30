# Grille « top 1 % » : Mes Comptes et Foyer

Une seule grille pour les deux apps. Chaque critère a un seuil public, une mesure et un contrôle. Est « vérifié en CI » ce que le job `telephones` de `.github/workflows/tests.yml` rejoue à chaque envoi, sur iPhone 13 (WebKit, le moteur de Safari) et Pixel 7 (Chromium) : `e2e/parcours.mjs` pour Mes Comptes, `foyer/e2e/telephones.mjs` pour Foyer.

Mesures du 30 octobre 2026 : Pixel 7 émulé, processeur ralenti ×4 (téléphone milieu de gamme), données de l'exemple fictif, 3 passages (fourchette donnée).

## Parité

| Critère | Seuil (source) | Mes Comptes | Foyer | CI |
|---|---|---|---|---|
| Accessibilité | WCAG 2.2 A et AA, 0 violation axe-core ([W3C](https://www.w3.org/TR/WCAG22/)) | 0 sur 13 écrans par moteur (6 onglets × clair/sombre + premier écran) | 0 sur 11 écrans par moteur (accueil, rythme, menu proposé, 4 onglets × clair/sombre) | ✔ |
| Cibles tactiles | ≥ 24 px (WCAG 2.5.8, contrôlé par axe) ; ≥ 44 pt visé ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility)) | 211/215 ≥ 44 px (98 %) ; reste : cases à cocher de 22 px dans une ligne cliquable | 136/138 ≥ 44 px (99 %) ; reste : 2 liens de source de 40 px | 24 px ✔ ; 44 px mesuré, non bloquant |
| Premier affichage | LCP ≤ 2,5 s ([web.dev](https://web.dev/articles/vitals)) | 0,64 à 0,86 s | 1,0 à 1,5 s | mesuré |
| Réponse à un toucher | INP ≤ 200 ms ([web.dev](https://web.dev/articles/vitals)) ; 100 ms visé | changement d'onglet médian 109 à 128 ms (203 ms avant le 30 octobre) | médian 62 à 123 ms | mesuré |
| Calcul le plus lourd | sous 100 ms visé | rendu d'un onglet : 19 à 62 ms au processeur ×4, HTML compris (le reste est la mise en page) | menu de la semaine (424 recettes) : 1,6 à 1,8 s → 0,10 à 0,36 s, sans ralentissement | sortie identique vérifiée |
| Densité (mots visibles, exemple fictif) | une information principale par écran, le reste replié | Accueil 172 · Opérations 303 (liste) · Épargner 169 · Comptes 290 · Tendances 181 (avant : 187 · 303 · 196 · 349 · 514) | Aujourd'hui 161 · Semaine 180 · Courses 255 (liste) · Maison 90 (avant : 240 · 281 · 255 · 90) | mesuré |
| Poids au premier chargement | aussi bas que possible, puis hors ligne | 346 Ko | 1 542 Ko (424 recettes et prix embarqués) | mesuré |
| Hors ligne | l'app s'ouvre sans réseau, données intactes | ✔ coffre ouvert, opérations là | ✔ mêmes courses | ✔ |
| Rechargement | aucune donnée perdue | ✔ coffre relu, mauvais code refusé | ✔ mêmes courses (défaut trouvé et corrigé, voir plus bas) | ✔ |
| Rien ne dépasse | aucun défilement horizontal sur téléphone | ✔ tous les onglets, 4 profils | ✔ 4 onglets, clair et sombre | ✔ |
| Erreurs | 0 erreur JavaScript dans la page | ✔ | ✔ | ✔ |
| Réseau | aucun appel hors de l'app | ✔ CSP `connect-src 'self'`, aucun tiers | ✔ seul le relais chiffré (simulé en test) | Foyer ✔ |
| Données au repos | chiffrement fort ([OWASP MASVS](https://mas.owasp.org/MASVS/), [PBKDF2 ≥ 600 000](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)) | coffre AES-GCM, clé PBKDF2 600 000 tours ; Face ID / empreinte en option | synchro chiffrée de bout en bout ; le relais ne voit que du chiffré | tests unitaires |
| iPhone et Android | les deux moteurs, à chaque envoi | ✔ | ✔ | ✔ |
| Tests unitaires | toujours verts | `node test.js` | 207 tests (`npm test`) | ✔ |

## Ce que cette passe a trouvé et corrigé

- Foyer : 15 recettes prêtes sur 424 avaient une ligne d'ingrédient de plus de 80 caractères. Approuvées, elles s'affichaient, puis disparaissaient du planning au rechargement et n'allaient jamais sur l'autre téléphone. Même défaut pour une ligne longue tapée dans une recette. Les recettes sont maintenant ramenées dans les limites (suite gardée en note), et l'app refuse en le disant ce qu'elle ne pourrait pas garder (V3.21).
- Mes Comptes : chaque montant et chaque date recréait un formateur ; ils sont maintenant créés une fois. Changement d'onglet 1,6 à 1,9 fois plus rapide, affichage identique à l'octet près sur 25 écrans.
- Foyer : « Proposer le menu » recalculait le rayon et la forme normalisée de chaque ingrédient de chaque recette pour chaque repas (≈ 60 000 fois). Ces résultats sont maintenant gardés : 5 à 16 fois plus rapide, même menu à l'identique (9 semaines × 3 réglages, 3 468 lignes comparées).
- Mes Comptes : hors ligne juste après la première visite, `core.js?v=…` n'était pas retrouvé ; la copie mise de côté à l'installation sert maintenant.
- Accessibilité : contrastes (WCAG 4,5:1), noms lus égaux au texte affiché (WCAG 2.5.3) dans les deux apps, tableau défilant atteignable au clavier, cibles de 44 px.

## Limites connues (dites, pas cachées)

- Tests sur WebKit : ils tournent dans un profil sur disque, comme un vrai téléphone. En profil privé, WebKit perdait le cache à la coupure réseau simulée, une fois sur deux (constaté, puis écarté). Pendant une capture d'écran, Playwright injecte un style que la CSP stricte de Foyer refuse : ce seul cas est ignoré (prouvé par l'étape et l'absence de fichier source), toute autre erreur reste bloquante.
- WebKit sous Linux n'est pas l'iPhone : rien n'a été vérifié sur un vrai iPhone ni avec VoiceOver ou TalkBack. axe ne détecte qu'une partie des défauts d'accessibilité : un passage au lecteur d'écran reste à faire.
- Foyer pèse 1,5 Mo au premier chargement (catalogue de recettes). Ensuite il sert depuis le téléphone.
- Mes Comptes reste au-dessus des 100 ms visés pour un changement d'onglet sur un téléphone milieu de gamme. Le temps restant est surtout la mise en page (jusqu'à 849 éléments sur Tendances), pas le calcul.
- Les comptes bancaires ne se synchronisent pas tout seuls : import des relevés seulement (règle du dépôt : aucun agrégateur).
- 4 scénarios navigateur de Foyer (`parcours`, `rituel`, `facture`, `deux-telephones`) demandent `foyer/e2e/catalogue-essai.json`, absent du dépôt.

## Rejouer

```
npm i --no-save --no-package-lock playwright@1.63.0 @axe-core/playwright@4.14.0
npx playwright install chromium webkit
node e2e/parcours.mjs            # Mes Comptes
node foyer/e2e/telephones.mjs    # Foyer
```
