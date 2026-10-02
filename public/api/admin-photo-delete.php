<?php
// Suppression d'une photo par l'administrateur, à tout moment (même après la révélation).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

$stmt = db()->prepare('SELECT id, event_id, file FROM photos WHERE id = ?');
$stmt->execute([(int) ($_POST['id'] ?? 0)]);
$photo = $stmt->fetch();
if (!$photo) {
    fail(404, 'photo', 'Photo introuvable.');
}

db()->prepare('DELETE FROM photos WHERE id = ?')->execute([(int) $photo['id']]);
delete_photo_files((int) $photo['event_id'], $photo['file']);

reply(200, ['ok' => true]);
