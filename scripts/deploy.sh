#!/usr/bin/env bash
# Met en ligne la page vitrine chez OVH : compile le site, génère api/config.php
# à partir de .env.deploy, puis envoie out/ dans le dossier du site.
# Usage : npm run deploy            (envoi réel)
#         npm run deploy -- --dry-run   (liste ce qui serait envoyé, sans rien écrire)
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG=".env.deploy"
DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

if [[ ! -f "$CONFIG" ]]; then
  echo "Fichier $CONFIG introuvable. Copie deploy.env.example en $CONFIG et renseigne-le." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$CONFIG"
set +a

for name in OVH_FTP_HOST OVH_FTP_USER OVH_FTP_PASSWORD OVH_REMOTE_DIR DB_HOST DB_NAME DB_USER DB_PASSWORD ADMIN_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "Valeur manquante dans $CONFIG : $name" >&2
    exit 1
  fi
done

# Garde-fou : l'hébergement porte d'autres sites, on n'écrit jamais à la racine.
REMOTE_DIR="${OVH_REMOTE_DIR#/}"
REMOTE_DIR="${REMOTE_DIR%/}"
case "$REMOTE_DIR" in
  "" | "." | ".." | */..* | www)
    echo "OVH_REMOTE_DIR='$OVH_REMOTE_DIR' refusé : indique le dossier dédié à OuiSnap." >&2
    exit 1
    ;;
esac

PROTOCOL="${OVH_PROTOCOL:-sftp}"
if [[ "$PROTOCOL" != "sftp" && "$PROTOCOL" != "ftp" ]]; then
  echo "OVH_PROTOCOL doit valoir sftp ou ftp." >&2
  exit 1
fi

command -v lftp >/dev/null || { echo "lftp est requis (brew install lftp)." >&2; exit 1; }

npm run build

# Identifiants MySQL et empreinte du mot de passe admin : écrits dans la copie compilée seulement.
php -r '
  $config = [
    "host" => getenv("DB_HOST"),
    "port" => (int) (getenv("DB_PORT") ?: 3306),
    "database" => getenv("DB_NAME"),
    "user" => getenv("DB_USER"),
    "password" => getenv("DB_PASSWORD"),
    "admin_password_hash" => password_hash(getenv("ADMIN_PASSWORD"), PASSWORD_DEFAULT),
  ];
  file_put_contents("out/api/config.php", "<?php\nreturn " . var_export($config, true) . ";\n");
'
rm -f out/api/config.example.php

echo "Envoi vers $PROTOCOL://$OVH_FTP_HOST/$REMOTE_DIR ${DRY_RUN:+(simulation)}"
# Sans --delete : on ajoute et on remplace, on ne supprime rien sur le serveur.
LFTP_PASSWORD="$OVH_FTP_PASSWORD" lftp --env-password -u "$OVH_FTP_USER" "$PROTOCOL://$OVH_FTP_HOST" <<EOF
set cmd:fail-exit yes
set net:max-retries 2
set net:timeout 20
set sftp:auto-confirm yes
set ftp:ssl-allow yes
mirror --reverse --verbose --parallel=4 $DRY_RUN out/ "$REMOTE_DIR"
EOF

echo "Terminé."
