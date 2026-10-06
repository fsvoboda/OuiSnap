<?php
// Fonctions communes de l'API.
declare(strict_types=1);

// En production, les erreurs PHP vont dans le journal du serveur, jamais à l'écran.
ini_set('display_errors', '0');

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

// --- Conservation : suppression automatique des albums ----------------------
// La politique de confidentialité promet la suppression de chaque album au plus tard six mois après sa clôture.
// Ici, seulement le calcul des dates : la suppression elle-même n'est faite que par la tâche planifiée (retention.php).

const DELETE_AFTER_MONTHS = 6;   // échéance par défaut : clôture + six mois
const DELETE_WARNING_DAYS = 30;  // avertissement des organisateurs et de l'administrateur avant l'échéance
const DELETE_GRACE_DAYS = 7;     // jamais de suppression moins de sept jours après l'avertissement

// Date lue dans la base, au format strict « AAAA-MM-JJ HH:MM:SS » (UTC). Toute autre valeur (vide, date à zéro
// de MySQL, texte inattendu) donne null : dans le doute, aucune échéance n'est calculée.
function stored_date(mixed $value): ?DateTimeImmutable
{
    if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $value) !== 1) {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new DateTimeZone('UTC'));
    if ($date === false || $date->format('Y-m-d H:i:s') !== $value || (int) $date->format('Y') < 2020) {
        return null;
    }
    return $date;
}

// Ajoute des mois sur le calendrier, en UTC, sans déborder sur le mois suivant :
// 31 août + 6 mois = 28 février (29 les années bissextiles), et non le 3 mars comme le ferait « +6 months » seul.
function add_months(DateTimeImmutable $date, int $months): DateTimeImmutable
{
    $date = $date->setTimezone(new DateTimeZone('UTC'));
    $month = $date->modify('first day of this month')->modify("+$months months");
    $day = min((int) $date->format('j'), (int) $month->format('t'));
    return $month->setDate((int) $month->format('Y'), (int) $month->format('n'), $day);
}

// Échéance de suppression d'un album : la clôture plus six mois, ou la date choisie par l'administrateur
// (events.delete_at) si elle est plus proche. Six mois après la clôture est un plafond, promis par la politique de
// confidentialité : une date choisie plus tardive (l'administration la refuse) est ramenée à ce plafond.
// Null = jamais de suppression automatique : pas de clôture, date illisible, ou date choisie antérieure à la
// clôture (l'administration la refuse aussi : valeur inattendue).
function deletion_due_at(array $event): ?DateTimeImmutable
{
    $closes = stored_date($event['closes_at'] ?? null);
    if ($closes === null) {
        return null;
    }
    $latest = add_months($closes, DELETE_AFTER_MONTHS);
    $chosen = $event['delete_at'] ?? null;
    if ($chosen === null || $chosen === '') {
        return $latest;
    }
    $chosen = stored_date($chosen);
    if ($chosen === null || $chosen < $closes) {
        return null;
    }
    return min($chosen, $latest);
}

// Début de la période d'avertissement : trente jours avant l'échéance.
function deletion_warning_from(DateTimeImmutable $due): DateTimeImmutable
{
    return $due->modify('-' . DELETE_WARNING_DAYS . ' days');
}

// Envois RÉUSSIS de l'avertissement de suppression d'un album, lus dans la file d'e-mails (mail_queue.sent_at).
// first : premier envoi réussi, pour l'affichage. proof : preuve que tout le monde a été prévenu, c'est-à-dire la
// date à partir de laquelle courent les sept jours du garde-fou : envoi réussi à au moins une adresse de
// l'administrateur ET, si l'album a une adresse d'organisateurs, envoi réussi aux organisateurs (la plus tardive des
// deux dates). Null tant que la preuve est incomplète. delete_warned_at, lui, n'est que la date de mise en file.
function delete_warning_sends(array $event): array
{
    $sends = ['first' => null, 'proof' => null];
    if (empty($event['delete_warned_at']) || (int) ($event['id'] ?? 0) < 1) {
        return $sends;
    }
    $stmt = db()->prepare('SELECT kind, sent_at FROM mail_queue WHERE event_id = ? AND kind IN (?, ?) AND sent_at IS NOT NULL');
    $stmt->execute([(int) $event['id'], MAIL_DELETE_ORGANIZER, MAIL_DELETE_ADMIN]);
    $admin = null;
    $organizer = null;
    foreach ($stmt->fetchAll() as $row) {
        $sent = stored_date($row['sent_at']);
        if ($sent === null) {
            continue;
        }
        $sends['first'] = $sends['first'] === null ? $sent : min($sends['first'], $sent);
        if ($row['kind'] === MAIL_DELETE_ADMIN) {
            $admin = $admin === null ? $sent : min($admin, $sent);
        } elseif ($row['kind'] === MAIL_DELETE_ORGANIZER) {
            $organizer = $sent;
        }
    }
    if ($admin !== null && (empty($event['organizer_email']) || $organizer !== null)) {
        $sends['proof'] = $organizer === null ? $admin : max($admin, $organizer);
    }
    return $sends;
}

