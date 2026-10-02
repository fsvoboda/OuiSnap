-- Jeton du lien personnel envoyé par e-mail aux photographes qui ont laissé leur adresse :
-- il leur permet de retrouver leur session depuis n'importe quel appareil.
ALTER TABLE guests
  ADD COLUMN link_token CHAR(48) NULL AFTER email;
