<?php
// Image d'une photo, pour l'administrateur.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

$stmt = db()->prepare('SELECT event_id, file FROM photos WHERE id = ?');
$stmt->execute([(int) ($_POST['id'] ?? 0)]);
$photo = $stmt->fetch();
if (!$photo) {
    fail(404, 'photo', 'Photo introuvable.');
}

$path = photo_path((int) $photo['event_id'], $photo['file'], ($_POST['size'] ?? '') === 'thumb');
if (!is_file($path)) {
    $path = photo_path((int) $photo['event_id'], $photo['file']);
}
if (!is_file($path)) {
    fail(404, 'photo', 'Photo introuvable.');
}

header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-store');
readfile($path);
