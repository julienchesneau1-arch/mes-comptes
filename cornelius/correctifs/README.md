# Correctifs maison pour Cornelius

Cinq modifications de [Cornelius](https://github.com/lfpoulain/Cornelius), au format `git format-patch`, à appliquer sur la version auditée `ad056d46c129a1ed8b199af8271cb21a6a5849af`. Le script [`../labo-macos.sh`](../labo-macos.sh) les applique sans git, depuis `fichiers.tar.gz` : les 24 fichiers modifiés ou ajoutés, tels qu'après application des 5 correctifs (vérifié : version auditée + archive = arbre corrigé, à l'identique). Il les réapplique quand l'archive change.

Régénérer l'archive après une modification (depuis le dépôt Cornelius, branche des correctifs) :

```sh
git diff --name-only -z ad056d4 HEAD | xargs -0 git archive --format=tar.gz -o <mes-comptes>/cornelius/correctifs/fichiers.tar.gz HEAD --
```

| Correctif | Ce qu'il change | Tests ajoutés |
| --- | --- | --- |
| 0001 Caméra | `perception/camera.py` : AVFoundation sous macOS (V4L2 n'existe que sous Linux) | — (vérifié sur le Mac au premier lancement) |
| 0002 Réseau privé virtuel | `CORNELIUS_VPN=1` admet aussi 100.64.0.0/10 (Tailscale), seulement avec `CORNELIUS_LAN=1` ; rien d'autre ne s'ouvre | 2 unitaires (`tests/network.test.ts`) |
| 0003 Installable | Manifeste plein écran, icônes, balises iPad/iPhone (`web/index.html`, `web/public/`) | 1 navigateur (`installable.spec.ts`) |
| 0004 Lisibilité | Tablette tactile en paysage : textes et cartes du miroir 40 % plus grands ; portrait inchangé | 1 navigateur (`mirror.spec.ts`) |
| 0005 Écrire | `POST /api/text` et page `/telephone` : conversation écrite au nom du foyer | 12 unitaires (`text-chat.test.ts`) + 5 navigateur (`telephone.spec.ts`) |

Résultat sur la version auditée + ces correctifs : **630 tests unitaires et 114 tests navigateur réussis** (Chromium, Linux), `tsc` et Prettier sans erreur.

## Appliquer à la main

```sh
cd <Cornelius> && git checkout ad056d46c129a1ed8b199af8271cb21a6a5849af
git -c user.name="Cornelius maison" -c user.email=maison@localhost am <mes-comptes>/cornelius/correctifs/*.patch
```

## Licence

Cornelius est distribué sous [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Ces correctifs en sont des modifications, pour un usage domestique non commercial, et restent soumis à cette licence.

Required Notice: Copyright (c) 2026 Entremakers SAS, Les Frères Poulain (https://github.com/lfpoulain/Cornelius)
