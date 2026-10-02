<?php
// Rejoindre l'album d'un mariage à partir du code du QR code.
// - code seul : renvoie le mariage, sans créer d'invité
// - code + name : crée l'invité et renvoie son jeton
// - code + token : reprend la session d'un invité déjà venu
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$code = strtoupper(trim((string) ($_POST['code'] ?? '')));
$event = null;
if (preg_match('/^[A-Z0-9]{4,16}$/', $code)) {
    $stmt = db()->prepare('SELECT id, title, max_photos_per_guest, wedding_date, reveal_at FROM events WHERE code = ?');
    $stmt->execute([$code]);
    $event = $stmt->fetch();
}
if (!$event) {
    fail(404, 'event', "Ce QR code n'est pas reconnu.");
}
$eventId = (int) $event['id'];

$token = (string) ($_POST['token'] ?? '');
if (is_token($token)) {
    $stmt = db()->prepare('SELECT id, name FROM guests WHERE token_hash = ? AND event_id = ?');
    $stmt->execute([hash('sha256', $token), $eventId]);
    $guest = $stmt->fetch();
    if ($guest) {
        reply(200, [
            'ok' => true,
            'token' => $token,
            'name' => $guest['name'],
            'event' => event_payload($event),
            'count' => photo_count((int) $guest['id']),
        ]);
    }
}

// Prénom nettoyé : les mariés verront qui a posté, et combien.
$name = preg_replace('/[\x00-\x1F\x7F]+/u', '', (string) ($_POST['name'] ?? '')) ?? '';
$name = mb_substr(trim(preg_replace('/\s+/u', ' ', $name) ?? ''), 0, 40);
if ($name === '') {
    reply(200, ['ok' => true, 'token' => null, 'name' => null, 'event' => event_payload($event), 'count' => 0]);
}

// Album déjà dévoilé : on n'accueille plus de nouvel invité.
require_open($event);

$token = bin2hex(random_bytes(24));
db()->prepare('INSERT INTO guests (event_id, token_hash, name) VALUES (?, ?, ?)')
    ->execute([$eventId, hash('sha256', $token), $name]);

reply(200, ['ok' => true, 'token' => $token, 'name' => $name, 'event' => event_payload($event), 'count' => 0]);
