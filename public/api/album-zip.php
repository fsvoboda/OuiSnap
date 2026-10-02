<?php
// Téléchargement de tout l'album en un fichier ZIP, une fois l'album dévoilé.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$event = current_album();
require_revealed($event);

if (!class_exists('ZipArchive')) {
    fail(500, 'server', "Le téléchargement groupé n'est pas disponible sur ce serveur.");
}

$stmt = db()->prepare(
    'SELECT p.file, p.guest_id, g.name
     FROM photos p JOIN guests g ON g.id = p.guest_id
     WHERE p.event_id = ?
     ORDER BY g.name, g.id, p.id'
);
$stmt->execute([$event['id']]);
$photos = $stmt->fetchAll();
if (!$photos) {
    fail(404, 'empty', "L'album ne contient aucune photo.");
}

@set_time_limit(0);
$tmp = tempnam(sys_get_temp_dir(), 'ouisnap');
$zip = new ZipArchive();
if ($tmp === false || $zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
    fail(500, 'server', "L'archive n'a pas pu être créée.");
}
// Un dossier par invité. Deux invités au même prénom reçoivent « Camille » et « Camille-2 ».
$folders = [];
$numbers = [];
foreach ($photos as $photo) {
    $path = photo_path($event['id'], $photo['file']);
    if (!is_file($path)) {
        continue;
    }
    $guest = (int) $photo['guest_id'];
    if (!isset($folders[$guest])) {
        $base = slug($photo['name'], 'invite');
        $folder = $base;
        for ($n = 2; in_array($folder, $folders, true); $n++) {
            $folder = "$base-$n";
        }
        $folders[$guest] = $folder;
        $numbers[$guest] = 0;
    }
    // Dans chaque dossier, les photos sont numérotées dans l'ordre de prise de vue.
    $name = sprintf('%s/%03d.jpg', $folders[$guest], ++$numbers[$guest]);
    $zip->addFile($path, $name);
    // Les JPEG sont déjà compressés : on les range tels quels, c'est beaucoup plus rapide.
    $zip->setCompressionName($name, ZipArchive::CM_STORE);
}
$zip->close();

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="album-' . slug($event['title'], 'ouisnap') . '.zip"');
header('Content-Length: ' . filesize($tmp));
header('Cache-Control: private, no-store');
readfile($tmp);
unlink($tmp);
