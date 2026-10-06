<?php
// Tâche planifiée (OVH) : envoie les messages en attente (ouverture, révélation), même si personne ne visite le site.
// Fonctionne lancée par l'hébergeur en ligne de commande comme par l'appel de son adresse web. Ne renvoie rien.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$cli = PHP_SAPI === 'cli';

// Passage noté d'abord, pour l'administration : date UTC, et qui a lancé le script.
try {
    save_setting('cron_last_run', gmdate('Y-m-d H:i:s'));
    save_setting('cron_last_mode', $cli ? 'cli' : 'web');
} catch (PDOException $e) {
    error_log('OuiSnap : passage de la tâche planifiée non enregistré : ' . $e->getMessage());
}

// En ligne de commande, le domaine du site ne se devine pas : sans site_url, les liens des messages seraient faux.
if ($cli && (config()['site_url'] ?? '') === '' && empty(config()['mail_log'])) {
    error_log('OuiSnap : site_url absent de la configuration, aucun message envoyé par la tâche planifiée.');
    exit(1);
}

// Personne n'attend la réponse : la tâche traite plus de messages qu'une visite.
if ($cli) {
    send_due_mails(500, 600.0);
} else {
    send_due_mails(100, 20.0);
}
