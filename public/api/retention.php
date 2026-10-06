<?php
// Conservation des données, comme le promet la politique de confidentialité : suppression automatique des albums
// (au plus tard six mois après leur clôture, après avertissement) et des demandes de la vitrine (trois ans).
// Inclus par cron.php seulement, et exécuté seulement quand la tâche planifiée de l'hébergeur le lance en ligne de
// commande : jamais par une visite d'invité, d'organisateur ou d'administrateur, ni par l'appel web de cron.php.
// Ce code efface des photos : dans le doute (date illisible, colonne absente, base en panne), il ne supprime rien
// et l'écrit dans le journal.
declare(strict_types=1);

const DELETE_BATCH = 5;            // albums supprimés au plus par passage de la tâche
const REQUEST_RETENTION_YEARS = 3; // demandes de la vitrine gardées trois ans après leur réception
const DELETE_REWARN_HOURS = 24;    // avertissement jamais parti : remis en file au plus une fois par jour et par album

// Point d'entrée, appelé par cron.php. Chaque étape est isolée : la panne de l'une n'empêche pas les autres.
function run_retention(): void
{
    if (PHP_SAPI !== 'cli') {
        error_log('OuiSnap : conservation des données ignorée, elle ne tourne que par la tâche planifiée.');
        return;
    }
    $steps = [
        'reprise des avertissements jamais partis' => 'reset_unsent_delete_warnings',
        'avertissements de suppression' => 'queue_due_delete_warnings',
        'suppression automatique des albums' => 'delete_due_events',
        'suppression des anciennes demandes' => 'delete_old_requests',
    ];
    // L'administrateur doit être prévenu avant toute suppression : sans adresse, aucun album n'est annoncé ni supprimé.
    if (admin_emails() === []) {
        error_log("OuiSnap : aucune adresse d'administrateur configurée (admin_emails), aucune suppression automatique d'album.");
        $steps = ['suppression des anciennes demandes' => 'delete_old_requests'];
    }
    foreach ($steps as $label => $step) {
        try {
            $step();
            // Trace pour l'administration : les suppressions d'albums ont réellement été examinées à ce passage.
            if ($step === 'delete_due_events') {
                save_setting('retention_last_run', gmdate('Y-m-d H:i:s'));
            }
        } catch (Throwable $e) {
            if (db()->inTransaction()) {
                db()->rollBack();
            }
            // Cas attendu : colonnes delete_at et delete_warned_at absentes tant que la migration 017 n'est pas passée.
            error_log("OuiSnap : $label en panne, rien n'a été supprimé à cette étape : " . $e->getMessage());
        }
    }
}

// Avertissement mis en file mais jamais parti (six échecs puis abandon, ou file vidée) : sans preuve d'envoi,
// l'album ne sera pas supprimé. Pour qu'il ne reste pas bloqué en silence, l'avertissement est remis à zéro et
// repartira au même passage (queue_due_delete_warnings), au plus une fois par DELETE_REWARN_HOURS et par album.
// Les messages déjà envoyés sont gardés : leur destinataire n'est pas prévenu deux fois.
function reset_unsent_delete_warnings(): void
{
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $events = db()->query(
        'SELECT * FROM events WHERE closes_at IS NOT NULL AND delete_warned_at IS NOT NULL ORDER BY id'
    )->fetchAll();
    $pending = db()->prepare(
        'SELECT COUNT(*) FROM mail_queue WHERE event_id = ? AND kind IN (?, ?) AND sent_at IS NULL AND abandoned_at IS NULL'
    );
    foreach ($events as $event) {
        $warned = stored_date($event['delete_warned_at']);
        if ($warned === null || $now < $warned->modify('+' . DELETE_REWARN_HOURS . ' hours')) {
            continue;
        }
        if (deletion_due_at($event) === null) {
            continue; // plus rien à annoncer : le garde-fou signale l'anomalie
        }
        if (delete_warning_sends($event)['proof'] !== null) {
            continue;
        }
        $pending->execute([(int) $event['id'], MAIL_DELETE_ORGANIZER, MAIL_DELETE_ADMIN]);
        if ((int) $pending->fetchColumn() > 0) {
            continue; // des essais sont encore prévus
        }
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE events SET delete_warned_at = NULL WHERE id = ? AND delete_warned_at = ?')
            ->execute([(int) $event['id'], $event['delete_warned_at']]);
        clear_delete_warning_mails((int) $event['id'], true);
        $pdo->commit();
        error_log(
            "OuiSnap : avertissement de suppression de l'album {$event['code']} « {$event['title']} » mis en file le "
            . "{$event['delete_warned_at']} UTC mais jamais parti à tous ses destinataires : remis en file, aucune suppression."
        );
    }
}

