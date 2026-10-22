#!/bin/bash
# Bilan du labo Cornelius, en lecture seule : rien n'est modifié, aucun secret n'est affiché.
# bash ~/cornelius-lab/mes-comptes/cornelius/verifier-macos.sh [--tests]
# Le texte produit peut être collé tel quel dans une conversation.
# ok, nok et info réussissent toujours : « test && ok || nok » est sûr ici.
# shellcheck disable=SC2015
set -u
LAB="${CORNELIUS_LAB:-$HOME/cornelius-lab}"
APP="$LAB/cornelius"
PORT="${CORNELIUS_PORT:-3000}"
PATCHES="$(cd "$(dirname "$0")" && pwd)/correctifs"
RELAY=https://ogdglcoixadgixnjtwmf.supabase.co
ko=0
ok() { printf '  OK  %s\n' "$*"; }
nok() { printf '  KO  %s\n' "$*"; ko=$((ko + 1)); }
info() { printf '  ..  %s\n' "$*"; }
part() { printf '\n== %s\n' "$*"; }
# Toute suite de 24 caractères ou plus ressemblant à une clé est masquée.
mask() { sed -E 's/[A-Za-z0-9_+=-]{24,}/[masqué]/g'; }
has() { command -v "$1" >/dev/null 2>&1; }
alive() { local p; p="$(cat "$LAB/$1.pid" 2>/dev/null)" && [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }
http() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null || true; }

echo "Bilan Cornelius — $(date '+%Y-%m-%d %H:%M')"

part "Système"
if has sw_vers; then
  info "macOS $(sw_vers -productVersion), $(sysctl -n hw.model), $(($(sysctl -n hw.memsize) / 1073741824)) Go"
  free_gb="$(df -g "$HOME" | awk 'NR==2{print $4}')"
else
  info "$(uname -sm) (hors macOS : vérification partielle)"
  free_gb="$(df -BG "$HOME" | awk 'NR==2{gsub("G","",$4); print $4}')"
fi
[ "${free_gb:-0}" -ge 3 ] && ok "Espace libre : ${free_gb} Go" || nok "Espace libre : ${free_gb:-?} Go (3 Go au moins)"

