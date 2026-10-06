-- Suppression automatique des albums : date choisie par l'administrateur (vide = six mois après la clôture)
-- et date de mise en file de l'avertissement (sept jours au moins avant toute suppression)
ALTER TABLE events
  ADD COLUMN delete_at DATETIME NULL AFTER closes_at,
  ADD COLUMN delete_warned_at DATETIME NULL AFTER delete_at;
