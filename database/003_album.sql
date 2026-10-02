-- Album des mariés : date du mariage (révélation le lendemain à 12h00, heure de Paris)
-- et lien privé de l'album (on ne stocke que le SHA-256 de la clé).
ALTER TABLE events
  ADD COLUMN wedding_date DATE NULL AFTER title,
  ADD COLUMN album_token_hash CHAR(64) NULL AFTER max_photos_per_guest,
  ADD UNIQUE KEY events_album (album_token_hash);

UPDATE events
SET wedding_date = '2026-10-02',
    album_token_hash = '3237fe31428b4aff5c284f0f2e05df9d24fc55cf381584d09a9d2f7d6685d306'
WHERE code = 'DEMO2026';

-- Nettoyage des essais faits lors de la mise en ligne.
DELETE FROM guests WHERE name = 'Test Claude';

DELETE FROM waitlist WHERE email = 'test-claude@ouisnap.invalid';