// Garde-fou de la suppression automatique. Renvoie null si TOUTES les conditions sont réunies, sinon
// [raison, anomalie] : anomalie vaut true quand quelque chose d'inattendu empêche la suppression (à écrire au
// journal), false quand l'album attend simplement son heure.
function deletion_refusal(array $event, DateTimeImmutable $now): ?array
{
    foreach (['id', 'code', 'title', 'closes_at', 'delete_at', 'delete_warned_at'] as $column) {
        if (!array_key_exists($column, $event)) {
            return ["colonne $column absente (migration 017 pas passée ?)", true];
        }
    }
    if ((int) $event['id'] < 1) {
        return ['identifiant invalide', true];
    }
    if ($event['closes_at'] === null || $event['closes_at'] === '') {
        return ['pas de date de clôture', false];
    }
    $closes = stored_date($event['closes_at']);
    if ($closes === null) {
        return ['date de clôture illisible', true];
    }
    if ($now < $closes) {
        return ['album pas encore clôturé', false];
    }
    $due = deletion_due_at($event);
    if ($due === null) {
        return ['date de suppression illisible ou antérieure à la clôture', true];
    }
    if ($now < $due) {
        return ['échéance pas encore atteinte', false];
    }
    if ($event['delete_warned_at'] === null || $event['delete_warned_at'] === '') {
        return ['avertissement pas encore mis en file', false];
    }
    $warned = stored_date($event['delete_warned_at']);
    if ($warned === null) {
        return ["date d'avertissement illisible", true];
    }
    if ($warned > $now) {
        return ["date d'avertissement dans le futur", true];
    }
    if ($now < $warned->modify('+' . DELETE_GRACE_DAYS . ' days')) {
        return ['avertissement de moins de ' . DELETE_GRACE_DAYS . ' jours', false];
    }
    // Preuve d'envoi réel, lue dans la file : la mise en file ne suffit pas (mail() a pu échouer jusqu'à l'abandon).
    if (admin_emails() === []) {
        return ["aucune adresse d'administrateur configurée", true];
    }
    $proof = delete_warning_sends($event)['proof'];
    if ($proof === null) {
        return [
            "avertissement mis en file le {$event['delete_warned_at']} UTC, mais aucun envoi réussi "
                . (empty($event['organizer_email']) ? "à l'administrateur" : "à l'administrateur et aux organisateurs"),
            true,
        ];
    }
    if ($proof > $now) {
        return ["date d'envoi de l'avertissement dans le futur", true];
    }
    if ($now < $proof->modify('+' . DELETE_GRACE_DAYS . ' days')) {
        return ['avertissement envoyé depuis moins de ' . DELETE_GRACE_DAYS . ' jours', false];
    }
    return null;
}

// Supprime les albums dont l'échéance est passée, au plus DELETE_BATCH par passage, les plus anciens d'abord.
function delete_due_events(): void
{
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $ids = db()->query(
        'SELECT id FROM events WHERE closes_at IS NOT NULL AND delete_warned_at IS NOT NULL ORDER BY id'
    )->fetchAll(PDO::FETCH_COLUMN);
    $find = db()->prepare('SELECT * FROM events WHERE id = ?');

    $deleted = 0;
    foreach ($ids as $id) {
        if ($deleted >= DELETE_BATCH) {
            break;
        }
        // Relu juste avant la décision : l'administrateur a pu repousser une date entre-temps.
        $find->execute([(int) $id]);
        $event = $find->fetch();
        $find->closeCursor();
        if (!is_array($event) || (int) ($event['id'] ?? 0) !== (int) $id) {
            continue;
        }
        $refusal = deletion_refusal($event, $now);
        if ($refusal !== null) {
            if ($refusal[1]) {
                error_log("OuiSnap : album $id non supprimé automatiquement : {$refusal[0]}.");
            }
            continue;
        }

        $label = "{$event['code']} « {$event['title']} »";
        if (!delete_event($event)) {
            error_log("OuiSnap : suppression automatique de l'album $label impossible, album conservé.");
            continue;
        }
        $deleted++;
        error_log(
            "OuiSnap : suppression automatique de l'album $label (clôture {$event['closes_at']} UTC, "
            . "avertissement {$event['delete_warned_at']} UTC)."
        );
        // Trace pour l'administration : dernière suppression et total.
        try {
            $count = db()->prepare('SELECT value FROM settings WHERE name = ?');
            $count->execute(['auto_delete_count']);
            save_setting('auto_delete_count', (string) ((int) $count->fetchColumn() + 1));
            save_setting('auto_delete_last_title', (string) $event['title']);
            save_setting('auto_delete_last_at', gmdate('Y-m-d H:i:s'));
        } catch (PDOException $e) {
            error_log('OuiSnap : suppression automatique non enregistrée dans les réglages : ' . $e->getMessage());
        }
    }
}

// Demandes du formulaire de la vitrine : supprimées trois ans après leur réception (seule date connue de la table).
function delete_old_requests(): void
{
    $limit = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('-' . REQUEST_RETENTION_YEARS . ' years')
        ->format('Y-m-d H:i:s');
    $delete = db()->prepare('DELETE FROM requests WHERE created_at < ?');
    $delete->execute([$limit]);
    if ($delete->rowCount() > 0) {
        error_log('OuiSnap : ' . $delete->rowCount() . ' demande(s) de la vitrine de plus de trois ans supprimée(s).');
    }
}
