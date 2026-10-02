-- E-mail des organisateurs (les mariés, par exemple) : ils reçoivent un message à l'ouverture
-- de l'album, avec le QR code, puis un autre à la révélation.
ALTER TABLE events
  ADD COLUMN organizer_email VARCHAR(254) NULL AFTER kind,
  ADD COLUMN open_mail_sent_at DATETIME NULL AFTER closes_at;
