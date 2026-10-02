#!/usr/bin/env bash
# Lance l'appli complète en local : site compilé + API PHP sur une base SQLite de test.
# Les données de test vivent dans .local/ (non versionné).
# Usage : npm run local   puis ouvrir http://localhost:8000/e/?c=DEMO2026
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8000}"
DATA="$PWD/.local"
mkdir -p "$DATA/storage"

npm run build

DATA="$DATA" php -r '
  $data = getenv("DATA");
  $pdo = new PDO("sqlite:$data/dev.sqlite");
  $pdo->exec(file_get_contents("database/local.sqlite.sql"));
  $config = [
    "dsn" => "sqlite:$data/dev.sqlite",
    "storage" => "$data/storage",
    "admin_password_hash" => password_hash("admin", PASSWORD_DEFAULT), // mot de passe local : admin
  ];
  file_put_contents("out/api/config.php", "<?php\nreturn " . var_export($config, true) . ";\n");
'

echo "OuiSnap en local : http://localhost:$PORT/e/?c=DEMO2026"
php -S "localhost:$PORT" -t out
