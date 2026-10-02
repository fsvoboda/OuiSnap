-- Test de la révélation : l'album de démonstration se dévoile 2 minutes après cette migration.
UPDATE events
SET reveal_at = UTC_TIMESTAMP() + INTERVAL 2 MINUTE
WHERE code = 'DEMO2026';
