#!/bin/bash
# Installe, démarre et vérifie Cornelius sur ce Mac en une seule commande (Terminal) :
#   curl -fsSL https://raw.githubusercontent.com/julienchesneau1-arch/mes-comptes/refs/heads/claude/tender-cori-m8232m/cornelius/installer-mac.sh -o ~/installer-cornelius.sh && bash ~/installer-cornelius.sh
# Sans git, sans droits administrateur. Relançable : met à jour et ne refait que ce qui manque.
# Journal sans secret : ~/cornelius-lab/logs/installation.log
set -eu
BRANCH=claude/tender-cori-m8232m
LAB="$HOME/cornelius-lab"
REPO="$LAB/mes-comptes"
LOG="$LAB/logs/installation.log"
mkdir -p "$LAB/logs" "$LAB/cache"
exec > >(tee -a "$LOG") 2>&1
trap 'printf "\n!! Échec. Envoyez la fin du journal (aucun secret dedans) :\n   tail -40 %s\n" "$LOG"' ERR
say() { printf '\n==== %s\n' "$*"; }

echo "Installation de Cornelius — $(date '+%Y-%m-%d %H:%M')"

say "1/5 Fichiers de la maison (modules, correctifs, scripts)"
curl -fL --progress-bar -o "$LAB/cache/mes-comptes.tgz" \
  "https://codeload.github.com/julienchesneau1-arch/mes-comptes/tar.gz/refs/heads/$BRANCH"
rm -rf "$REPO.new" && mkdir -p "$REPO.new"
tar -xzf "$LAB/cache/mes-comptes.tgz" -C "$REPO.new" --strip-components=1
if [ -x "$LAB/stop.sh" ]; then bash "$LAB/stop.sh"; fi
rm -rf "$REPO" && mv "$REPO.new" "$REPO"

say "2/5 Cornelius (long la première fois : Node, Python, modèles)"
bash "$REPO/cornelius/labo-macos.sh" </dev/null

say "3/5 Modules Foyer et Mes Comptes"
grep -q '^CORNELIUS_MODULES_DIR=' "$LAB/cornelius/.env" \
  || echo "CORNELIUS_MODULES_DIR=$REPO/cornelius" >>"$LAB/cornelius/.env"
echo "Modules : $REPO/cornelius"

say "4/5 Démarrage (macOS peut demander l'accès à la caméra et au micro pour Terminal : accepter)"
bash "$LAB/start.sh" </dev/null

say "5/5 Bilan"
bash "$REPO/cornelius/verifier-macos.sh" || true

pbcopy <"$LAB/mot-de-passe-admin.txt"
open "http://127.0.0.1:3000/admin#start"
cat <<'FIN'

==== Il reste à saisir la clé OpenAI (dans le navigateur qui vient de s'ouvrir)
  1. Mot de passe administrateur : déjà copié, collez-le avec ⌘V, puis « Ouvrir cet espace ».
  2. Mise en route → Clés et jetons → collez la clé OpenAI → Enregistrer.
  3. Essayez : http://127.0.0.1:3000/telephone (écrire) et http://127.0.0.1:3000/ (miroir, « Activer la voix »).
  Ne collez jamais la clé dans une conversation.
  Bilan à tout moment : bash ~/cornelius-lab/mes-comptes/cornelius/verifier-macos.sh
FIN
