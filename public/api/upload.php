<?php
// Réception d'une photo (JPEG déjà réduit par l'appli) pour l'invité connecté.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 8000;
const THUMB_SIDE = 480;

$guest = current_guest();
$max = $guest['max_photos_per_guest'] === null ? null : (int) $guest['max_photos_per_guest'];
$limitMessage = sprintf('Vous avez atteint la limite de %d photos fixée par les mariés.', $max ?? 0);

$upload = $_FILES['photo'] ?? null;
if (!$upload || $upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
    fail(400, 'upload', "La photo n'a pas pu être reçue.");
}
if ($upload['size'] > MAX_BYTES) {
    fail(413, 'size', 'Cette photo est trop lourde.');
}
$info = @getimagesize($upload['tmp_name']);
if (!$info || $info[2] !== IMAGETYPE_JPEG || $info[0] > MAX_SIDE || $info[1] > MAX_SIDE) {
    fail(415, 'format', "Ce fichier n'est pas une photo valide.");
}

if ($max !== null && photo_count($guest['id']) >= $max) {
    fail(409, 'limit', $limitMessage);
}

$file = bin2hex(random_bytes(16));
$path = photo_path($guest['event_id'], $file);
$dir = dirname($path);
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    error_log("OuiSnap : impossible de créer $dir");
    fail(500, 'server', "La photo n'a pas pu être enregistrée.");
}
if (!move_uploaded_file($upload['tmp_name'], $path)) {
    error_log("OuiSnap : impossible d'écrire $path");
    fail(500, 'server', "La photo n'a pas pu être enregistrée.");
}

// Vignette pour la grille « Mes photos » (si l'extension GD est présente).
if (function_exists('imagecreatefromjpeg') && ($source = @imagecreatefromjpeg($path))) {
    $scale = min(1, THUMB_SIDE / max($info[0], $info[1]));
    $thumb = imagescale($source, max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale)));
    if ($thumb) {
        imagejpeg($thumb, photo_path($guest['event_id'], $file, true), 78);
    }
}

db()->prepare('INSERT INTO photos (event_id, guest_id, file, width, height, bytes) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([$guest['event_id'], $guest['id'], $file, $info[0], $info[1], $upload['size']]);
$id = (int) db()->lastInsertId();

// Deux envois simultanés peuvent passer le premier contrôle : on revérifie le rang de cette photo.
if ($max !== null) {
    $stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE guest_id = ? AND id <= ?');
    $stmt->execute([$guest['id'], $id]);
    if ((int) $stmt->fetchColumn() > $max) {
        db()->prepare('DELETE FROM photos WHERE id = ?')->execute([$id]);
        @unlink($path);
        @unlink(photo_path($guest['event_id'], $file, true));
        fail(409, 'limit', $limitMessage);
    }
}

reply(200, ['ok' => true, 'id' => $id, 'count' => photo_count($guest['id'])]);
