#!/bin/bash
# Labo Cornelius sur macOS Intel : tout dans ~/cornelius-lab, sans sudo, Homebrew ni git
# (les outils de développement d'Apple ne sont pas nécessaires).
# Le plus simple : installer-mac.sh, qui télécharge ce dépôt puis lance ce script.
# À la main : bash ~/cornelius-lab/mes-comptes/cornelius/labo-macos.sh
# Relançable sans risque : seules les étapes manquantes sont refaites (correctifs mis à jour compris).
# Retour arrière complet : bash ~/cornelius-lab/stop.sh ; rm -rf ~/cornelius-lab
set -eu
LAB="$HOME/cornelius-lab"
APP="$LAB/cornelius"
COMMIT=ad056d46c129a1ed8b199af8271cb21a6a5849af
NODE_SHA=d839ef904d7305f429d45288a8b0b43b095e9797dbbcf3bd67b0c8712066b7a3
# Empreinte de l'ensemble des fichiers de la version auditée (voir manifest()).
SRC_SHA=dadf3db5b7126c830806b4e758f6c6244e98a15e52b337af79fa05677afe196d
PATCHES="$(cd "$(dirname "$0")" && pwd)/correctifs"
OVERLAY="$PATCHES/fichiers.tar.gz"
say() { printf '\n== %s\n' "$*"; }
manifest() { (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256 | awk '{print $1}'); }

say "Vérifications"
[ "$(uname -m)" = x86_64 ] || { echo "Mac Intel (x86_64) attendu."; exit 1; }
v="$(sw_vers -productVersion)"; maj="${v%%.*}"; rest="${v#*.}"; min="${rest%%.*}"
if [ "$maj" -lt 13 ] || { [ "$maj" -eq 13 ] && [ "$min" -lt 5 ]; }; then
  echo "macOS $v : 13.5 minimum (Node 24, OpenCV, ONNX Runtime)."; exit 1
fi
[ "$(df -g "$HOME" | awk 'NR==2{print $4}')" -ge 6 ] || { echo "Moins de 6 Go libres."; exit 1; }
[ -f "$OVERLAY" ] || { echo "Correctifs introuvables : $OVERLAY."; exit 1; }
if p="$(cat "$LAB/serveur.pid" 2>/dev/null)" && kill -0 "$p" 2>/dev/null; then
  echo "Cornelius tourne : bash ~/cornelius-lab/stop.sh, puis relancez ce script."; exit 1
fi
echo "macOS $v, $(sysctl -n hw.model), $(($(sysctl -n hw.memsize) / 1073741824)) Go : OK"
mkdir -p "$LAB/bin" "$LAB/cache" "$LAB/logs"

if [ ! -x "$LAB/node/bin/node" ]; then
  say "Node.js 24.2.0 (empreinte vérifiée)"
  curl -fL --progress-bar -o "$LAB/cache/node.tgz" https://nodejs.org/dist/v24.2.0/node-v24.2.0-darwin-x64.tar.gz
  echo "$NODE_SHA  $LAB/cache/node.tgz" | shasum -a 256 -c -
  mkdir -p "$LAB/node" && tar -xzf "$LAB/cache/node.tgz" -C "$LAB/node" --strip-components=1
fi
export PATH="$LAB/node/bin:$LAB/bin:$PATH"

if [ ! -x "$LAB/bin/uv" ]; then
  say "uv : Python 3.12 sans droits administrateur (empreinte vérifiée)"
  U=https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-apple-darwin.tar.gz
  curl -fL --progress-bar -o "$LAB/cache/uv.tgz" "$U"
  echo "$(curl -fsSL "$U.sha256" | awk '{print $1}')  $LAB/cache/uv.tgz" | shasum -a 256 -c -
  tar -xzf "$LAB/cache/uv.tgz" -C "$LAB/cache" && cp "$LAB/cache/uv-x86_64-apple-darwin/uv" "$LAB/bin/uv"
fi
export UV_PYTHON_INSTALL_DIR="$LAB/python" UV_CACHE_DIR="$LAB/cache/uv"

# Version auditée, depuis l'archive GitHub : gardée intacte dans le cache, vérifiée fichier par fichier.
SRC="$LAB/cache/cornelius-${COMMIT:0:7}"
if [ ! -f "$SRC/package.json" ]; then
  say "Cornelius, version auditée ${COMMIT:0:7} (empreinte vérifiée)"
  curl -fL --progress-bar -o "$LAB/cache/cornelius.tgz" "https://codeload.github.com/lfpoulain/Cornelius/tar.gz/$COMMIT"
  rm -rf "$SRC.tmp" && mkdir -p "$SRC.tmp"
  tar -xzf "$LAB/cache/cornelius.tgz" -C "$SRC.tmp" --strip-components=1
  [ "$(manifest "$SRC.tmp")" = "$SRC_SHA" ] \
    || { rm -rf "$SRC.tmp"; echo "Archive de Cornelius différente de la version auditée : arrêt."; exit 1; }
  mv "$SRC.tmp" "$SRC"
fi

# Correctifs maison (fichiers modifiés ou ajoutés, équivalents à correctifs/*.patch) : remis sur la
# version auditée quand ils changent. Les fichiers propres au labo (.env, base, modèles, .venv,
# node_modules) sont conservés ; une modification à la main du code de Cornelius serait écrasée.
SUM="$(shasum -a 256 "$OVERLAY" | awk '{print $1}')"
if [ ! -f "$APP/package.json" ] || [ "$(cat "$LAB/correctifs.sha256" 2>/dev/null)" != "$SUM" ]; then
  say "Correctifs maison : caméra macOS, téléphones, plein écran, lisibilité, conversation écrite"
  mkdir -p "$APP"
  cp -R "$SRC/." "$APP/"
  tar -xzf "$OVERLAY" -C "$APP"
  rm -rf "$APP/dist/web"
  echo "$SUM" >"$LAB/correctifs.sha256"
  echo "${COMMIT:0:7} + correctifs ${SUM:0:12}" >"$LAB/cornelius.version"
