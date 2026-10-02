<?php
// Liste des albums pour l'administrateur, le plus récent d'abord.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

// Anciens albums créés sans clé lisible : on leur en attribue une, pour pouvoir afficher le lien des mariés.
foreach (db()->query('SELECT id FROM events WHERE album_key IS NULL')->fetchAll() as $row) {
    $key = bin2hex(random_bytes(24));
    db()->prepare('UPDATE events SET album_key = ?, album_token_hash = ? WHERE id = ?')
        ->execute([$key, hash('sha256', $key), (int) $row['id']]);
}

send_due_mails();

$rows = db()->query(
    'SELECT e.*,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id) AS guests,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id AND g.email IS NOT NULL) AS emails,
            (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS photos,
            (SELECT COALESCE(SUM(p.bytes), 0) FROM photos p WHERE p.event_id = e.id) AS bytes
     FROM events e
     ORDER BY e.id DESC'
)->fetchAll();

reply(200, ['ok' => true, 'events' => array_map('admin_event_payload', $rows)]);
