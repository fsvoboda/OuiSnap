-- Photo reçue après la révélation : date de prise déclarée par le téléphone (UTC), qui a justifié son acceptation.
-- Nulle pour toutes les photos reçues avant la révélation : « non nulle » vaut donc « arrivée après la révélation ».
ALTER TABLE photos
  ADD COLUMN late_taken_at DATETIME NULL AFTER client_id;
