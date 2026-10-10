#!/usr/bin/env bash
# Fabrique les vues graphiques du carrousel Instagram, au format 1080 x 1350.
# Usage : bash reseaux/fabriquer.sh
set -euo pipefail
cd "$(dirname "$0")"
ICI="$(pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Chaque vue et le nom du fichier produit.
dessiner() {
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=8000 --window-size=1080,1350 \
    --screenshot="$ICI/$2" "file://$ICI/$1" 2>/dev/null
  echo "$2 : $(sips -g pixelWidth -g pixelHeight "$ICI/$2" | awk '/pixel/{printf "%s ", $2}')"
}

dessiner vue-2.html graphique-promesses.png
dessiner vue-4.html graphique-trois-gestes.png
dessiner vue-5.html graphique-slogan.png
