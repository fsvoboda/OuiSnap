<?php
// Les organisateurs posent ou retirent un coup de cœur sur une photo de leur album dévoilé.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

$event = current_album();
require_revealed($event);

$liked = ($_POST['liked'] ?? '') === '1' ? 1 : 0;
$stmt = db()->prepare('UPDATE photos SET liked = ? WHERE id = ? AND event_id = ?');
$stmt->execute([$liked, (int) ($_POST['id'] ?? 0), $event['id']]);

// rowCount vaut 0 si la valeur n'a pas changé : on vérifie l'existence à part.
$stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE id = ? AND event_id = ?');
$stmt->execute([(int) ($_POST['id'] ?? 0), $event['id']]);
if ((int) $stmt->fetchColumn() === 0) {
    fail(404, 'photo', 'Photo introuvable.');
}

reply(200, ['ok' => true, 'liked' => $liked === 1]);
