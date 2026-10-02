<?php
// Enregistre l'image du QR code d'un événement, générée par la page d'administration.
// Elle sert aux e-mails, qui ne peuvent afficher qu'une image hébergée.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

$stmt = db()->prepare('SELECT code FROM events WHERE id = ?');
$stmt->execute([(int) ($_POST['id'] ?? 0)]);
$code = $stmt->fetchColumn();
if (!$code) {
    fail(404, 'event', 'Album introuvable.');
}

$upload = $_FILES['qr'] ?? null;
if (!$upload || $upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
    fail(400, 'upload', "Le QR code n'a pas pu être reçu.");
}
$info = @getimagesize($upload['tmp_name']);
if (!$info || $info[2] !== IMAGETYPE_PNG || $upload['size'] > 512 * 1024) {
    fail(415, 'format', "Ce fichier n'est pas un QR code valide.");
}

$path = qr_path($code);
$dir = dirname($path);
if ((!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) || !move_uploaded_file($upload['tmp_name'], $path)) {
    error_log("OuiSnap : impossible d'écrire $path");
    fail(500, 'server', "Le QR code n'a pas pu être enregistré.");
}

reply(200, ['ok' => true]);
