<?php
// Supprime une photo de l'invité connecté (et libère une place dans sa limite).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$guest = current_guest();
require_open($guest);
$photo = own_photo($guest);

db()->prepare('DELETE FROM photos WHERE id = ?')->execute([(int) $photo['id']]);
@unlink(photo_path($guest['event_id'], $photo['file']));
@unlink(photo_path($guest['event_id'], $photo['file'], true));

reply(200, ['ok' => true, 'count' => photo_count($guest['id'])]);
