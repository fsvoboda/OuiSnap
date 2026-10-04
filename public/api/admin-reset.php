<?php
// Choix d'un nouveau mot de passe à partir du lien reçu par e-mail (usage unique, valable une heure).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

// 72 octets : au-delà, bcrypt ignore la fin du mot de passe.
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_BYTES = 72;
const LINK_MESSAGE = "Ce lien n'est plus valable : il a expiré ou a déjà servi. Demandez-en un nouveau.";

$token = (string) ($_POST['token'] ?? '');
if (!is_token($token)) {
    fail(410, 'link', LINK_MESSAGE);
}
$hash = hash('sha256', $token);

$stmt = db()->prepare('SELECT id FROM admin_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
$stmt->execute([$hash, gmdate('Y-m-d H:i:s')]);
if (!$stmt->fetch()) {
    fail(410, 'link', LINK_MESSAGE);
}

// Sans mot de passe : simple vérification du lien, qui reste utilisable.
if (!isset($_POST['password'])) {
    reply(200, ['ok' => true]);
}

// Le mot de passe est pris tel quel, espaces comprises. Une erreur ici ne consomme pas le lien.
$password = (string) $_POST['password'];
if (mb_strlen($password) < MIN_PASSWORD_LENGTH) {
    fail(422, 'invalid', 'Le mot de passe doit compter au moins ' . MIN_PASSWORD_LENGTH . ' caractères.');
}
if (strlen($password) > MAX_PASSWORD_BYTES) {
    fail(422, 'invalid', 'Le mot de passe est trop long.');
}
// bcrypt s'arrête au premier octet NUL : le reste du mot de passe serait ignoré.
if (str_contains($password, "\0")) {
    fail(422, 'invalid', 'Le mot de passe contient un caractère non autorisé.');
}
if ($password !== (string) ($_POST['confirm'] ?? '')) {
    fail(422, 'invalid', 'Les deux mots de passe ne sont pas identiques.');
}

$pdo = db();
$pdo->beginTransaction();
try {
    $now = gmdate('Y-m-d H:i:s');
    // Réservation : si deux envois arrivent en même temps, un seul passe.
    $claim = $pdo->prepare('UPDATE admin_password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
    $claim->execute([$now, $hash, $now]);
    if ($claim->rowCount() !== 1) {
        $pdo->rollBack();
        fail(410, 'link', LINK_MESSAGE);
    }
    $pdo->prepare('DELETE FROM settings WHERE name = ?')->execute(['admin_password_hash']);
    $pdo->prepare('INSERT INTO settings (name, value, updated_at) VALUES (?, ?, ?)')
        ->execute(['admin_password_hash', password_hash($password, PASSWORD_DEFAULT), $now]);
    // Les autres liens en attente n'ont plus lieu d'être, et les essais ratés sont oubliés.
    $pdo->prepare('UPDATE admin_password_resets SET used_at = ? WHERE used_at IS NULL')->execute([$now]);
    $pdo->exec('DELETE FROM admin_login_attempts');
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

reply(200, ['ok' => true]);
