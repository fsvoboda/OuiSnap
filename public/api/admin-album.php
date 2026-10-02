<?php
// Toutes les photos d'un album pour l'administrateur, même avant la révélation.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

$stmt = db()->prepare(
    'SELECT p.id, p.width, p.height, p.liked, p.guest_id, g.name
     FROM photos p JOIN guests g ON g.id = p.guest_id
     WHERE p.event_id = ?
     ORDER BY g.name, g.id, p.id'
);
$stmt->execute([(int) ($_POST['id'] ?? 0)]);

reply(200, [
    'ok' => true,
    'photos' => array_map(
        fn (array $row) => [
            'id' => (int) $row['id'],
            'width' => (int) $row['width'],
            'height' => (int) $row['height'],
            'guest' => (int) $row['guest_id'],
            'liked' => (bool) $row['liked'],
            'name' => $row['name'],
        ],
        $stmt->fetchAll()
    ),
]);
