-- Nom des organisateurs (« Julie et Enzo », par exemple), utilisé dans les messages qui leur sont envoyés.
ALTER TABLE events
  ADD COLUMN organizer_name VARCHAR(80) NULL AFTER kind;
