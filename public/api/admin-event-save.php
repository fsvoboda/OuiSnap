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
// Suppression automatique : date facultative. Vide = six mois après la clôture.
$delete = posted_date('deleteAt', 'La date de suppression', false);
$maxGuests = posted_limit('maxGuests', 'Le nombre maximum de photographes');
$maxPhotos = posted_limit('maxPhotos', 'Le nombre maximum de photos par photographe');

if ($reveal <= $starts) {
    fail(422, 'invalid', 'La révélation doit avoir lieu après le début.');
}
if ($closes !== null && $closes <= $reveal) {
    fail(422, 'invalid', 'La clôture doit avoir lieu après la révélation.');
}

if ($delete !== null && $closes === null) {
    fail(422, 'invalid', "La suppression automatique demande une date de clôture : sans clôture, l'album n'est jamais supprimé automatiquement.");
}
if ($delete !== null && $delete < $closes) {
    fail(422, 'invalid', 'La suppression ne peut pas avoir lieu avant la clôture.');
}
// Plafond : six mois après la clôture, sur le calendrier. Comparaison au jour près (UTC) : le formulaire envoie la
// fin du jour choisi à l'heure locale, qui peut dépasser d'une heure le plafond exact au changement d'heure ;
// le calcul de l'échéance (deletion_due_at) ramène de toute façon la date au plafond.
if ($delete !== null && $delete->format('Y-m-d') > add_months($closes, DELETE_AFTER_MONTHS)->format('Y-m-d')) {
    fail(422, 'invalid', 'La suppression ne peut pas avoir lieu plus de six mois après la clôture. Pour garder l\'album plus longtemps, repoussez sa date de clôture.');
}

$format = fn (?DateTimeImmutable $date) => $date?->format('Y-m-d H:i:s');
$values = [$title, $kind, $organizerName, $organizerEmail, $format($starts), $format($closes), $format($reveal), $maxGuests, $maxPhotos, $format($delete)];
$id = (int) ($_POST['id'] ?? 0);

if ($id > 0) {
    // Lecture, décision et écriture dans une seule transaction : les dates, la remise à zéro de l'avertissement et
    // le retrait de ses messages de la file sont enregistrés ensemble, ou pas du tout.
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
        $stmt->execute([$id]);
        $before = $stmt->fetch();
        if ($before) {
            // Avertissement de suppression déjà mis en file : il est remis à zéro si la nouvelle échéance est à plus
            // de trente jours (ou s'il n'y en a plus), si elle est avancée (la date annoncée doit rester vraie), ou
            // si l'adresse des organisateurs change (la bonne adresse doit être prévenue). Un nouvel avertissement
            // partira le moment venu, et les sept jours avant toute suppression repartiront de son envoi.
            $reset = false;
            if (!empty($before['delete_warned_at'])) {
                $oldDue = deletion_due_at($before);
                $newDue = deletion_due_at(['closes_at' => $format($closes), 'delete_at' => $format($delete)]);
                $reset = $newDue === null
                    || new DateTimeImmutable('now') < deletion_warning_from($newDue)
                    || ($oldDue !== null && $newDue < $oldDue)
                    || strtolower(trim((string) ($before['organizer_email'] ?? ''))) !== $organizerEmail;
            }
            $pdo->prepare(
                'UPDATE events
                 SET title = ?, kind = ?, organizer_name = ?, organizer_email = ?, starts_at = ?, closes_at = ?, reveal_at = ?, max_guests = ?, max_photos_per_guest = ?, delete_at = ?'
                . ($reset ? ', delete_warned_at = NULL' : '') . '
                 WHERE id = ?'
            )->execute([...$values, $id]);
            if ($reset) {
                clear_delete_warning_mails($id);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    if (!$before) {
        fail(404, 'event', 'Album introuvable.');
    }
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
            max_photos_per_guest, delete_at, code, album_key, album_token_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
