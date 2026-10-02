<?php
// Inscription à la liste d'attente : reçoit un e-mail en POST, l'enregistre dans MySQL.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $code, array $body): never
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    reply(405, ['ok' => false, 'message' => 'Méthode non autorisée.']);
}

// Champ piège invisible : seul un robot le remplit.
if (!empty($_POST['site'])) {
    reply(200, ['ok' => true]);
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(422, ['ok' => false, 'message' => 'Cette adresse e-mail ne semble pas valide.']);
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('OuiSnap : api/config.php manquant (voir config.example.php).');
    reply(503, ['ok' => false, 'message' => "L'inscription n'est pas encore ouverte. Revenez très bientôt."]);
}
$config = require $configFile;

try {
    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'] ?? 3306,
            $config['database']
        ),
        $config['user'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    // INSERT IGNORE : une adresse déjà inscrite est confirmée sans rien révéler.
    $pdo->prepare('INSERT IGNORE INTO waitlist (email) VALUES (?)')->execute([$email]);
} catch (PDOException $e) {
    error_log('OuiSnap liste d\'attente : ' . $e->getMessage());
    reply(500, ['ok' => false, 'message' => "L'inscription a échoué. Réessayez dans un instant."]);
}

reply(200, ['ok' => true]);
