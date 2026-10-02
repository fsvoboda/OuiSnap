<?php
// Fonctions communes de l'API invité.
declare(strict_types=1);

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

function photo_path(int $eventId, string $file, bool $thumb = false): string
{
    return sprintf('%s/%d/%s%s.jpg', storage_dir(), $eventId, $file, $thumb ? '_t' : '');
}

function event_payload(array $event): array
{
    $max = $event['max_photos_per_guest'];
    return ['title' => $event['title'], 'maxPhotos' => $max === null ? null : (int) $max];
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
            'SELECT g.id, g.event_id, g.name, e.title, e.max_photos_per_guest
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
