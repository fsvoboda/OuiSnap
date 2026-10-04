<?php
// Mot de passe oublié : envoie un lien de réinitialisation aux adresses de l'administrateur.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

// Les plafonds sont globaux, et non par adresse IP : c'est la boîte mail de l'administrateur qu'on protège.
const RESET_MINUTES = 60;
const MAX_REQUESTS_PER_HOUR = 3;
const MAX_REQUESTS_PER_DAY = 10;

// Sans adresse publique configurée, le lien serait construit depuis l'en-tête Host, que n'importe qui peut forger.
// Le journal de mails (tests locaux) n'envoie rien : il n'a pas ce risque.
$config = config();
if (admin_emails() === [] || (($config['site_url'] ?? '') === '' && empty($config['mail_log']))) {
    error_log('OuiSnap : admin_emails ou site_url absent de api/config.php, réinitialisation du mot de passe impossible.');
    fail(503, 'config', "La réinitialisation n'est pas disponible pour l'instant.");
}

$now = time();
$stamp = gmdate('Y-m-d H:i:s', $now);
db()->prepare('DELETE FROM admin_password_resets WHERE created_at < ?')
    ->execute([gmdate('Y-m-d H:i:s', $now - 24 * 3600)]);

$lastHour = db()->prepare('SELECT COUNT(*) FROM admin_password_resets WHERE created_at >= ?');
$lastHour->execute([gmdate('Y-m-d H:i:s', $now - 3600)]);
$total = (int) db()->query('SELECT COUNT(*) FROM admin_password_resets')->fetchColumn();
if ((int) $lastHour->fetchColumn() >= MAX_REQUESTS_PER_HOUR || $total >= MAX_REQUESTS_PER_DAY) {
    fail(429, 'locked', 'Trop de demandes. Utilisez le dernier lien reçu, ou réessayez dans une heure.');
}

$token = bin2hex(random_bytes(24));
$expires = (new DateTimeImmutable('@' . ($now + RESET_MINUTES * 60)));
db()->prepare(
    'INSERT INTO admin_password_resets (token_hash, ip, created_at, expires_at) VALUES (?, ?, ?, ?)'
)->execute([
    hash('sha256', $token),
    substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
    $stamp,
    $expires->format('Y-m-d H:i:s'),
]);

// Le jeton est dans le fragment (#reset=) : il n'atteint ni les journaux du serveur ni l'en-tête Referer.
$mail = admin_reset_mail(site_url() . '/admin/#reset=' . $token, $expires);
$sent = 0;
foreach (admin_emails() as $email) {
    if (send_mail((string) $email, $mail)) {
        $sent++;
    } else {
        error_log("OuiSnap : échec de l'envoi du lien de réinitialisation à " . mask_email((string) $email));
    }
}

if ($sent === 0) {
    // Aucun envoi : la ligne est supprimée, pour que l'échec n'annule pas le lien précédent et ne compte pas dans le plafond.
    db()->prepare('DELETE FROM admin_password_resets WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    fail(500, 'mail', "Le message n'a pas pu être envoyé. Réessayez dans quelques minutes.");
}

// Un seul lien valable à la fois : le nouveau, bien parti, annule les précédents.
db()->prepare('UPDATE admin_password_resets SET used_at = ? WHERE used_at IS NULL AND token_hash <> ?')
    ->execute([$stamp, hash('sha256', $token)]);

reply(200, ['ok' => true, 'sentTo' => array_map(fn ($email) => mask_email((string) $email), admin_emails())]);
