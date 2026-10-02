-- Coup de cœur posé par les organisateurs sur une photo, visible par son photographe.
ALTER TABLE photos
  ADD COLUMN liked TINYINT(1) NOT NULL DEFAULT 0 AFTER bytes;
