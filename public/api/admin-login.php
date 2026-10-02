<?php
// Connexion de l'administrateur par mot de passe (session par cookie).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

// Après 5 essais ratés depuis une même adresse (ou 30 toutes adresses confondues) en un quart d'heure,
// la connexion est refusée, même avec le bon mot de passe, jusqu'à ce que ce délai soit passé.
const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_TOTAL = 30;

$ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
$since = gmdate('Y-m-d H:i:s', time() - WINDOW_MINUTES * 60);
db()->prepare('DELETE FROM admin_login_attempts WHERE failed_at < ?')->execute([$since]);

$stmt = db()->prepare('SELECT COUNT(*) FROM admin_login_attempts WHERE ip = ?');
$stmt->execute([$ip]);
$fromIp = (int) $stmt->fetchColumn();
$total = (int) db()->query('SELECT COUNT(*) FROM admin_login_attempts')->fetchColumn();
if ($fromIp >= MAX_FAILURES_PER_IP || $total >= MAX_FAILURES_TOTAL) {
    fail(429, 'locked', "Trop d'essais. Réessayez dans " . WINDOW_MINUTES . ' minutes.');
}

$hash = config()['admin_password_hash'] ?? '';
if ($hash === '' || !password_verify((string) ($_POST['password'] ?? ''), $hash)) {
    db()->prepare('INSERT INTO admin_login_attempts (ip, failed_at) VALUES (?, ?)')
        ->execute([$ip, gmdate('Y-m-d H:i:s')]);
    usleep(800000);
    fail(401, 'auth', 'Mot de passe incorrect.');
}

db()->prepare('DELETE FROM admin_login_attempts WHERE ip = ?')->execute([$ip]);
start_admin_session();
session_regenerate_id(true);
$_SESSION['admin'] = true;
reply(200, ['ok' => true]);
