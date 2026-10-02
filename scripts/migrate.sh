#!/usr/bin/env bash
# Applique sur la base OVH les fichiers database/NNN_*.sql pas encore passés.
# La base n'étant joignable que depuis l'hébergement, le script dépose un fichier PHP
# temporaire au nom aléatoire, l'appelle une fois en HTTPS, puis le supprime.
# Les migrations déjà appliquées sont mémorisées dans la table `migrations`.
# Usage : npm run migrate
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG=".env.deploy"
[[ -f "$CONFIG" ]] || { echo "Fichier $CONFIG introuvable." >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$CONFIG"
set +a
for name in OVH_FTP_HOST OVH_FTP_USER OVH_FTP_PASSWORD OVH_REMOTE_DIR OVH_SITE_URL; do
  [[ -n "${!name:-}" ]] || { echo "Valeur manquante dans $CONFIG : $name" >&2; exit 1; }
done
REMOTE_DIR="${OVH_REMOTE_DIR#/}"
REMOTE_DIR="${REMOTE_DIR%/}"
PROTOCOL="${OVH_PROTOCOL:-sftp}"

RUNNER="_m$(openssl rand -hex 16).php"
WORK="$(mktemp -d)"

php -r '
  $migrations = [];
  foreach (glob("database/[0-9]*.sql") as $file) {
      $migrations[basename($file)] = file_get_contents($file);
  }
  ksort($migrations);
  file_put_contents($argv[1], "<?php\n\$migrations = " . var_export($migrations, true) . ";\n" . <<<'"'"'PHP'"'"'
header("Content-Type: text/plain; charset=utf-8");
$config = require __DIR__ . "/config.php";
$pdo = new PDO(
    sprintf("mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4", $config["host"], $config["port"] ?? 3306, $config["database"]),
    $config["user"],
    $config["password"],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$pdo->exec("CREATE TABLE IF NOT EXISTS migrations (
    name VARCHAR(120) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$done = $pdo->query("SELECT name FROM migrations")->fetchAll(PDO::FETCH_COLUMN);
foreach ($migrations as $name => $sql) {
    if (in_array($name, $done, true)) {
        echo "déjà appliquée : $name\n";
        continue;
    }
    try {
        foreach (preg_split("/;\s*(\n|$)/", $sql) as $statement) {
            if (trim($statement) !== "") {
                $pdo->exec($statement);
            }
        }
        $pdo->prepare("INSERT INTO migrations (name) VALUES (?)")->execute([$name]);
        echo "appliquée : $name\n";
    } catch (PDOException $e) {
        http_response_code(500);
        echo "ÉCHEC $name : " . $e->getMessage() . "\n";
        exit;
    }
}
echo "tables : " . implode(", ", $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN)) . "\n";
PHP
  );
' "$WORK/$RUNNER"

remote() {
  LFTP_PASSWORD="$OVH_FTP_PASSWORD" lftp --env-password -u "$OVH_FTP_USER" "$PROTOCOL://$OVH_FTP_HOST" \
    -e "set cmd:fail-exit yes; set net:max-retries 2; set net:timeout 20; set sftp:auto-confirm yes; $1; bye"
}
cleanup() {
  remote "rm -f $REMOTE_DIR/api/$RUNNER" >/dev/null 2>&1 || echo "ATTENTION : supprimer à la main $REMOTE_DIR/api/$RUNNER" >&2
  rm -rf "$WORK"
}
trap cleanup EXIT

remote "put -O $REMOTE_DIR/api $WORK/$RUNNER" >/dev/null
curl --silent --show-error --fail-with-body --max-time 60 "${OVH_SITE_URL%/}/api/$RUNNER"
