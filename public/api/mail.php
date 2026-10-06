<?php
// Messages envoyés aux photographes : bienvenue à l'inscription, puis annonce de la révélation.
// Et le lien de réinitialisation du mot de passe, envoyé à l'administrateur.
// Chaque message part en deux versions : HTML aux couleurs de OuiSnap, et texte brut de secours.
declare(strict_types=1);

function site_url(): string
{
    $configured = config()['site_url'] ?? '';
    if ($configured !== '') {
        return rtrim($configured, '/');
    }
    $https = ($_SERVER['HTTPS'] ?? 'off') !== 'off';
    return ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

// « aux mariés », « à la famille »… selon la nature de l'événement.
function hosts_label(array $event): string
{
    return ['mariage' => 'aux mariés', 'bapteme' => 'à la famille'][$event['kind']] ?? 'aux organisateurs';
}

function album_label(array $event): string
{
    return [
        'mariage' => 'Album des mariés',
        'bapteme' => 'Album du baptême',
        'anniversaire' => "Album d'anniversaire",
    ][$event['kind']] ?? "Album de l'événement";
}

// Tournures propres à chaque nature d'événement. « autre » reste neutre : ses entrées sont vides,
// et les messages retombent alors sur une formulation générale.
const KIND_TEXTS = [
    'mariage' => [
        'thanks' => "Merci d'avance de votre contribution aux souvenirs de ce grand jour.",
        'guest_reveal' => 'Les mariés découvrent en ce moment leur journée à travers vos yeux.',
        'open_heading' => 'Votre album de mariage est ouvert',
        'open_extra' => "Profitez de votre journée : vos invités s'occupent des souvenirs.",
        'reveal_heading' => 'Votre album de mariage est dévoilé',
        'reveal_extra' => 'Revivez votre mariage à travers le regard de vos invités.',
    ],
    'bapteme' => [
        'thanks' => "Merci d'avance de votre contribution aux souvenirs de ce baptême.",
        'guest_reveal' => 'La famille découvre en ce moment ce baptême à travers vos yeux.',
        'open_heading' => "L'album du baptême est ouvert",
        'open_extra' => "Profitez de la cérémonie : vos invités s'occupent des souvenirs.",
        'reveal_heading' => "L'album du baptême est dévoilé",
        'reveal_extra' => 'Revivez ce baptême à travers le regard de vos proches.',
    ],
    'anniversaire' => [
        'thanks' => "Merci d'avance de votre contribution aux souvenirs de cet anniversaire.",
        'guest_reveal' => 'Les organisateurs découvrent en ce moment la fête à travers vos yeux.',
        'open_heading' => "L'album d'anniversaire est ouvert",
        'open_extra' => "Profitez de la fête : vos invités s'occupent des souvenirs.",
        'reveal_heading' => "L'album d'anniversaire est dévoilé",
        'reveal_extra' => 'Revivez cet anniversaire à travers le regard de vos invités.',
    ],
];

function kind_text(array $event, string $key, ?string $neutral = null): ?string
{
    return KIND_TEXTS[$event['kind'] ?? ''][$key] ?? $neutral;
}

// Lien personnel : il rouvre la session de l'invité, même sur un autre appareil.
function guest_link(array $event, ?string $token): string
{
    return site_url() . '/e/?c=' . $event['code'] . ($token ? '&t=' . $token : '');
}

const MAIL_FOOTER = 'Vous recevez ce message parce que vous avez laissé votre adresse en rejoignant cet album. '
    . "Elle ne sert qu'à vous écrire à son sujet.";
const ORGANIZER_FOOTER = "Vous recevez ce message parce que votre adresse a été indiquée comme celle des organisateurs de cet album.";

// « samedi 20 juin à 12h00 », en heure de Paris.
function french_date(DateTimeImmutable $date, bool $withTime = true): string
{
    $date = $date->setTimezone(new DateTimeZone('Europe/Paris'));
    $days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    $months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    $text = $days[(int) $date->format('w')] . ' ' . ((int) $date->format('j') === 1 ? '1er' : $date->format('j'))
        . ' ' . $months[(int) $date->format('n') - 1];
    return $withTime ? $text . ' à ' . $date->format('G\\hi') : $text;
}

// QR code des invités, s'il a été enregistré : l'image mène à sa version plein écran.
function qr_image(array $event, string $caption): ?array
{
    if (!is_file(qr_path($event['code']))) {
        return null;
    }
    return [
        'src' => site_url() . '/api/qr.php?c=' . $event['code'],
        'href' => site_url() . '/qr/?c=' . $event['code'],
        'caption' => $caption,
    ];
}

function album_link(array $event): string
{
    return site_url() . '/album/?k=' . $event['album_key'];
}

// « de Julie et Enzo », « d'Isabelle »… ou rien si le nom des organisateurs est inconnu.
function organizer_possessive(array $event): string
{
    $name = trim((string) ($event['organizer_name'] ?? ''));
    if ($name === '') {
        return '';
    }
    $elision = preg_match('/^[aeiouyhàâäéèêëîïôöùûü]/iu', $name) === 1;
    return $elision ? " d'$name" : " de $name";
}

function organizer_greeting(array $event): ?string
{
    return empty($event['organizer_name']) ? null : "Bonjour {$event['organizer_name']},";
}

// Message envoyé aux organisateurs à l'ouverture de l'album.
function organizer_open_mail(array $event): array
{
    $reveal = reveal_at($event);
    return [
        'subject' => "« {$event['title']} » : votre album est ouvert",
        'label' => album_label($event),
        'heading' => kind_text($event, 'open_heading', 'Votre album est ouvert'),
        'paragraphs' => array_values(array_filter([
            organizer_greeting($event),
            "L'album « {$event['title']} » est ouvert : vos invités peuvent photographier dès maintenant.",
            kind_text($event, 'open_extra'),
            $reveal
                ? 'Les photos resteront une surprise jusqu\'au ' . french_date($reveal)
                    . ". D'ici là, vous pouvez suivre qui photographie, et combien."
                : null,
        ])),
        'highlight' => null,
        'image' => qr_image(
            $event,
            'Montrez ce QR code à vos invités depuis votre téléphone : ils le scannent pour rejoindre l\'album. '
                . 'Touchez-le pour l\'afficher en plein écran.'
        ),
        'button' => ['label' => 'Suivre mon album', 'url' => album_link($event)],
        'note' => 'Ce lien est privé : il donne accès à votre album.',
        'footer' => ORGANIZER_FOOTER,
    ];
}

// Message envoyé aux organisateurs quand l'album est dévoilé.
function organizer_reveal_mail(array $event, int $photos, int $guests): array
{
    $closes = utc($event['closes_at'] ?? null);
    return [
        'subject' => "« {$event['title']} » : votre album est dévoilé",
        'label' => album_label($event),
        'heading' => kind_text($event, 'reveal_heading', 'Votre album est dévoilé'),
        'paragraphs' => array_values(array_filter([
            organizer_greeting($event),
            $photos === 0
                ? "L'album « {$event['title']} » est dévoilé, mais aucune photo n'a été envoyée."
                : "L'album « {$event['title']} » est dévoilé : $photos photo" . ($photos > 1 ? 's' : '')
                    . " prise" . ($photos > 1 ? 's' : '') . " par $guests photographe" . ($guests > 1 ? 's' : '')
                    . ' vous ' . ($photos > 1 ? 'attendent' : 'attend') . '.',
            $photos === 0 ? null : kind_text($event, 'reveal_extra'),
            'Vous pouvez les parcourir, poser un coup de cœur sur vos préférées et tout télécharger.',
            $closes
                ? "L'album reste accessible jusqu'au " . french_date($closes, false) . ' : pensez à le télécharger avant.'
                : null,
        ])),
        'highlight' => null,
        'image' => null,
        'button' => ['label' => 'Découvrir mon album', 'url' => album_link($event)],
        'note' => 'Ce lien est privé : il donne accès à votre album.',
        'footer' => ORGANIZER_FOOTER,
    ];
}

// Message envoyé à l'administrateur qui a oublié son mot de passe.
function admin_reset_mail(string $url, DateTimeImmutable $expires): array
{
    return [
        'subject' => "OuiSnap : réinitialisation du mot de passe d'administration",
        'label' => 'Administration',
        'heading' => 'Choisissez un nouveau mot de passe',
        'paragraphs' => [
            "Une réinitialisation du mot de passe de l'administration OuiSnap vient d'être demandée.",
            'Ce lien ne peut servir qu\'une fois et reste valable une heure, jusqu\'au ' . french_date($expires) . '.',
        ],
        'highlight' => null,
        'image' => null,
        'button' => ['label' => 'Choisir un nouveau mot de passe', 'url' => $url],
        'plain_link' => true,
        'note' => "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : le mot de passe actuel reste valable.",
        'footer' => "Message envoyé aux adresses de l'administrateur de OuiSnap.",
    ];
}

// Message envoyé à l'inscription d'un photographe qui a laissé son adresse.
function welcome_mail(array $event, string $name, string $token): array
{
    $max = guest_max_photos($event, true);
    return [
        'subject' => "« {$event['title']} » : bienvenue parmi les photographes",
        'label' => album_label($event),
        'heading' => "Bienvenue, $name !",
        'paragraphs' => [
            "Vous avez rejoint l'album « {$event['title']} »" . organizer_possessive($event)
                . '. ' . kind_text($event, 'thanks', "Merci d'avance de votre contribution à ce souvenir unique."),
            'Vous serez prévenu par e-mail dès que vos photos seront dévoilées ' . hosts_label($event) . '.',
        ],
        'highlight' => $max === null
            ? null
            : EMAIL_BONUS . " photos supplémentaires vous sont offertes pour avoir laissé votre adresse : "
                . "vous pouvez en envoyer jusqu'à $max.",
        'image' => qr_image(
            $event,
            'Invitez d\'autres convives : faites-leur scanner ce QR code. Touchez-le pour l\'afficher en plein écran.'
        ),
        'button' => ['label' => 'Continuer à photographier', 'url' => guest_link($event, $token)],
        'note' => 'Ce lien vous est personnel, ne le transférez pas. Il vous ramène dans l\'application '
            . 'depuis n\'importe quel téléphone.',
    ];
}

// Message envoyé aux photographes quand l'album est dévoilé.
function reveal_mail(array $event, array $guest): array
{
    $count = (int) $guest['total'];
    return [
        'subject' => "« {$event['title']} » : l'album est dévoilé",
        'label' => album_label($event),
        'heading' => "L'album est dévoilé",
        'paragraphs' => array_values(array_filter([
            "Bonjour {$guest['name']},",
            "L'album « {$event['title']} » vient d'être dévoilé " . hosts_label($event) . '. '
                . ($count > 1 ? "Vos $count photos en font partie" : 'Votre photo en fait partie')
                . " : merci d'avoir photographié !",
            kind_text($event, 'guest_reveal'),
            'Vous pouvez revoir vos photos et découvrir celles qui recevront un coup de cœur.',
        ])),
        'highlight' => null,
        'image' => null,
        'button' => ['label' => 'Revoir mes photos', 'url' => guest_link($event, $guest['link_token'] ?? null)],
        'note' => $guest['link_token'] ?? null ? 'Ce lien vous est personnel, ne le transférez pas.' : null,
    ];
}

function mail_text(array $mail): string
{
    $lines = [$mail['heading'], ...$mail['paragraphs']];
    if ($mail['highlight']) {
        $lines[] = $mail['highlight'];
    }
    if ($mail['image'] ?? null) {
        $lines[] = $mail['image']['caption'] . "\nQR code : " . $mail['image']['href'];
    }
    $lines[] = $mail['button']['label'] . " :\n" . $mail['button']['url'];
    if ($mail['note']) {
        $lines[] = $mail['note'];
    }
    $lines[] = "L'équipe OuiSnap";
    $lines[] = $mail['footer'] ?? MAIL_FOOTER;
    return implode("\n\n", $lines) . "\n";
}

// Mise en page en tableaux et styles en ligne : c'est ce que les messageries affichent fidèlement.
function mail_html(array $mail): string
{
    $e = fn (string $text) => htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $serif = "Georgia, 'Times New Roman', serif";
    $sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

    $paragraphs = '';
    foreach ($mail['paragraphs'] as $paragraph) {
        $paragraphs .= '<p style="margin:0 0 16px;font:16px/1.6 ' . $sans . ';color:#30443a;">' . $e($paragraph) . '</p>';
    }
    $highlight = $mail['highlight']
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>'
            . '<td style="background:#f5f0e6;border-left:4px solid #cba660;border-radius:6px;padding:16px 20px;'
            . 'font:italic 18px/1.5 ' . $serif . ';color:#1a2620;">' . $e($mail['highlight']) . '</td></tr></table>'
        : '';
    $note = $mail['note']
        ? '<p style="margin:24px 0 0;font:13px/1.6 ' . $sans . ';color:#6b7a70;text-align:center;">' . $e($mail['note']) . '</p>'
        : '';
    $image = ($mail['image'] ?? null)
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td align="center">'
            . '<a href="' . $e($mail['image']['href']) . '" style="text-decoration:none;">'
            . '<img src="' . $e($mail['image']['src']) . '" width="220" height="220" alt="QR code de l\'album" '
            . 'style="display:block;width:220px;height:220px;border:1px solid #cba660;border-radius:14px;background:#ffffff;"></a>'
            . '<p style="margin:14px auto 0;max-width:380px;font:13px/1.6 ' . $sans . ';color:#6b7a70;">'
            . $e($mail['image']['caption']) . '</p></td></tr></table>'
        : '';
    $url = $e($mail['button']['url']);
    // Adresse écrite en toutes lettres sous le bouton, pour les messageries qui neutralisent les boutons.
    $plainLink = ($mail['plain_link'] ?? null)
        ? '<p style="margin:20px 0 0;font:12px/1.6 ' . $sans . ';color:#6b7a70;text-align:center;">'
            . 'Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>'
            . '<a href="' . $url . '" style="color:#6b7a70;word-break:break-all;">' . $url . '</a></p>'
        : '';

    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $e($mail['subject']) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f5f0e6;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e6;"><tr>'
        . '<td align="center" style="padding:32px 12px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'
        // En-tête : logo et nature de l'album sur fond vert sapin, liseré doré.
        . '<tr><td align="center" style="background:#1a2620;border-radius:18px 18px 0 0;padding:36px 24px 30px;'
        . 'border-bottom:3px solid #cba660;">'
        . '<div style="font:40px/1.1 ' . $serif . ';color:#f5f0e6;">Oui<span style="font-style:italic;color:#cba660;">Snap</span></div>'
        . '<div style="margin-top:12px;font:600 11px/1.4 ' . $sans . ';letter-spacing:3px;text-transform:uppercase;color:#e2c88f;">'
        . $e($mail['label']) . '</div></td></tr>'
        . '<tr><td style="background:#fffdf8;border-radius:0 0 18px 18px;padding:36px 32px 32px;">'
        . '<h1 style="margin:0 0 20px;font:italic 28px/1.25 ' . $serif . ';color:#1a2620;font-weight:normal;">' . $e($mail['heading']) . '</h1>'
        . $paragraphs
        . $highlight
        . $image
        . '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 0;"><tr>'
        . '<td align="center" style="background:#cba660;border-radius:999px;">'
        . '<a href="' . $url . '" style="display:inline-block;padding:15px 34px;font:bold 15px/1 ' . $sans . ';'
        . 'color:#121a16;text-decoration:none;">' . $e($mail['button']['label']) . '</a></td></tr></table>'
        . $plainLink
        . $note
        . '</td></tr>'
        . '<tr><td align="center" style="padding:24px 20px 0;font:12px/1.6 ' . $sans . ';color:#6b7a70;">'
        . "L'équipe OuiSnap<br>" . $e($mail['footer'] ?? MAIL_FOOTER) . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

// $replyTo : adresse à laquelle répondre, quand ce n'est pas celle de OuiSnap.
function send_mail(string $to, array $mail, ?string $replyTo = null): bool
{
    $config = config();
    $text = mail_text($mail);
    $html = mail_html($mail);

    // Tests locaux : le message est écrit dans des fichiers au lieu d'être envoyé.
    if (!empty($config['mail_log'])) {
        // Un fichier HTML par message, pour contrôler le rendu.
        file_put_contents($config['mail_log'] . '.' . preg_replace('/[^a-z0-9]+/', '-', strtolower($to)) . '.html', $html);
        return file_put_contents(
            $config['mail_log'],
            "À : $to\nObjet : {$mail['subject']}\n\n$text" . str_repeat('-', 60) . "\n",
            FILE_APPEND
        ) !== false;
    }

    $from = $config['mail_from'] ?? '';
    if ($from === '' || $to === '') {
        error_log('OuiSnap : mail_from absent de la configuration, message non envoyé.');
        return false;
    }
    $boundary = 'ouisnap-' . bin2hex(random_bytes(12));
    $headers = implode("\r\n", [
        'From: OuiSnap <' . $from . '>',
        'Reply-To: ' . ($replyTo ?? $from),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ]);
    $part = fn (string $type, string $content) => "--$boundary\r\n"
        . "Content-Type: $type; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($content));
    $body = $part('text/plain', $text) . $part('text/html', $html) . "--$boundary--\r\n";

    return mail($to, mb_encode_mimeheader($mail['subject'], 'UTF-8', 'B'), $body, $headers, '-f' . $from);
}

// --- File d'attente des messages d'ouverture et de révélation ---------------
// Table mail_queue : une ligne par message à envoyer. Un envoi en échec est retenté plus tard ;
// un message envoyé ne repart jamais. Le corps n'est pas gardé : il est reconstruit à chaque essai.

const MAIL_OPEN_ORGANIZER = 'open_organizer';     // ouverture, aux organisateurs
const MAIL_REVEAL_GUEST = 'reveal_guest';         // révélation, à un invité
const MAIL_REVEAL_ORGANIZER = 'reveal_organizer'; // révélation, aux organisateurs

// Attente (en secondes) avant chaque essai, selon le nombre d'essais déjà faits :
// tout de suite, puis 10 min, 30 min, 2 h, 6 h et 12 h après l'essai précédent. Au sixième échec, abandon.
const MAIL_RETRY_DELAYS = [0, 600, 1800, 7200, 21600, 43200];

// Met en file les messages arrivés à échéance, puis envoie ce qui attend. Appelé à chaque visite utile
// et par la tâche planifiée. $limit et $seconds bornent le travail : une visite ne doit pas être ralentie.
// Une panne de la file (table absente, base occupée) est notée dans le journal sans faire échouer la page.
function send_due_mails(int $limit = 20, float $seconds = 8.0): void
{
    try {
        queue_due_open_mails();
        queue_due_reveal_mails();
        flush_mail_queue($limit, $seconds);
    } catch (PDOException $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        error_log("OuiSnap : file d'attente des e-mails en panne : " . $e->getMessage());
    }
}

// Réservation : la date est écrite une seule fois par album, même si deux visites arrivent en même temps.
// Celle qui l'écrit met les messages en file dans la même transaction : tout est enregistré, ou rien.
// $column : open_mail_sent_at ou reveal_mail_sent_at.
function claim_event_mails(array $event, string $column, callable $queue): void
{
    $pdo = db();
    $pdo->beginTransaction();
    $claim = $pdo->prepare("UPDATE events SET $column = ? WHERE id = ? AND $column IS NULL");
    $claim->execute([gmdate('Y-m-d H:i:s'), (int) $event['id']]);
    if ($claim->rowCount() !== 1) {
        $pdo->rollBack();
        return;
    }
    $queue();
    $pdo->commit();
}

// Message aux organisateurs : la contrainte d'unicité et le NOT EXISTS interdisent de le mettre deux fois en file.
function queue_organizer_mail(int $eventId, string $kind): void
{
    db()->prepare(
        'INSERT INTO mail_queue (event_id, kind, guest_id, recipient, created_at)
         SELECT e.id, ?, NULL, 0, ? FROM events e
         WHERE e.id = ?
           AND NOT EXISTS (SELECT 1 FROM mail_queue q WHERE q.event_id = e.id AND q.kind = ? AND q.recipient = 0)'
    )->execute([$kind, gmdate('Y-m-d H:i:s'), $eventId, $kind]);
}

// Message d'ouverture aux organisateurs, dès que l'heure de début est passée.
function queue_due_open_mails(): void
{
    $events = db()->query(
        'SELECT * FROM events WHERE open_mail_sent_at IS NULL AND organizer_email IS NOT NULL AND album_key IS NOT NULL'
    )->fetchAll();
    foreach ($events as $event) {
        if (in_array(event_state($event), ['upcoming', 'expired'], true)) {
            continue;
        }
        claim_event_mails($event, 'open_mail_sent_at', function () use ($event) {
            // Album déjà dévoilé : seul le message de révélation a un sens.
            if (!is_revealed($event)) {
                queue_organizer_mail((int) $event['id'], MAIL_OPEN_ORGANIZER);
            }
        });
    }
}

// Messages de révélation des albums qui viennent d'être dévoilés : photographes, puis organisateurs.
function queue_due_reveal_mails(): void
{
    $events = db()->query('SELECT * FROM events WHERE reveal_mail_sent_at IS NULL')->fetchAll();
    foreach ($events as $event) {
        if (!is_revealed($event)) {
            continue;
        }
        claim_event_mails($event, 'reveal_mail_sent_at', function () use ($event) {
            $eventId = (int) $event['id'];
            // Seuls les invités ayant laissé une adresse et envoyé au moins une photo sont prévenus.
            db()->prepare(
                'INSERT INTO mail_queue (event_id, kind, guest_id, recipient, created_at)
                 SELECT g.event_id, ?, g.id, g.id, ? FROM guests g
                 WHERE g.event_id = ? AND g.email IS NOT NULL
                   AND EXISTS (SELECT 1 FROM photos p WHERE p.guest_id = g.id)
                   AND NOT EXISTS (SELECT 1 FROM mail_queue q WHERE q.event_id = g.event_id AND q.kind = ? AND q.recipient = g.id)'
            )->execute([MAIL_REVEAL_GUEST, gmdate('Y-m-d H:i:s'), $eventId, MAIL_REVEAL_GUEST]);
            if (!empty($event['organizer_email']) && !empty($event['album_key'])) {
                queue_organizer_mail($eventId, MAIL_REVEAL_ORGANIZER);
            }
        });
    }
}

// Reconstruit un message de la file à partir de l'événement et de l'invité tels qu'ils sont maintenant.
// Renvoie ['send', adresse, message], ['retry', raison] (trop tôt : nouvel essai plus tard)
// ou ['abandon', raison] (le message n'a plus lieu d'être).
function queued_mail(array $row): array
{
    $stmt = db()->prepare('SELECT * FROM events WHERE id = ?');
    $stmt->execute([(int) $row['event_id']]);
    $event = $stmt->fetch();
    if (!$event) {
        return ['abandon', 'événement supprimé'];
    }
    if (is_expired($event)) {
        return ['abandon', 'album clôturé'];
    }

    if ($row['kind'] === MAIL_REVEAL_GUEST) {
        if (!is_revealed($event)) {
            return ['retry', 'album pas encore dévoilé'];
        }
        $stmt = db()->prepare(
            'SELECT g.name, g.email, g.link_token, (SELECT COUNT(*) FROM photos p WHERE p.guest_id = g.id) AS total
             FROM guests g WHERE g.id = ? AND g.event_id = ?'
        );
        $stmt->execute([(int) $row['guest_id'], (int) $event['id']]);
        $guest = $stmt->fetch();
        if (!$guest) {
            return ['abandon', 'invité supprimé'];
        }
        if (empty($guest['email'])) {
            return ['abandon', 'invité sans adresse'];
        }
        if ((int) $guest['total'] === 0) {
            return ['abandon', 'invité sans photo'];
        }
        return ['send', $guest['email'], reveal_mail($event, $guest)];
    }

    if (empty($event['organizer_email']) || empty($event['album_key'])) {
        return ['abandon', "pas d'adresse d'organisateurs"];
    }
    if ($row['kind'] === MAIL_OPEN_ORGANIZER) {
        if (is_revealed($event)) {
            return ['abandon', 'album déjà dévoilé'];
        }
        if (event_state($event) === 'upcoming') {
            return ['retry', 'album pas encore ouvert'];
        }
        return ['send', $event['organizer_email'], organizer_open_mail($event)];
    }
    if ($row['kind'] === MAIL_REVEAL_ORGANIZER) {
        if (!is_revealed($event)) {
            return ['retry', 'album pas encore dévoilé'];
        }
        $stmt = db()->prepare('SELECT COUNT(*), COUNT(DISTINCT guest_id) FROM photos WHERE event_id = ?');
        $stmt->execute([(int) $event['id']]);
        [$photos, $guests] = $stmt->fetch(PDO::FETCH_NUM);
        return ['send', $event['organizer_email'], organizer_reveal_mail($event, (int) $photos, (int) $guests)];
    }
    return ['abandon', 'nature de message inconnue'];
}

function abandon_queued_mail(int $id, string $reason): void
{
    db()->prepare('UPDATE mail_queue SET abandoned_at = ? WHERE id = ? AND sent_at IS NULL AND abandoned_at IS NULL')
        ->execute([gmdate('Y-m-d H:i:s'), $id]);
    error_log("OuiSnap : e-mail $id de la file abandonné ($reason).");
}

// Envoie les messages de la file dont l'heure est venue : au plus $limit messages et $seconds secondes par appel.
function flush_mail_queue(int $limit = 20, float $seconds = 8.0): void
{
    $max = count(MAIL_RETRY_DELAYS);
    $now = time();
    $date = fn (int $time) => gmdate('Y-m-d H:i:s', $time);

    // Un message est dû s'il n'a jamais été essayé, ou si son dernier essai est assez ancien pour son rang.
    $due = ['attempts = 0'];
    $params = [];
    for ($attempts = 1; $attempts < $max; $attempts++) {
        $due[] = '(attempts = ? AND last_attempt_at <= ?)';
        array_push($params, $attempts, $date($now - MAIL_RETRY_DELAYS[$attempts]));
    }
    // Essais épuisés sans abandon noté (requête interrompue en plein envoi) : repris ici pour être clos.
    $due[] = '(attempts >= ? AND last_attempt_at <= ?)';
    array_push($params, $max, $date($now - MAIL_RETRY_DELAYS[$max - 1]));

    $stmt = db()->prepare(
        'SELECT id, event_id, kind, guest_id, attempts FROM mail_queue
         WHERE sent_at IS NULL AND abandoned_at IS NULL AND (' . implode(' OR ', $due) . ')
         ORDER BY id LIMIT ' . max(1, $limit)
    );
    $stmt->execute($params);

    $started = microtime(true);
    foreach ($stmt->fetchAll() as $row) {
        if (microtime(true) - $started > $seconds) {
            break;
        }
        $id = (int) $row['id'];
        $attempts = (int) $row['attempts'];
        if ($attempts >= $max) {
            abandon_queued_mail($id, "$attempts essais sans succès");
            continue;
        }
        // Réservation de l'essai : si deux requêtes prennent le même message, une seule l'envoie.
        $claim = db()->prepare(
            'UPDATE mail_queue SET attempts = ?, last_attempt_at = ?
             WHERE id = ? AND attempts = ? AND sent_at IS NULL AND abandoned_at IS NULL'
        );
        $claim->execute([$attempts + 1, $date(time()), $id, $attempts]);
        if ($claim->rowCount() !== 1) {
            continue;
        }
        $attempts++;

        $result = queued_mail($row);
        if ($result[0] === 'abandon') {
            abandon_queued_mail($id, $result[1]);
            continue;
        }
        if ($result[0] === 'send' && send_mail($result[1], $result[2])) {
            db()->prepare('UPDATE mail_queue SET sent_at = ? WHERE id = ?')->execute([$date(time()), $id]);
            continue;
        }
        $reason = $result[0] === 'send' ? "échec de l'envoi à {$result[1]}" : $result[1];
        if ($attempts >= $max) {
            abandon_queued_mail($id, "$attempts essais sans succès, dernier : $reason");
        } else {
            error_log("OuiSnap : e-mail $id de la file ({$row['kind']}), essai $attempts sur $max : $reason. Nouvel essai plus tard.");
        }
    }
}
