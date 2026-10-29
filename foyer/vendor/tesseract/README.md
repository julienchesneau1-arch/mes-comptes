# Tesseract (lecture de texte sur le téléphone) — « 📸 Prendre la date en photo »

Chargé à la demande (`ui/ocr.ts`), seulement à la première photo : environ 3,8 Mo (bibliothèque, worker, cœur WebAssembly
d'une seule variante, modèle français). Ensuite gardé hors ligne par le service worker (même mécanisme que pdf.js). Aucun appel
réseau ailleurs : chemins locaux imposés (`workerPath`, `corePath`, `langPath`), sans CDN, sans cache IndexedDB (`cacheMethod: 'none'`).

| Fichier | Paquet npm (version, publication) | SHA-256 |
|---|---|---|
| `tesseract.esm.min.js` | `tesseract.js` 7.0.0 (15 déc. 2025), `dist/` | `64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29` |
| `worker.min.js` | `tesseract.js` 7.0.0, `dist/` | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `tesseract-core-simd-lstm.js` | `tesseract.js-core` 7.0.0 (15 déc. 2025) | `e48e2f02ddae3716c8dd24bf41cd290d4efa96892d689cdc4013c2545d63f469` |
| `tesseract-core-simd-lstm.wasm` | `tesseract.js-core` 7.0.0 | `34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea` |
| `tesseract-core-lstm.js` | `tesseract.js-core` 7.0.0 (appareils sans SIMD WebAssembly, iOS < 16.4) | `6510efc4e8b45c5465df30679b9911ffe0071cd2ee982fa064e6f5136ef2de85` |
| `tesseract-core-lstm.wasm` | `tesseract.js-core` 7.0.0 | `66b17df6e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3` |
| `fra.traineddata.gz` | `@tesseract.js-data/fra` 1.0.0 (4 sept. 2023), `4.0.0_best_int/` | `d611139672b3752c7097e671e4a1d9209dfd37f2aeb081ef6487fba3351e9255` |

Empreintes des paquets (registre npm, vérifiées avec `npm pack`) :
- `tesseract.js@7.0.0` : sha1 `4106fb6245efab40c57b94bc1798368807526be8`, intégrité `sha512-exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA==`
- `tesseract.js-core@7.0.0` : sha1 `596aa1ab5c130adab12f21059e6aa1a1cecc0bab`, intégrité `sha512-WnNH518NzmbSq9zgTPeoF8c+xmilS8rFIl1YKbk/ptuuc7p6cLNELNuPAzcmsYw450ca6bLa8j3t0VAtq435Vw==`
- `@tesseract.js-data/fra@1.0.0` : sha1 `fbcfa9be69141b4c4fced96ea968ce497d28d882`, intégrité `sha512-pp58gMaoyidoBBLd5y5rnf0WW0Y1994QrGqZrYatITqIU/AReUJMykD+YY3JDgvnmgz7uAx1UmhjjuyEmV8JEA==`

Licences : `tesseract.js` et `tesseract.js-core` Apache-2.0 (`LICENSE`, identique dans les deux paquets) ; bibliothèques incluses
dans le worker : `worker.min.js.LICENSE.txt` (MIT, BSD-3-Clause). Modèle `fra` : issu de tesseract-ocr/tessdata (Apache-2.0),
empaqueté sous licence MIT par `@tesseract.js-data`.

Sécurité : le cœur et le modèle tournent dans le worker (fichier du même site, `worker-src 'self'`, sans URL blob). Aucun `eval`
ni `new Function` exécuté : `worker.min.js` ne contient qu'un `new Function("return this")` de secours, jamais atteint
(`globalThis` existe partout). Messages de Tesseract envoyés vers `/dev/null` (`debug_file`).

Fichiers non copiés : variantes `relaxedsimd` et non-LSTM (inutiles avec `oem` 1), versions `.wasm.js` (WebAssembly en base64,
+1 Mo), cartes source.

Mise à jour : `npm pack tesseract.js@<v> tesseract.js-core@<v> @tesseract.js-data/fra@<v>` (versions publiées depuis au moins deux
semaines), comparer `shasum` à `npm view <paquet>@<v> dist.shasum`, copier les fichiers ci-dessus, mettre à jour ce tableau, puis
`node --test tests/v320.test.ts`, `node e2e/photo.mjs` et `node e2e/lecture-photo.mjs` (taux de lecture à reporter dans docs/PLAN.md).