fi
cd "$APP"

say "Dépendances Node et interface"
[ -f node_modules/.package-lock.json ] || npm ci --no-audit --no-fund
[ -f dist/web/index.html ] || npm run build

say "Python 3.12 et perception (onnxruntime 1.23.2 : dernière version publiée pour Mac Intel)"
uv python install 3.12
[ -x .venv/bin/python ] || uv venv -q --python 3.12 .venv
grep -v '^onnxruntime==' perception/requirements.txt >"$LAB/requirements-mac-intel.txt"
echo 'onnxruntime==1.23.2' >>"$LAB/requirements-mac-intel.txt"
uv pip install -q --python .venv/bin/python -r "$LAB/requirements-mac-intel.txt" -r perception/requirements-wake.txt
uv pip install -q --python .venv/bin/python --no-deps openwakeword==0.6.0

say "Modèles : visages, parole, vision 450M (processeur), mot d'appel"
.venv/bin/python perception/download_models.py --device cpu --model 450m
.venv/bin/python perception/install_wake_features.py

if [ ! -f .env ]; then
  say "Configuration : accès depuis cet ordinateur seulement, mot de passe aléatoire"
  npm run -s setup
  PW="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20)"
  sed -i '' "s/^CORNELIUS_ADMIN_PASSWORD=.*/CORNELIUS_ADMIN_PASSWORD=$PW/" .env
  printf 'CORNELIUS_LAN=0\nCORNELIUS_MDNS=0\nCORNELIUS_VISION_DEVICE=cpu\n' >>.env
  printf '%s\n' "$PW" >"$LAB/mot-de-passe-admin.txt"
  chmod 600 .env "$LAB/mot-de-passe-admin.txt"
fi

cat >"$LAB/start.sh" <<'START'
#!/bin/bash
set -eu
LAB="$HOME/cornelius-lab"; cd "$LAB/cornelius"; export PATH="$LAB/node/bin:$PATH"
nohup node --env-file-if-exists=.env --import tsx server/index.ts >"$LAB/logs/serveur.log" 2>&1 </dev/null &
echo $! >"$LAB/serveur.pid"
for _ in $(seq 1 60); do curl -fs http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break; sleep 1; done
curl -fs http://127.0.0.1:3000/api/health >/dev/null || { tail -20 "$LAB/logs/serveur.log"; exit 1; }
nohup .venv/bin/python perception/worker.py >"$LAB/logs/perception.log" 2>&1 </dev/null &
echo $! >"$LAB/perception.pid"
echo "Miroir : http://127.0.0.1:3000/  ·  Écrire : http://127.0.0.1:3000/telephone  ·  Administration : http://127.0.0.1:3000/admin"
# Jamais affiché : copié dans le presse-papiers quand on lance ce script soi-même.
if [ -t 1 ] && command -v pbcopy >/dev/null; then
  pbcopy <"$LAB/mot-de-passe-admin.txt" && echo "Mot de passe administrateur copié : collez-le avec ⌘V."
fi
START

cat >"$LAB/stop.sh" <<'STOP'
#!/bin/bash
LAB="$HOME/cornelius-lab"
for n in perception serveur; do
  p="$(cat "$LAB/$n.pid" 2>/dev/null || true)"
  if [ -n "$p" ] && kill "$p" 2>/dev/null; then echo "$n arrêté"; fi
  rm -f "$LAB/$n.pid"
done
STOP

cat >"$LAB/mesure.sh" <<'MESURE'
#!/bin/bash
# Relevé toutes les 5 s (par défaut 60 relevés = 5 min) dans ~/cornelius-lab/mesures.csv
LAB="$HOME/cornelius-lab"; OUT="$LAB/mesures.csv"; N="${1:-60}"
s="$(cat "$LAB/serveur.pid")"; p="$(cat "$LAB/perception.pid")"
echo "heure;serveur_Mo;serveur_cpu;perception_Mo;perception_cpu;memoire_libre;swap_utilise" >"$OUT"
for _ in $(seq 1 "$N"); do
  rs="$(ps -o rss=,pcpu= -p "$s" 2>/dev/null | awk '{printf "%d;%s", $1/1024, $2}')"
  rp="$(ps -o rss=,pcpu= -p "$p" 2>/dev/null | awk '{printf "%d;%s", $1/1024, $2}')"
  free="$(memory_pressure -Q 2>/dev/null | awk -F': ' '/percentage/{print $2}')"
  swap="$(sysctl -n vm.swapusage | awk '{print $6}')"
  echo "$(date +%H:%M:%S);${rs:-arrêté;};${rp:-arrêté;};$free;$swap" >>"$OUT"
  sleep 5
done
echo "Mesures écrites dans $OUT"
MESURE
chmod +x "$LAB/start.sh" "$LAB/stop.sh" "$LAB/mesure.sh"

say "Installation terminée"
echo "Démarrer : bash ~/cornelius-lab/start.sh   ·   Arrêter : bash ~/cornelius-lab/stop.sh"
echo "Mesurer 5 min : bash ~/cornelius-lab/mesure.sh   ·   Tout retirer : stop.sh puis rm -rf ~/cornelius-lab"
