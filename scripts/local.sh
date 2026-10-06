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
  // Base créée avant l ajout d une colonne : CREATE TABLE IF NOT EXISTS ne la modifie pas.
  // À faire avant le fichier SQL, dont les index portent sur ces colonnes.
  $added = [
    "photos" => ["client_id" => "TEXT NULL"],
    "events" => ["delete_at" => "TEXT NULL", "delete_warned_at" => "TEXT NULL"],
  ];
  foreach ($added as $table => $columns) {
    $present = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC), "name");
    if ($present === []) continue; // base neuve : le fichier SQL crée tout
    foreach ($columns as $name => $type) {
      if (!in_array($name, $present, true)) $pdo->exec("ALTER TABLE $table ADD COLUMN $name $type");
    }
  }
  $pdo->exec(file_get_contents("database/local.sqlite.sql"));
  $config = [
    "dsn" => "sqlite:$data/dev.sqlite",
    "storage" => "$data/storage",
    "mail_log" => "$data/mails.log", // les e-mails sont écrits dans ce fichier, pas envoyés
    "admin_emails" => ["admin@exemple.fr", "secours@exemple.fr"], // adresses fictives : le lien se lit dans mails.log
    "admin_password_hash" => password_hash("admin", PASSWORD_DEFAULT), // mot de passe local : admin
  ];
  file_put_contents("out/api/config.php", "<?php\nreturn " . var_export($config, true) . ";\n");
'

echo "OuiSnap en local : http://localhost:$PORT/e/?c=DEMO2026"
php -S "localhost:$PORT" -t out
