-- Réglages d'événement pilotés depuis la page d'administration. Les dates sont en UTC.
ALTER TABLE events
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'mariage' AFTER title,  -- mariage, bapteme, anniversaire, autre
  ADD COLUMN starts_at DATETIME NULL AFTER wedding_date,   -- début : pas d'envoi avant
  ADD COLUMN closes_at DATETIME NULL AFTER starts_at,      -- clôture : fin de l'accès à l'album, après la révélation (NULL = jamais)
  ADD COLUMN max_guests SMALLINT UNSIGNED NULL AFTER reveal_at,  -- nombre maximum de photographes (NULL = illimité)
  ADD COLUMN album_key CHAR(48) NULL AFTER album_token_hash,     -- clé du lien privé des mariés
  ADD UNIQUE KEY events_album_key (album_key);
