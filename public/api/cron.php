<?php
// Tâche planifiée (OVH) : envoie les messages en attente (ouverture, révélation), même si personne ne visite le site.
// Fonctionne lancée par l'hébergeur en ligne de commande comme par l'appel de son adresse web. Ne renvoie rien.
// En ligne de commande seulement, elle applique aussi les durées de conservation : avertissement puis suppression
// automatique des albums, suppression des anciennes demandes de la vitrine (retention.php).
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/retention.php';

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
    // Conservation d'abord : les avertissements mis en file partent dans la foulée.
    run_retention();
    send_due_mails(500, 600.0);
} else {
    // Appel par le web : les durées de conservation ne sont pas appliquées (voir retention.php). Si c'est ainsi que
    // l'hébergeur lance la tâche, aucun album ne sera jamais supprimé automatiquement : l'administration l'affiche.
    error_log('OuiSnap : tâche planifiée lancée par le web (' . PHP_SAPI . '), suppressions automatiques non examinées.');
    send_due_mails(100, 20.0);
}
