<?php
// Liste des photos de l'invité connecté, la plus récente d'abord.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$guest = current_guest();
$stmt = db()->prepare('SELECT id, width, height FROM photos WHERE guest_id = ? ORDER BY id DESC');
$stmt->execute([$guest['id']]);
$photos = array_map(
    fn (array $row) => ['id' => (int) $row['id'], 'width' => (int) $row['width'], 'height' => (int) $row['height']],
    $stmt->fetchAll()
);

reply(200, ['ok' => true, 'photos' => $photos, 'count' => count($photos)]);