part "Installation"
git -C "$APP" rev-parse --git-dir >/dev/null 2>&1 && ok "Cornelius : $(git -C "$APP" log -1 --format='%h %s' 2>/dev/null | cut -c1-90)" || nok "Cornelius absent de $APP : lancer labo-macos.sh"
node="$LAB/node/bin/node"; [ -x "$node" ] || node="$(command -v node || true)"
[ -n "$node" ] && ok "Node $("$node" --version)" || nok "Node absent"
if ls "$PATCHES"/*.patch >/dev/null 2>&1; then
  sum="$(cat "$PATCHES"/*.patch | shasum -a 256 2>/dev/null | awk '{print $1}')"
  [ "$sum" = "$(cat "$LAB/correctifs.sha256" 2>/dev/null)" ] \
    && ok "Correctifs maison à jour ($(find "$PATCHES" -name '*.patch' | wc -l | tr -d ' '))" \
    || nok "Correctifs pas à jour : stop.sh, labo-macos.sh, start.sh"
fi
[ -f "$APP/dist/web/index.html" ] && ok "Interface construite" || nok "Interface non construite (dist/web)"
[ -x "$APP/.venv/bin/python" ] && ok "Python de la perception présent" || nok "Python de la perception absent"

part "Réglages (.env : valeurs non secrètes seulement)"
envf="$APP/.env"
if [ -f "$envf" ]; then
  for k in CORNELIUS_LAN CORNELIUS_VPN CORNELIUS_MDNS CORNELIUS_HTTPS_PORT CORNELIUS_ALLOWED_HOSTS \
    CORNELIUS_MODULES_DIR CORNELIUS_TIMEZONE CORNELIUS_CAMERA_INDEX CORNELIUS_VISION_DEVICE CORNELIUS_TLS_CERT; do
    v="$(grep -E "^$k=" "$envf" | tail -1 | cut -d= -f2-)"
    [ -n "$v" ] && info "$k=${v/#"$HOME"/\~}"
  done
  for k in OPENAI_API_KEY CORNELIUS_ADMIN_PASSWORD CORNELIUS_FOYER_CODE CORNELIUS_COMPTES_CODE \
    CORNELIUS_METEO_CONCEPT_TOKEN CORNELIUS_PRIM_API_KEY; do
    grep -qE "^$k=.+" "$envf" && info "$k : défini" || info "$k : absent du fichier (peut être saisi dans l'administration)"
  done
  case "$(stat -c '%a' "$envf" 2>/dev/null || stat -f '%Lp' "$envf")" in
    600) ok ".env lisible par vous seul" ;;
    *) nok ".env lisible par d'autres comptes : chmod 600 $envf" ;;
  esac
else
  nok ".env absent : lancer labo-macos.sh"
fi

part "Processus et ports"
alive serveur && ok "Serveur en marche" || nok "Serveur arrêté : bash $LAB/start.sh"
alive perception && ok "Perception en marche" || nok "Perception arrêtée : bash $LAB/start.sh"
if has lsof; then
  for p in "$PORT" 3443; do
    l="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $9}' | sort -u | tr '\n' ' ')"
    [ -n "$l" ] && info "Port $p écouté sur : $l" || info "Port $p fermé"
  done
fi

part "Cornelius sur cet ordinateur"
h="$(curl -s --max-time 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
case "$h" in *'"ok"'*) ok "Santé : $h" ;; *) nok "Santé : pas de réponse sur le port $PORT" ;; esac
t="$(curl -s --max-time 5 "http://127.0.0.1:$PORT/api/text/status" 2>/dev/null || true)"
case "$t" in
  *'"ready":true'*) ok "Page Écrire : prête (clé OpenAI présente, mode privé désactivé)" ;;
  *no_key*) nok "Page Écrire : clé OpenAI absente (Administration → Mise en route)" ;;
  *blocked*) info "Page Écrire : mode privé actif (OpenAI bloqué, voulu ?)" ;;
  *) nok "Page Écrire : pas de réponse (correctif 0005 absent ?)" ;;
esac
[ "$(http "http://127.0.0.1:$PORT/telephone")" = 200 ] && ok "Page /telephone servie" || nok "Page /telephone non servie"
[ "$(http "http://127.0.0.1:$PORT/manifest-miroir.webmanifest")" = 200 ] && ok "Miroir installable (manifeste servi)" || nok "Manifeste du miroir absent"

part "Journaux (alertes récentes, sans détails)"
if [ -f "$LAB/logs/serveur.log" ]; then
  n="$(grep -cE '"level":"(warn|error)"' "$LAB/logs/serveur.log" || true)"
  info "Serveur : ${n:-0} alertes depuis le démarrage ; les 15 dernières :"
  grep -E '"level":"(warn|error)"' "$LAB/logs/serveur.log" | tail -15 | perl -ne '
    ($t) = /"time":"[^"]*T([0-9:]{8})/; ($l) = /"level":"(\w+)"/; ($s) = /"source":"([^"]*)"/;
    ($e) = /"event":"([^"]*)"/; ($d) = /"addonId":"([^"]*)"/;
    print "      $t $l $s : $e", ($d ? " ($d)" : ""), "\n";' | mask
else
  info "Pas de journal serveur"
fi
if [ -f "$LAB/logs/perception.log" ]; then
  info "Perception, 12 dernières lignes :"
  tail -12 "$LAB/logs/perception.log" | cut -c1-160 | mask | sed 's/^/      /'
fi

part "Réseau"
if has ipconfig; then
  for i in en0 en1; do a="$(ipconfig getifaddr "$i" 2>/dev/null)" && info "Adresse locale ($i) : $a"; done
fi
ts="$(ifconfig 2>/dev/null | awk '/inet 100\./{print $2}' | head -1)"
if [ -n "$ts" ]; then
  ok "Tailscale actif : $ts"
elif [ -d /Applications/Tailscale.app ] || has tailscale; then
  info "Tailscale installé, pas connecté"
else
  info "Tailscale non installé (seulement utile pour les téléphones hors de la maison)"
fi
c="$(http "$RELAY/rest/v1/")"
[ "$c" != 000 ] && ok "Relais Foyer joignable (HTTP $c)" || nok "Relais Foyer injoignable"
c="$(http https://api.openai.com/v1/models)"
[ "$c" != 000 ] && ok "OpenAI joignable (HTTP $c, 401 attendu sans clé)" || nok "OpenAI injoignable"

part "Mémoire"
if has memory_pressure; then
  info "Mémoire libre : $(memory_pressure -Q 2>/dev/null | awk -F': ' '/percentage/{print $2}')"
  info "Échange (swap) : $(sysctl -n vm.swapusage | awk '{print $6}') utilisés"
fi
for n in serveur perception; do
  p="$(cat "$LAB/$n.pid" 2>/dev/null)" && [ -n "$p" ] \
    && info "$n : $(ps -o rss=,pcpu= -p "$p" 2>/dev/null | awk '{printf "%d Mo, %s %% processeur", $1/1024, $2}')"
done

if [ "${1:-}" = "--tests" ]; then
  part "Tests"
  repo="$(cd "$(dirname "$0")/.." && pwd)"
  if (cd "$repo" && "$node" test.js >/dev/null 2>&1); then ok "Mes Comptes : node test.js"; else nok "Mes Comptes : node test.js en échec"; fi
  if (cd "$APP" && PATH="$(dirname "$node"):$PATH" CORNELIUS_MODULES_DIR="$repo/cornelius" npm run -s test:modules >"$LAB/logs/tests-modules.log" 2>&1); then
    ok "Modules foyer et comptes : tests réussis"
  else
    nok "Modules : tests en échec (fin de $LAB/logs/tests-modules.log ci-dessous)"
    tail -15 "$LAB/logs/tests-modules.log" | cut -c1-160 | mask | sed 's/^/      /'
  fi
fi

part "Résultat"
[ "$ko" -eq 0 ] && echo "  Tout est vert." || echo "  $ko point(s) à corriger (KO ci-dessus)."
