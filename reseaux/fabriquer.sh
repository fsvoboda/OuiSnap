#!/usr/bin/env bash
# Fabrique les vues graphiques du carrousel Instagram, au format 1080 x 1350.
# Usage : bash reseaux/fabriquer.sh
set -euo pipefail
cd "$(dirname "$0")"
ICI="$(pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

for v in 2 4 5; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=8000 --window-size=1080,1350 \
    --screenshot="$ICI/insta-1-vue-$v.png" "file://$ICI/vue-$v.html" 2>/dev/null
done
for f in "$ICI"/insta-1-vue-*.png; do
  echo "$(basename "$f") : $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
done
