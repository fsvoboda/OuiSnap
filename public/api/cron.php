<?php
// Tâche planifiée (OVH) : envoie les messages en attente (ouverture, révélation), même si personne ne visite le site.
declare(strict_types=1);
require __DIR__ . '/lib.php';

send_due_mails();
