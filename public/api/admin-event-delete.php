<?php
// Suppression définitive d'un événement : ses photos sur le serveur, ses invités et l'album.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

$id = (int) ($_POST['id'] ?? 0);
$stmt = db()->prepare('SELECT id, code FROM events WHERE id = ?');
$stmt->execute([$id]);
$event = $stmt->fetch();
if (!$event) {
    fail(404, 'event', 'Album introuvable.');
}

if (!delete_event($event)) {
    fail(500, 'server', "Certaines photos n'ont pas pu être supprimées du serveur. L'album a été conservé.");
}

reply(200, ['ok' => true]);
