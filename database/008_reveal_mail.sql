-- E-mail facultatif des photographes, pour les prévenir quand l'album est dévoilé.
ALTER TABLE guests
  ADD COLUMN email VARCHAR(254) NULL AFTER name;

-- Date d'envoi du message de révélation (NULL = pas encore envoyé).
ALTER TABLE events
  ADD COLUMN reveal_mail_sent_at DATETIME NULL AFTER reveal_at;
