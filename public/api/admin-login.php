<?php
// Connexion de l'administrateur par mot de passe (session par cookie).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$hash = config()['admin_password_hash'] ?? '';
if ($hash === '' || !password_verify((string) ($_POST['password'] ?? ''), $hash)) {
    // Ralentit les essais en série.
    usleep(800000);
    fail(401, 'auth', 'Mot de passe incorrect.');
}

start_admin_session();
session_regenerate_id(true);
$_SESSION['admin'] = true;
reply(200, ['ok' => true]);
