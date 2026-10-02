<?php
// Fonctions communes de l'API.
declare(strict_types=1);

require_once __DIR__ . '/mail.php';

function reply(int $code, array $body): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// $error est un code stable lu par l'appli, $message le texte montré à l'invité.
function fail(int $code, string $error, string $message): never
{
    reply($code, ['ok' => false, 'error' => $error, 'message' => $message]);
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        fail(405, 'method', 'Méthode non autorisée.');
    }
}

function config(): array
{
    static $config = null;
    if ($config === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) {
            error_log('OuiSnap : api/config.php manquant (voir config.example.php).');
            fail(503, 'config', "OuiSnap n'est pas encore disponible.");
        }
        $config = require $file;
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $config = config();
        // 'dsn' sert aux tests locaux (SQLite) ; en ligne, la connexion MySQL est construite ici.
        $dsn = $config['dsn'] ?? sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'] ?? 3306,
            $config['database']
        );
        try {
            $pdo = new PDO($dsn, $config['user'] ?? null, $config['password'] ?? null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
                $pdo->exec('PRAGMA foreign_keys = ON');
            }
        } catch (PDOException $e) {
            error_log('OuiSnap base de données : ' . $e->getMessage());
            fail(500, 'server', 'Le service est momentanément indisponible.');
        }
    }
    return $pdo;
}

// Les photos sont rangées hors du dossier du site : aucune adresse web n'y mène directement.
function storage_dir(): string
{
    return config()['storage'] ?? dirname(__DIR__, 2) . '/ouisnap-data';
}

// Image du QR code d'un événement (envoyée par la page d'administration, utilisée dans les e-mails).
function qr_path(string $code): string
{
    return storage_dir() . '/qr/' . $code . '.png';
}

function photo_path(int $eventId, string $file, bool $thumb = false): string
{
    return sprintf('%s/%d/%s%s.jpg', storage_dir(), $eventId, $file, $thumb ? '_t' : '');
}

// Natures d'événement proposées dans l'administration.
const EVENT_KINDS = ['mariage', 'bapteme', 'anniversaire', 'autre'];

// Photos supplémentaires offertes aux photographes qui laissent leur adresse e-mail.
const EMAIL_BONUS = 5;

// Limite de photos d'un invité : celle de l'événement, plus le bonus s'il a donné son e-mail.
function guest_max_photos(array $event, bool $hasEmail): ?int
{
    $max = $event['max_photos_per_guest'];
    if ($max === null) {
        return null;
    }
    return (int) $max + ($hasEmail ? EMAIL_BONUS : 0);
}

function event_payload(array $event, bool $hasEmail = false): array
{
    return [
        'title' => $event['title'],
        'kind' => $event['kind'] ?? 'mariage',
        'maxPhotos' => guest_max_photos($event, $hasEmail),
        'emailBonus' => $event['max_photos_per_guest'] === null ? 0 : EMAIL_BONUS,
        'state' => event_state($event),
        'opensAt' => utc($event['starts_at'] ?? null)?->format(DATE_ATOM),
    ];
}

// Les dates sont stockées en UTC dans la base.
function utc(?string $value): ?DateTimeImmutable
{
    return empty($value) ? null : new DateTimeImmutable($value, new DateTimeZone('UTC'));
}

// Clôture : fin de l'accès à l'album, pour les organisateurs comme pour les invités.
function is_expired(array $event): bool
{
    $closes = utc($event['closes_at'] ?? null);
    return $closes !== null && new DateTimeImmutable('now') >= $closes;
}

// upcoming : pas encore ouvert ; open : les invités photographient ;
// closed : album dévoilé, figé pour les invités ; expired : album clôturé, plus accessible.
function event_state(array $event): string
{
    if (is_expired($event)) {
        return 'expired';
    }
    $starts = utc($event['starts_at'] ?? null);
    if ($starts && new DateTimeImmutable('now') < $starts) {
        return 'upcoming';
    }
    return is_revealed($event) ? 'closed' : 'open';
}

const EXPIRED_MESSAGE = 'Cet album est clôturé : il n\'est plus accessible.';

function require_not_expired(array $event): void
{
    if (is_expired($event)) {
        fail(410, 'expired', EXPIRED_MESSAGE);
    }
}

function photo_count(int $guestId): int
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE guest_id = ?');
    $stmt->execute([$guestId]);
    return (int) $stmt->fetchColumn();
}

function is_token(string $token): bool
{
    return preg_match('/^[a-f0-9]{48}$/', $token) === 1;
}

// Invité reconnu par le jeton que son téléphone a reçu en rejoignant l'album.
function current_guest(): array
{
    $token = (string) ($_POST['token'] ?? '');
    if (is_token($token)) {
        $stmt = db()->prepare(
            'SELECT g.id, g.event_id, g.name, g.email, e.title, e.kind, e.max_photos_per_guest,
                    e.wedding_date, e.starts_at, e.closes_at, e.reveal_at
             FROM guests g JOIN events e ON e.id = g.event_id
             WHERE g.token_hash = ?'
        );
        $stmt->execute([hash('sha256', $token)]);
        $guest = $stmt->fetch();
        if ($guest) {
            $guest['id'] = (int) $guest['id'];
            $guest['event_id'] = (int) $guest['event_id'];
            return $guest;
        }
    }
    fail(401, 'session', 'Session expirée. Scannez de nouveau le QR code.');
}

