# pdf.js (Mozilla) — lecture des factures du drive

- Paquet npm `pdfjs-dist` **6.3.289** (publié le 29 août 2026), build `legacy/` (navigateurs plus anciens, dont Safari iOS).
- Fichiers copiés tels quels, renommés `.min.mjs` → `.min.js` (chargés explicitement comme modules : aucun type MIME `.mjs` requis à l'hébergement).
- Licence : Apache-2.0 (`LICENSE`, copie de celle du paquet).
- Empreinte du paquet (registre npm) : sha1 `9e46d89489782a479f58d674ae5ddde8481aaa17`,
  intégrité `sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==`.
- SHA-256 des fichiers :
  - `pdf.min.js` : `f401927e692efc7735e0cd528c490d0dd31b7f0972c122b7040df805be45cce4`
  - `pdf.worker.min.js` : `a33cfe728c584fdba4fcc1fd54bcdc2f9f2f13889ddbb5b2bd1d0f8cbe49b84e`
- Aucun `eval` ni `new Function` dans cette version (vérifié) : compatible avec la politique de sécurité de l'app (`script-src 'self'`).
- Chargé à la demande, seulement quand on lit une facture (1,8 Mo), puis gardé hors ligne par le service worker.
  Aucun appel réseau : ni polices, ni CMaps, ni WebAssembly (inutiles pour extraire le texte).

Mise à jour : `npm pack pdfjs-dist@<version>` (version publiée depuis au moins deux semaines), vérifier `shasum` contre
`npm view pdfjs-dist@<version> dist.shasum`, copier `legacy/build/pdf.min.mjs` et `pdf.worker.min.mjs` ici sous les noms ci-dessus,
mettre à jour ce fichier, puis `node --test tests/facture.test.ts` et `node e2e/facture.mjs`.
