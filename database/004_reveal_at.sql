-- Date de révélation réglable par mariage (en UTC). NULL = lendemain du mariage à 12h00, heure de Paris.
ALTER TABLE events
  ADD COLUMN reveal_at DATETIME NULL AFTER wedding_date;
