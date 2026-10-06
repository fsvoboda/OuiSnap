-- File d'attente des e-mails d'ouverture et de révélation : un envoi en échec est retenté, un message envoyé ne repart jamais
CREATE TABLE IF NOT EXISTS mail_queue (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id INT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL,                      -- open_organizer, reveal_guest ou reveal_organizer
  guest_id INT UNSIGNED NULL,                     -- invité destinataire, NULL pour les organisateurs
  recipient INT UNSIGNED NOT NULL DEFAULT 0,      -- guest_id, ou 0 pour les organisateurs : sert à l'unicité
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- essais déjà faits
  last_attempt_at DATETIME NULL,
  sent_at DATETIME NULL,                          -- envoi réussi
  abandoned_at DATETIME NULL,                     -- abandon : essais épuisés, ou message devenu sans objet
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY mail_queue_message (event_id, kind, recipient),
  KEY mail_queue_guest (guest_id),
  KEY mail_queue_pending (sent_at, abandoned_at),
  CONSTRAINT mail_queue_event_fk FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT mail_queue_guest_fk FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
