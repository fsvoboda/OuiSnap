<?php
// Téléchargement de tout l'album en un fichier ZIP, une fois l'album dévoilé.
// L'archive est écrite au fil de l'eau, photo après photo : ni fichier temporaire ni mémoire
// proportionnelle à la taille de l'album, ce qui tient pour des albums de plusieurs centaines de Mo.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$event = current_album();
require_revealed($event);

$stmt = db()->prepare(
    'SELECT p.file, p.guest_id, g.name
     FROM photos p JOIN guests g ON g.id = p.guest_id
     WHERE p.event_id = ?
     ORDER BY g.name, g.id, p.id'
);
$stmt->execute([$event['id']]);

// Un dossier par invité. Deux invités au même prénom reçoivent « Camille » et « Camille-2 ».
// Dans chaque dossier, les photos sont numérotées dans l'ordre de prise de vue.
$folders = [];
$numbers = [];
$entries = [];
foreach ($stmt->fetchAll() as $photo) {
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
    $entries[] = [
        'path' => $path,
        'name' => sprintf('%s/%03d.jpg', $folders[$guest], ++$numbers[$guest]),
        'size' => filesize($path),
        'time' => filemtime($path),
    ];
}
if (!$entries) {
    fail(404, 'empty', "L'album ne contient aucune photo.");
}

// Taille totale connue d'avance : en-tête local (30 octets + nom) et photo, puis index (46 octets + nom), puis fin (22).
$total = 22;
foreach ($entries as $entry) {
    $total += 30 + strlen($entry['name']) + $entry['size'] + 46 + strlen($entry['name']);
}
// Format ZIP classique : 4 Go et 65 535 fichiers au plus.
if ($total > 0xFFFFFFFF || count($entries) > 0xFFFF) {
    fail(413, 'size', "Cet album est trop volumineux pour un seul fichier. Contactez-nous pour le récupérer.");
}

// Archives temporaires laissées par l'ancienne méthode de téléchargement.
foreach (glob(sys_get_temp_dir() . '/ouisnap*') ?: [] as $leftover) {
    @unlink($leftover);
}

@set_time_limit(0);
while (ob_get_level() > 0) {
    ob_end_clean();
}
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="album-' . slug($event['title'], 'ouisnap') . '.zip"');
// L'hébergement refuse les réponses qui annoncent une très grosse taille (erreur 500 constatée à 620 Mo,
// aucun souci à 195 Mo). La taille n'est donc annoncée que pour les petits albums, où elle permet au
// navigateur d'afficher la progression ; au-delà, le téléchargement se fait sans taille connue d'avance.
if ($total < 150 * 1024 * 1024) {
    header('Content-Length: ' . $total);
}
header('Cache-Control: private, no-store');

// Date au format MS-DOS, attendu par le format ZIP.
$dos = function (int $timestamp): array {
    $d = getdate($timestamp);
    return [
        ($d['hours'] << 11) | ($d['minutes'] << 5) | ($d['seconds'] >> 1),
        ((max(1980, $d['year']) - 1980) << 9) | ($d['mon'] << 5) | $d['mday'],
    ];
};

$offset = 0;
$index = '';
foreach ($entries as $entry) {
    // Les JPEG sont déjà compressés : ils sont rangés tels quels (méthode 0).
    $data = file_get_contents($entry['path']);
    if ($data === false || strlen($data) !== $entry['size']) {
        // Fichier modifié pendant l'envoi : on arrête, le navigateur signalera un téléchargement incomplet.
        error_log("OuiSnap : lecture impossible de {$entry['path']} pendant la création du ZIP");
        exit;
    }
    $crc = crc32($data);
    [$time, $date] = $dos($entry['time']);
    $name = $entry['name'];
    $common = pack('vvvvVVVvv', 0x0800, 0, $time, $date, $crc, $entry['size'], $entry['size'], strlen($name), 0);

    echo pack('Vv', 0x04034b50, 20) . $common . $name . $data;
    flush();

    $index .= pack('Vvv', 0x02014b50, 20, 20) . $common . pack('vvvVV', 0, 0, 0, 0, $offset) . $name;
    $offset += 30 + strlen($name) + $entry['size'];
}

echo $index . pack('VvvvvVVv', 0x06054b50, 0, 0, count($entries), count($entries), strlen($index), $offset, 0);
