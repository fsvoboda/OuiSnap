<?php
// Image d'une photo de l'album, pour les mariés, une fois l'album dévoilé.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$event = current_album();
require_revealed($event);

$stmt = db()->prepare('SELECT file FROM photos WHERE id = ? AND event_id = ?');
$stmt->execute([(int) ($_POST['id'] ?? 0), $event['id']]);
$file = $stmt->fetchColumn();
if (!$file) {
    fail(404, 'photo', 'Photo introuvable.');
}

$path = photo_path($event['id'], $file, ($_POST['size'] ?? '') === 'thumb');
if (!is_file($path)) {
    $path = photo_path($event['id'], $file);
}
if (!is_file($path)) {
    fail(404, 'photo', 'Photo introuvable.');
}

header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-store');
readfile($path);
