-- Parcours invité : mariages, invités, photos (MySQL).

CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL,                      -- contenu du QR code
  title VARCHAR(120) NOT NULL,                    -- ex. « Julie & Enzo »
  max_photos_per_guest SMALLINT UNSIGNED NULL,    -- option des mariés ; NULL = illimité
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY events_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,                   -- SHA-256 du jeton gardé sur le téléphone
  name VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY guests_token (token_hash),
  KEY guests_event (event_id),
  CONSTRAINT guests_event_fk FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS photos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id INT UNSIGNED NOT NULL,
  guest_id INT UNSIGNED NOT NULL,
  file CHAR(32) NOT NULL,                         -- nom aléatoire du fichier, sans extension
  width SMALLINT UNSIGNED NOT NULL,
  height SMALLINT UNSIGNED NOT NULL,
  bytes INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY photos_file (file),
  KEY photos_guest (guest_id),
  KEY photos_event (event_id),
  CONSTRAINT photos_event_fk FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT photos_guest_fk FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mariage de démonstration, limité à 10 photos par invité.
INSERT IGNORE INTO events (code, title, max_photos_per_guest)
VALUES ('DEMO2026', 'Mariage de démonstration', 10);