// Photo appartenant à l'invité connecté, ou 404.
function own_photo(array $guest): array
{
    $stmt = db()->prepare('SELECT id, file FROM photos WHERE id = ? AND guest_id = ?');
    $stmt->execute([(int) ($_POST['id'] ?? 0), $guest['id']]);
    $photo = $stmt->fetch();
    if (!$photo) {
        fail(404, 'photo', 'Photo introuvable.');
    }
    return $photo;
}

// Révélation de l'album : le lendemain du mariage à 12h00, heure de Paris.
// events.reveal_at (en UTC), s'il est renseigné, remplace cette règle : utile pour les tests.
function reveal_at(array $event): ?DateTimeImmutable
{
    if (!empty($event['reveal_at'])) {
        return (new DateTimeImmutable($event['reveal_at'], new DateTimeZone('UTC')))
            ->setTimezone(new DateTimeZone('Europe/Paris'));
    }
    if (empty($event['wedding_date'])) {
        return null;
    }
    $noon = new DateTimeImmutable($event['wedding_date'] . ' 12:00:00', new DateTimeZone('Europe/Paris'));
    return $noon->modify('+1 day');
}

function is_revealed(array $event): bool
{
    $at = reveal_at($event);
    return $at !== null && new DateTimeImmutable('now') >= $at;
}

// Événement reconnu par la clé du lien privé remis aux organisateurs.
function current_album(): array
{
    $key = (string) ($_POST['token'] ?? '');
    if (is_token($key)) {
        // album_token_hash : anciens albums, dont seule l'empreinte de la clé était gardée.
        $stmt = db()->prepare(
            'SELECT id, code, title, kind, wedding_date, reveal_at, closes_at
             FROM events WHERE album_key = ? OR album_token_hash = ?'
        );
        $stmt->execute([$key, hash('sha256', $key)]);
        $event = $stmt->fetch();
        if ($event) {
            $event['id'] = (int) $event['id'];
            require_not_expired($event);
            return $event;
        }
    }
    fail(404, 'album', "Ce lien d'album n'est pas valide.");
}

// Une fois l'album dévoilé, il est figé pour les invités : plus aucun ajout ni suppression.
const CLOSED_MESSAGE = "L'album a été dévoilé : il n'est plus possible d'ajouter ou de supprimer des photos.";

function require_open(array $event): void
{
    $state = event_state($event);
    if ($state === 'expired') {
        fail(410, 'expired', EXPIRED_MESSAGE);
    }
    if ($state === 'upcoming') {
        fail(403, 'upcoming', "L'album n'est pas encore ouvert.");
    }
    if ($state === 'closed') {
        fail(403, 'closed', CLOSED_MESSAGE);
    }
}

function require_revealed(array $event): void
{
    if (!is_revealed($event)) {
        fail(403, 'locked', "L'album n'est pas encore dévoilé.");
    }
}

// Nom de fichier sans accents ni caractères spéciaux.
function slug(string $text, string $fallback): string
{
    $plain = strtr($text, [
        'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a', 'ç' => 'c',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'í' => 'i',
        'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'õ' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u',
        'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae',
        'À' => 'A', 'Â' => 'A', 'Ä' => 'A', 'Ç' => 'C', 'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
        'Î' => 'I', 'Ï' => 'I', 'Ô' => 'O', 'Ö' => 'O', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
        'Ñ' => 'N', 'Œ' => 'OE', 'Æ' => 'AE',
    ]);
    $slug = trim(preg_replace('/[^A-Za-z0-9]+/', '-', $plain) ?? '', '-');
    return $slug === '' ? $fallback : $slug;
}

// --- Administration ---------------------------------------------------------

function start_admin_session(): void
{
    session_name('ouisnap_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => ($_SERVER['HTTPS'] ?? 'off') !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function require_admin(): void
{
    start_admin_session();
    if (empty($_SESSION['admin'])) {
        fail(401, 'auth', 'Connexion requise.');
    }
}

// Album vu par l'administrateur : réglages, liens et compteurs.
function admin_event_payload(array $event): array
{
    $int = fn ($value) => $value === null ? null : (int) $value;
    return [
        'id' => (int) $event['id'],
        'code' => $event['code'],
        'title' => $event['title'],
        'kind' => $event['kind'],
        'organizerName' => $event['organizer_name'] ?? null,
        'organizerEmail' => $event['organizer_email'] ?? null,
        'hasQr' => is_file(qr_path($event['code'])),
        'startsAt' => utc($event['starts_at'])?->format(DATE_ATOM),
        'closesAt' => utc($event['closes_at'])?->format(DATE_ATOM),
        'revealAt' => reveal_at($event)?->format(DATE_ATOM),
        'maxGuests' => $int($event['max_guests']),
        'maxPhotos' => $int($event['max_photos_per_guest']),
        'albumKey' => $event['album_key'],
        'state' => event_state($event),
        'revealed' => is_revealed($event),
        'expired' => is_expired($event),
        'emails' => (int) ($event['emails'] ?? 0),
        'mailSentAt' => utc($event['reveal_mail_sent_at'] ?? null)?->format(DATE_ATOM),
        'guests' => (int) ($event['guests'] ?? 0),
        'photos' => (int) ($event['photos'] ?? 0),
        'bytes' => (int) ($event['bytes'] ?? 0),
    ];
}

function delete_photo_files(int $eventId, string $file): void
{
    @unlink(photo_path($eventId, $file));
    @unlink(photo_path($eventId, $file, true));
}