// Date à laquelle l'album sera réellement supprimé, au plus tôt : l'échéance, mais jamais moins de sept jours après
// l'envoi réussi de l'avertissement (ou après maintenant, tant qu'il n'est pas parti). $sends : résultat de
// delete_warning_sends(), relu dans la file s'il n'est pas fourni. File illisible : comme si rien n'était parti.
function deletion_at(array $event, ?array $sends = null): ?DateTimeImmutable
{
    $due = deletion_due_at($event);
    if ($due === null) {
        return null;
    }
    try {
        $sends ??= delete_warning_sends($event);
    } catch (PDOException) {
        $sends = ['proof' => null];
    }
    $from = $sends['proof'] ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return max($due, $from->modify('+' . DELETE_GRACE_DAYS . ' days'));
}

// Vrai dès que l'échéance est à moins de trente jours, ou dépassée.
function deletion_is_near(array $event): bool
{
    $due = deletion_due_at($event);
    return $due !== null && new DateTimeImmutable('now') >= deletion_warning_from($due);
}

// Événement reconnu par la clé du lien privé remis aux organisateurs.
function current_album(): array
{
    $key = (string) ($_POST['token'] ?? '');
    if (is_token($key)) {
        // album_token_hash : anciens albums, dont seule l'empreinte de la clé était gardée.
        $stmt = db()->prepare(
            'SELECT * FROM events WHERE album_key = ? OR album_token_hash = ?'
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

// Tolérance d'horloge des téléphones, appliquée aux trois bornes de la date de prise : une photo datée au plus
// quinze minutes après la révélation (ou avant le début) est encore acceptée. Sans elle, un téléphone en avance
// ferait perdre une photo prise juste avant la révélation.
const TAKEN_SKEW_SECONDS = 900;

// Date de prise déclarée par le téléphone (champ POST « taken_at », millisecondes depuis 1970).
// null : champ absent (page chargée avant cette version), mal formé, ou dans le futur.
// Ce n'est PAS une preuve : c'est une déclaration du téléphone, que le serveur se contente de borner.
function posted_taken_at(): ?DateTimeImmutable
{
    $value = (string) ($_POST['taken_at'] ?? '');
    if (preg_match('/^[0-9]{1,14}$/', $value) !== 1) {
        return null;
    }
    $taken = new DateTimeImmutable('@' . intdiv((int) $value, 1000));
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return $taken > $now->modify('+' . TAKEN_SKEW_SECONDS . ' seconds') ? null : $taken;
}

// Vrai si la date déclarée tient dans la fenêtre de l'événement : après son début, avant sa révélation.
// Sans date de début (anciens événements), seule la borne de la révélation s'applique.
function taken_before_reveal(array $event, ?DateTimeImmutable $taken): bool
{
    $reveal = reveal_at($event);
    if ($taken === null || $reveal === null) {
        return false;
    }
    if ($taken > $reveal->modify('+' . TAKEN_SKEW_SECONDS . ' seconds')) {
        return false;
    }
    $starts = utc($event['starts_at'] ?? null);
    return $starts === null || $taken >= $starts->modify('-' . TAKEN_SKEW_SECONDS . ' seconds');
}

// Envoi d'une photo. L'album dévoilé n'accepte plus que les photos prises avant sa révélation (RG-129).
// Rend l'état de l'album (« open » ou « closed »), pour que l'appelant sache s'il reçoit une photo tardive.
function require_upload_allowed(array $event, ?DateTimeImmutable $taken): string
{
    $state = event_state($event);
    if ($state === 'expired') {
        fail(410, 'expired', EXPIRED_MESSAGE);
    }
    if ($state === 'upcoming') {
        fail(403, 'upcoming', "L'album n'est pas encore ouvert.");
    }
    if ($state === 'closed' && !taken_before_reveal($event, $taken)) {
        fail(403, 'closed', CLOSED_MESSAGE);
    }
    return $state;
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

// Adresses qui reçoivent le lien de réinitialisation du mot de passe (api/config.php, clé admin_emails).
function admin_emails(): array
{
    $emails = config()['admin_emails'] ?? null;
    return is_array($emails) && $emails !== [] ? array_values($emails) : [];
}

// Mot de passe d'administration : celui choisi via « Mot de passe oublié » (table settings) prime sur celui de la config.
// « version » est liée à la session : changer de mot de passe déconnecte toutes les sessions ouvertes.
// Pas de try/catch : si la table manque, l'accès est refusé plutôt que rabattu sur la config.
function admin_password(): array
{
    static $password = null;
    if ($password === null) {
        $stmt = db()->prepare('SELECT value FROM settings WHERE name = ?');
        $stmt->execute(['admin_password_hash']);
        $value = (string) $stmt->fetchColumn();
        $password = $value !== ''
            ? ['hash' => $value, 'version' => hash('sha256', $value)]
            : ['hash' => config()['admin_password_hash'] ?? '', 'version' => 'config'];
    }
    return $password;
}

function require_admin(): void
{
    start_admin_session();
    $session = $_SESSION['admin'] ?? null;
    if (!is_string($session) || !hash_equals(admin_password()['version'], $session)) {
        fail(401, 'auth', 'Connexion requise.');
    }
}

// « z…@gmail.com » : de quoi reconnaître l'adresse sans la divulguer.
function mask_email(string $email): string
{
    $at = strrpos($email, '@');
    if ($at === false || $at === 0) {
        return '…';
    }
    return mb_substr($email, 0, 1) . '…' . substr($email, $at);
}

// Album vu par l'administrateur : réglages, liens et compteurs.
function admin_event_payload(array $event): array
{
    $int = fn ($value) => $value === null ? null : (int) $value;
    try {
        $sends = delete_warning_sends($event);
    } catch (PDOException) {
        $sends = ['first' => null, 'proof' => null];
    }
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
        // Suppression automatique : date choisie par l'administrateur, date réelle prévue, proximité, avertissement
        // (deleteWarnedAt : mise en file ; deleteWarningSentAt : premier envoi réussi, null tant que rien n'est parti).
        'deleteAt' => stored_date($event['delete_at'] ?? null)?->format(DATE_ATOM),
        'deletesAt' => deletion_at($event, $sends)?->format(DATE_ATOM),
        'deleteNear' => deletion_is_near($event),
        'deleteWarnedAt' => stored_date($event['delete_warned_at'] ?? null)?->format(DATE_ATOM),
        'deleteWarningSentAt' => $sends['first']?->format(DATE_ATOM),
        'guests' => (int) ($event['guests'] ?? 0),
        'photos' => (int) ($event['photos'] ?? 0),
        'bytes' => (int) ($event['bytes'] ?? 0),
    ];
}

// Réglage de la table settings (nom, valeur), créé s'il n'existe pas encore.
function save_setting(string $name, string $value): void
{
    $now = gmdate('Y-m-d H:i:s');
    $update = db()->prepare('UPDATE settings SET value = ?, updated_at = ? WHERE name = ?');
    $update->execute([$value, $now, $name]);
    if ($update->rowCount() === 1) {
        return;
    }
    // Aucune ligne modifiée : réglage absent, ou déjà à cette valeur (MySQL ne compte que les lignes changées).
    try {
        db()->prepare('INSERT INTO settings (name, value, updated_at) VALUES (?, ?, ?)')->execute([$name, $value, $now]);
    } catch (PDOException $e) {
        if ((string) $e->getCode() !== '23000') {
            throw $e;
        }
    }
}

// État de l'envoi des e-mails, pour l'administration : dernier passage de la tâche planifiée et file d'attente.
// cronMode : « cli » (lancée par l'hébergeur) ou « web » (appel de l'adresse de cron.php).
function admin_status(): array
{
    $status = [
        'cronLastRun' => null, 'cronAge' => null, 'cronMode' => null, 'mailsPending' => 0, 'mailsAbandoned' => 0,
        'autoDeleteLastAt' => null, 'autoDeleteLastTitle' => null, 'autoDeleteCount' => 0,
        'retentionLastRun' => null, 'retentionAge' => null,
    ];
    try {
        $settings = db()->query(
            "SELECT name, value FROM settings WHERE name IN
               ('cron_last_run', 'cron_last_mode', 'auto_delete_last_at', 'auto_delete_last_title', 'auto_delete_count',
                'retention_last_run')"
        )->fetchAll(PDO::FETCH_KEY_PAIR);
        // Dernier passage où les suppressions automatiques ont réellement été examinées (tâche en ligne de commande).
        $examined = stored_date($settings['retention_last_run'] ?? null);
        if ($examined) {
            $status['retentionLastRun'] = $examined->format(DATE_ATOM);
            $status['retentionAge'] = max(0, time() - $examined->getTimestamp());
        }
        // Dernière suppression automatique d'un album par la tâche planifiée, s'il y en a eu une.
        $deleted = stored_date($settings['auto_delete_last_at'] ?? null);
        if ($deleted) {
            $status['autoDeleteLastAt'] = $deleted->format(DATE_ATOM);
            $status['autoDeleteLastTitle'] = (string) ($settings['auto_delete_last_title'] ?? '');
            $status['autoDeleteCount'] = (int) ($settings['auto_delete_count'] ?? 0);
        }
        $last = utc($settings['cron_last_run'] ?? null);
        if ($last) {
            $status['cronLastRun'] = $last->format(DATE_ATOM);
            $status['cronAge'] = max(0, time() - $last->getTimestamp()); // en secondes, à l'horloge du serveur
            $status['cronMode'] = ($settings['cron_last_mode'] ?? '') === 'cli' ? 'cli' : 'web';
        }
        $status['mailsPending'] = (int) db()
            ->query('SELECT COUNT(*) FROM mail_queue WHERE sent_at IS NULL AND abandoned_at IS NULL')->fetchColumn();
        $status['mailsAbandoned'] = (int) db()
            ->query('SELECT COUNT(*) FROM mail_queue WHERE abandoned_at IS NOT NULL')->fetchColumn();
    } catch (Throwable $e) {
        error_log("OuiSnap : état de l'envoi des e-mails illisible : " . $e->getMessage());
    }
    return $status;
}

function delete_photo_files(int $eventId, string $file): void
{
    @unlink(photo_path($eventId, $file));
    @unlink(photo_path($eventId, $file, true));
}

// Suppression définitive d'un événement : ses photos et vignettes sur le disque, l'image de son QR code, puis ses
// lignes (photos, invités, e-mails en file, événement). Commune à la suppression par l'administrateur et à la
// suppression automatique de la tâche planifiée. Aucun contrôle de droit ni d'échéance ici : c'est à l'appelant.
// Renvoie false si l'album n'a pas pu être supprimé en entier : ses lignes sont alors toutes conservées, et le
// journal dit ce qui a déjà été effacé du disque.
function delete_event(array $event): bool
{
    $id = (int) ($event['id'] ?? 0);
    if ($id < 1) {
        error_log('OuiSnap : suppression refusée, identifiant d\'événement invalide.');
        return false;
    }

    // Fichiers d'abord : le dossier de l'événement (nommé par son identifiant) ne contient que ses photos et leurs vignettes.
    $dir = storage_dir() . '/' . $id;
    $remaining = 0;
    $erased = 0;
    if (is_dir($dir)) {
        foreach (scandir($dir) ?: [] as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            @unlink("$dir/$file") ? $erased++ : $remaining++;
        }
        @rmdir($dir);
        clearstatcache();
    }
    // Dossier encore là (fichier ou dossier impossible à effacer, liste illisible) : pas de photos orphelines sans trace.
    if ($remaining > 0 || is_dir($dir)) {
        error_log(
            "OuiSnap : album $id non supprimé, son dossier $dir n'a pas pu être effacé ($remaining fichier(s) restant(s), "
            . "$erased déjà effacé(s) du disque). Ses lignes sont conservées dans la base."
        );
        return false;
    }

    // Le code sert de nom de fichier : il n'est utilisé que s'il a la forme d'un code.
    $code = (string) ($event['code'] ?? '');
    if (preg_match('/^[A-Za-z0-9]{1,16}$/', $code) === 1) {
        @unlink(qr_path($code));
    }

    // Lignes : toutes ou aucune. Les e-mails en file partent avec l'événement et ses invités (clés étrangères en cascade).
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM photos WHERE event_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM guests WHERE event_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log(
            "OuiSnap : album $id non supprimé de la base (" . $e->getMessage() . "). Ses fichiers de photos ($erased) et "
            . 'son QR code sont déjà effacés du disque ; toutes ses lignes sont conservées.'
        );
        return false;
    }
    return true;
}
