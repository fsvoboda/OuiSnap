-- Équivalent SQLite des migrations MySQL, pour les tests en local (npm run local).
-- Deux mariages de test :
--   DEMO2026  : mariage aujourd'hui, album pas encore révélé  -> /album/?k=aaaa… (48 fois « a »)
--   PASSE2026 : mariage passé, album révélé                   -> /album/?k=bbbb… (48 fois « b »)

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mariage',
  organizer_name TEXT NULL,
  organizer_email TEXT NULL,
  wedding_date TEXT NULL,
  starts_at TEXT NULL,
  closes_at TEXT NULL,
  delete_at TEXT NULL,
  delete_warned_at TEXT NULL,
  open_mail_sent_at TEXT NULL,
  reveal_at TEXT NULL,
  reveal_mail_sent_at TEXT NULL,
  max_guests INTEGER NULL,
  max_photos_per_guest INTEGER NULL,
  album_token_hash TEXT NULL UNIQUE,
  album_key TEXT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NULL,
  link_token TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  file TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  liked INTEGER NOT NULL DEFAULT 0,
  client_id TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un envoi reçu deux fois (réponse perdue en route) n'est enregistré qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS photos_guest_client ON photos (guest_id, client_id);

INSERT OR IGNORE INTO events (code, title, wedding_date, max_photos_per_guest, album_token_hash)
VALUES ('DEMO2026', 'Mariage de démonstration', date('now', 'localtime'), 10, '97daac0ee9998dfcad6c9c0970da5ca411c86233a944c25b47566f6a7bc1ddd5');

INSERT OR IGNORE INTO events (code, title, wedding_date, max_photos_per_guest, album_token_hash)
VALUES ('PASSE2026', 'Julie & Enzo', '2026-06-20', NULL, '720228e4b7b018b5e0c8c5dcc15b8955175fa5e5826c7e80c267f2a2d397d0e0');

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  failed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,
  event_date TEXT NULL,
  message TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS admin_password_resets_time ON admin_password_resets (created_at);

-- File d'attente des e-mails d'ouverture, de révélation et d'avertissement de suppression (voir database/016_mail_queue.sql).
CREATE TABLE IF NOT EXISTS mail_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  guest_id INTEGER NULL REFERENCES guests (id) ON DELETE CASCADE,
  recipient INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NULL,
  sent_at TEXT NULL,
  abandoned_at TEXT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, kind, recipient)
);

CREATE INDEX IF NOT EXISTS mail_queue_guest ON mail_queue (guest_id);
CREATE INDEX IF NOT EXISTS mail_queue_pending ON mail_queue (sent_at, abandoned_at);
