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
    $stmt = db()->prepare('SELECT id, code, title, kind, max_photos_per_guest, max_guests, wedding_date, starts_at, closes_at, reveal_at
         FROM events WHERE code = ?');
    $stmt->execute([$code]);
    $event = $stmt->fetch();
}
if (!$event) {
    fail(404, 'event', "Ce QR code n'est pas reconnu.");
}
$eventId = (int) $event['id'];

send_due_mails();

$token = (string) ($_POST['token'] ?? '');
if (is_token($token)) {
    $stmt = db()->prepare('SELECT id, name, email FROM guests WHERE token_hash = ? AND event_id = ?');
    $stmt->execute([hash('sha256', $token), $eventId]);
    $guest = $stmt->fetch();
    if ($guest) {
        reply(200, [
            'ok' => true,
            'token' => $token,
            'name' => $guest['name'],
            'event' => event_payload($event, $guest['email'] !== null),
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

// Album pas encore ouvert, ou déjà clos : on n'accueille pas de nouvel invité.
require_open($event);

// Nombre maximum de photographes fixé pour cet album.
if ($event['max_guests'] !== null) {
    $stmt = db()->prepare('SELECT COUNT(*) FROM guests WHERE event_id = ?');
    $stmt->execute([$eventId]);
    if ((int) $stmt->fetchColumn() >= (int) $event['max_guests']) {
        fail(409, 'full', 'Cet album est complet : le nombre maximum de photographes est atteint.');
    }
}

// E-mail facultatif : sert uniquement à prévenir l'invité quand l'album sera dévoilé.
$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if ($email !== '' && (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
    fail(422, 'email', 'Cette adresse e-mail ne semble pas valide.');
}

$hasEmail = $email !== '';
$token = bin2hex(random_bytes(24));
// Le jeton n'est gardé en clair que pour les invités à qui un lien personnel est envoyé par e-mail.
db()->prepare('INSERT INTO guests (event_id, token_hash, name, email, link_token) VALUES (?, ?, ?, ?, ?)')
    ->execute([$eventId, hash('sha256', $token), $name, $hasEmail ? $email : null, $hasEmail ? $token : null]);

if ($hasEmail) {
    if (!send_mail($email, welcome_mail($event, $name, $token))) {
        error_log("OuiSnap : échec de l'envoi du message de bienvenue à $email");
    }
}

reply(200, [
    'ok' => true,
    'token' => $token,
    'name' => $name,
    'event' => event_payload($event, $hasEmail),
    'count' => 0,
]);
