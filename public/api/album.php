<?php
// Album des mariés : compteurs par invité avant la révélation, photos ensuite.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$event = current_album();
send_due_mails();
$revealed = is_revealed($event);

$stmt = db()->prepare(
    'SELECT g.name, COUNT(p.id) AS total
     FROM guests g JOIN photos p ON p.guest_id = g.id
     WHERE g.event_id = ?
     GROUP BY g.id, g.name
     ORDER BY total DESC, g.name'
);
$stmt->execute([$event['id']]);
$guests = array_map(fn (array $row) => ['name' => $row['name'], 'count' => (int) $row['total']], $stmt->fetchAll());

$body = [
    'ok' => true,
    'title' => $event['title'],
    'kind' => $event['kind'],
    'code' => $event['code'], // pour afficher le QR code des invités
    'revealAt' => reveal_at($event)?->format(DATE_ATOM),
    'revealed' => $revealed,
    // Suppression automatique à moins de trente jours : la page prévient les organisateurs (dates calculées, sans requête).
    'closesAt' => utc($event['closes_at'] ?? null)?->format(DATE_ATOM),
    'deletesAt' => deletion_is_near($event) ? deletion_at($event)?->format(DATE_ATOM) : null,
    'total' => array_sum(array_column($guests, 'count')),
    'guests' => $guests,
];

// Tant que l'album n'est pas dévoilé, aucune information sur les photos ne sort du serveur.
// Une fois dévoilées, elles sont rangées par invité (ordre alphabétique), puis par ordre de prise de vue.
if ($revealed) {
    $stmt = db()->prepare(
        'SELECT p.id, p.width, p.height, p.liked, p.guest_id, g.name
         FROM photos p JOIN guests g ON g.id = p.guest_id
         WHERE p.event_id = ?
         ORDER BY g.name, g.id, p.id'
    );
    $stmt->execute([$event['id']]);
    $body['photos'] = array_map(
        fn (array $row) => [
            'id' => (int) $row['id'],
            'width' => (int) $row['width'],
            'height' => (int) $row['height'],
            'guest' => (int) $row['guest_id'],
            'liked' => (bool) $row['liked'],
            'name' => $row['name'],
        ],
        $stmt->fetchAll()
    );
}

reply(200, $body);
