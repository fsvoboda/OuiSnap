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

// Fichiers d'abord : le dossier de l'événement ne contient que ses photos et leurs vignettes.
$dir = storage_dir() . '/' . $id;
$remaining = 0;
if (is_dir($dir)) {
    foreach (scandir($dir) as $file) {
        if ($file !== '.' && $file !== '..' && !@unlink("$dir/$file")) {
            $remaining++;
        }
    }
    @rmdir($dir);
}
if ($remaining > 0) {
    error_log("OuiSnap : $remaining fichier(s) non supprimé(s) dans $dir");
    fail(500, 'server', "Certaines photos n'ont pas pu être supprimées du serveur. L'album a été conservé.");
}

@unlink(qr_path((string) $event['code']));

db()->prepare('DELETE FROM photos WHERE event_id = ?')->execute([$id]);
db()->prepare('DELETE FROM guests WHERE event_id = ?')->execute([$id]);
db()->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);

reply(200, ['ok' => true]);
