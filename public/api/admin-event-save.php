<?php
// Création (sans id) ou modification (avec id) d'un événement et de son album.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();
require_admin();

// Date reçue au format ISO, enregistrée en UTC.
function posted_date(string $field, string $label, bool $required): ?DateTimeImmutable
{
    $value = trim((string) ($_POST[$field] ?? ''));
    if ($value === '') {
        if ($required) {
            fail(422, 'invalid', "$label est obligatoire.");
        }
        return null;
    }
    try {
        return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'));
    } catch (Exception) {
        fail(422, 'invalid', "$label n'est pas une date valide.");
    }
}

// Nombre entier positif, ou vide pour « illimité ».
function posted_limit(string $field, string $label): ?int
{
    $value = trim((string) ($_POST[$field] ?? ''));
    if ($value === '') {
        return null;
    }
    if (!ctype_digit($value) || (int) $value < 1 || (int) $value > 65535) {
        fail(422, 'invalid', "$label doit être un nombre entre 1 et 65535, ou vide pour illimité.");
    }
    return (int) $value;
}

$title = trim(preg_replace('/\s+/u', ' ', (string) ($_POST['title'] ?? '')) ?? '');
if ($title === '' || mb_strlen($title) > 120) {
    fail(422, 'invalid', "Le nom de l'album est obligatoire (120 caractères au plus).");
}
$kind = (string) ($_POST['kind'] ?? '');
if (!in_array($kind, EVENT_KINDS, true)) {
    fail(422, 'invalid', "La nature de l'événement n'est pas reconnue.");
}
// Nom des organisateurs, obligatoire : il ouvre les messages qui leur sont envoyés.
$organizerName = trim(preg_replace('/\s+/u', ' ', (string) ($_POST['organizerName'] ?? '')) ?? '');
if ($organizerName === '' || mb_strlen($organizerName) > 80) {
    fail(422, 'invalid', 'Le nom des organisateurs est obligatoire (80 caractères au plus).');
}
// E-mail des organisateurs, obligatoire : message à l'ouverture et à la révélation.
$organizerEmail = strtolower(trim((string) ($_POST['organizerEmail'] ?? '')));
if ($organizerEmail === '') {
    fail(422, 'invalid', "L'e-mail des organisateurs est obligatoire.");
}
if (strlen($organizerEmail) > 254 || !filter_var($organizerEmail, FILTER_VALIDATE_EMAIL)) {
    fail(422, 'invalid', "L'e-mail des organisateurs ne semble pas valide.");
}
$starts = posted_date('startsAt', 'La date de début', true);
$closes = posted_date('closesAt', 'La date de clôture', false);
$reveal = posted_date('revealAt', 'La date de révélation', true);
$maxGuests = posted_limit('maxGuests', 'Le nombre maximum de photographes');
$maxPhotos = posted_limit('maxPhotos', 'Le nombre maximum de photos par photographe');

if ($reveal <= $starts) {
    fail(422, 'invalid', 'La révélation doit avoir lieu après le début.');
}
if ($closes !== null && $closes <= $reveal) {
    fail(422, 'invalid', 'La clôture doit avoir lieu après la révélation.');
}

$format = fn (?DateTimeImmutable $date) => $date?->format('Y-m-d H:i:s');
$values = [$title, $kind, $organizerName, $organizerEmail, $format($starts), $format($closes), $format($reveal), $maxGuests, $maxPhotos];
$id = (int) ($_POST['id'] ?? 0);

if ($id > 0) {
    $stmt = db()->prepare(
        'UPDATE events
         SET title = ?, kind = ?, organizer_name = ?, organizer_email = ?, starts_at = ?, closes_at = ?, reveal_at = ?, max_guests = ?, max_photos_per_guest = ?
         WHERE id = ?'
    );
    $stmt->execute([...$values, $id]);
} else {
    // Code du QR code : 8 caractères sans lettres ni chiffres ambigus (pas de O/0, I/1).
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 8; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    $key = bin2hex(random_bytes(24));
    $stmt = db()->prepare(
        'INSERT INTO events
           (title, kind, organizer_name, organizer_email, starts_at, closes_at, reveal_at, max_guests,
            max_photos_per_guest, code, album_key, album_token_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([...$values, $code, $key, hash('sha256', $key)]);
    $id = (int) db()->lastInsertId();
}

$stmt = db()->prepare('SELECT * FROM events WHERE id = ?');
$stmt->execute([$id]);
$event = $stmt->fetch();
if (!$event) {
    fail(404, 'event', 'Album introuvable.');
}
reply(200, ['ok' => true, 'event' => admin_event_payload($event)]);
