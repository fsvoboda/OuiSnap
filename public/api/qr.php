<?php
// Image du QR code d'un événement, affichée dans les e-mails. Elle n'a rien de secret :
// c'est le QR code posé sur les tables.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$code = strtoupper((string) ($_GET['c'] ?? ''));
$path = preg_match('/^[A-Z0-9]{4,16}$/', $code) ? qr_path($code) : '';
if ($path === '' || !is_file($path)) {
    http_response_code(404);
    exit;
}

header('Content-Type: image/png');
header('Content-Length: ' . filesize($path));
header('Cache-Control: public, max-age=86400');
readfile($path);
