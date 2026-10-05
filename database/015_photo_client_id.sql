-- Identifiant donné à la photo par le téléphone : un envoi reçu deux fois n'est enregistré qu'une fois
ALTER TABLE photos
  ADD COLUMN client_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER liked,
  ADD UNIQUE KEY photos_guest_client (guest_id, client_id);
