<?php
// Renvoie l'image d'une photo de l'invité connecté (size=thumb pour la vignette).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$guest = current_guest();
$photo = own_photo($guest);

$path = photo_path($guest['event_id'], $photo['file'], ($_POST['size'] ?? '') === 'thumb');
if (!is_file($path)) {
    // Pas de vignette (GD absent) : on sert la photo entière.
    $path = photo_path($guest['event_id'], $photo['file']);
}
if (!is_file($path)) {
    fail(404, 'photo', 'Photo introuvable.');
}

header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-store');
readfile($path);
