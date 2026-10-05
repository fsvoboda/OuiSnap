#!/usr/bin/env bash
# Prépare la base de test locale (.local/dev.sqlite) pour les tests Playwright. Ne touche jamais à la production.
# Usage : bash .claude/skills/pw/scripts/base-locale.sh etat      vérifie que le serveur local répond sur la base de test
#         bash .claude/skills/pw/scripts/base-locale.sh mdp       remet le mot de passe admin local à « admin » et vide les demandes de lien
#         bash .claude/skills/pw/scripts/base-locale.sh nettoyer  supprime les événements créés par les tests (et leurs photos)
set -euo pipefail
cd "$(dirname "$0")/../../../.."
DB=".local/dev.sqlite"

case "${1:-}" in
  etat)
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -d "code=DEMO2026" http://localhost:8000/api/join.php || true)
    if [[ "$code" != "200" ]]; then
      echo "ARRÊT : le serveur local ne répond pas sur le port 8000 (code $code). Lancer « npm run local »."
      exit 1
    fi
    # Après « npm run deploy », out/ contient la configuration de production : les tests toucheraient la vraie base.
    if ! grep -q "sqlite" out/api/config.php 2>/dev/null; then
      echo "ARRÊT : out/api/config.php n'est pas la configuration de test (pas de SQLite). Relancer « npm run local »."
      exit 1
    fi
    # Base créée avant l'anti-doublon des envois : « npm run local » la met à niveau.
    if [[ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM pragma_table_info('photos') WHERE name = 'client_id'")" != "1" ]]; then
      echo "ARRÊT : la base de test n'a pas la colonne photos.client_id. Relancer « npm run local »."
      exit 1
    fi
    echo "OK : serveur local sur le port 8000, base de test SQLite, $(sqlite3 "$DB" 'SELECT COUNT(*) FROM events') événements."
    ;;
  mdp)
    sqlite3 "$DB" "DELETE FROM settings; DELETE FROM admin_password_resets; DELETE FROM admin_login_attempts;"
    echo "OK : mot de passe admin local = admin, aucune demande de lien en attente."
    ;;
  nettoyer)
    FILTRE="title LIKE 'Léa & Tom E2E %' OR title LIKE 'Test % E2E%'"
    sqlite3 "$DB" "SELECT id FROM events WHERE $FILTRE" | while read -r id; do
      [[ -n "$id" ]] && rm -rf ".local/storage/$id"
    done
    sqlite3 "$DB" "PRAGMA foreign_keys=ON; DELETE FROM events WHERE $FILTRE;"
    echo "OK : événements de test supprimés, il reste $(sqlite3 "$DB" 'SELECT COUNT(*) FROM events') événements."
    ;;
  *)
    echo "Usage : base-locale.sh etat | mdp | nettoyer" >&2
    exit 1
    ;;
esac
