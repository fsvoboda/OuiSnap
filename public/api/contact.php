<?php
// Demande envoyée depuis la page vitrine : enregistrée, puis transmise par e-mail à OuiSnap.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

// Champ piège invisible : seul un robot le remplit.
if (!empty($_POST['site'])) {
    reply(200, ['ok' => true]);
}

$clean = fn (string $field) => trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', (string) ($_POST[$field] ?? '')) ?? '');

$name = preg_replace('/\s+/u', ' ', $clean('name')) ?? '';
if ($name === '' || mb_strlen($name) > 80) {
    fail(422, 'invalid', 'Indiquez votre nom.');
}
$email = strtolower($clean('email'));
if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail(422, 'invalid', 'Cette adresse e-mail ne semble pas valide.');
}
$kind = $clean('kind');
if (!in_array($kind, EVENT_KINDS, true)) {
    fail(422, 'invalid', "Choisissez un type d'événement.");
}
$date = $clean('date');
if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    fail(422, 'invalid', "La date de l'événement n'est pas valide.");
}
$message = mb_substr($clean('message'), 0, 2000);

db()->prepare('INSERT INTO requests (name, email, kind, event_date, message) VALUES (?, ?, ?, ?, ?)')
    ->execute([$name, $email, $kind, $date === '' ? null : $date, $message === '' ? null : $message]);

$kinds = ['mariage' => 'Mariage', 'bapteme' => 'Baptême', 'anniversaire' => 'Anniversaire', 'autre' => 'Autre événement'];
$sent = send_mail(
    config()['mail_from'] ?? '',
    [
        'subject' => "Demande OuiSnap : $name",
        'label' => 'Demande reçue',
        'heading' => "Nouvelle demande de $name",
        'paragraphs' => array_values(array_filter([
            "Type d'événement : {$kinds[$kind]}",
            'Date : ' . ($date === '' ? 'non précisée' : french_date(new DateTimeImmutable($date . ' 12:00:00', new DateTimeZone('Europe/Paris')), false) . ' ' . substr($date, 0, 4)),
            "E-mail : $email",
            $message === '' ? null : "Message : $message",
        ])),
        'highlight' => null,
        'image' => null,
        'button' => ['label' => "Répondre à $name", 'url' => 'mailto:' . $email],
        'note' => null,
        'footer' => 'Message envoyé depuis le formulaire de la page OuiSnap.',
    ],
    $email
);
if (!$sent) {
    error_log("OuiSnap : demande de $email enregistrée, mais l'e-mail n'a pas pu être envoyé.");
}

reply(200, ['ok' => true]);
