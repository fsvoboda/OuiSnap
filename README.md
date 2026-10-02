# OuiSnap

L'appli photo des invités de mariage : ils scannent le QR code posé sur leur table, photographient toute la journée, et les mariés reçoivent tout dans un album.

Production : https://ouisnap.pourunouieternel.fr (sous-domaine retenu comme adresse de production)

## Où en est le projet

| Étape | État |
|---|---|
| Page vitrine (présentation de l'application, formulaire de demande) | en ligne |
| Parcours invité (QR code, « Connecté ! », appareil photo, envoi) | en ligne |
| Album des organisateurs (compteurs, révélation, ZIP, coups de cœur) | en ligne |
| Administration (événements, QR code, PDF des tables, photos) | en ligne |
| Mentions légales et politique de confidentialité | en ligne |
| Paiement | à décider |

## Règles du produit

- Un événement a une nature (mariage, baptême, anniversaire, autre) ; les textes de l'appli s'y adaptent.
- L'invité n'installe rien et ne crée pas de compte : il scanne, donne son prénom (et son e-mail s'il le souhaite), photographie.
- Chaque événement a une date de **début** (pas d'envoi avant), de **révélation** (fin des envois, les organisateurs découvrent les photos ; par défaut le lendemain du début à 12h00) et de **clôture** (une date sans heure, proposée deux semaines après le début, postérieure à la révélation ; passé ce jour, l'album n'est plus accessible aux organisateurs ni aux invités ; vide = jamais). Les photos d'un album clôturé restent sur le serveur.
- Deux limites réglables par événement, vides = illimité : nombre de photographes, et nombre de photos par photographe.
- Un invité ne voit que ses propres photos, et peut en supprimer tant que l'album est ouvert.
- L'album est une surprise : avant la révélation, les organisateurs voient seulement qui a posté et combien.
- Après la révélation, les organisateurs voient l'album rangé par invité, le téléchargent en ZIP et peuvent poser un coup de cœur sur une photo ; le photographe le voit sur la sienne.
- Un invité qui laisse son e-mail reçoit 5 photos supplémentaires (si l'album est limité) et un message de bienvenue contenant un lien personnel pour revenir photographier depuis n'importe quel appareil.
- Le nom et l'adresse e-mail des organisateurs sont obligatoires à la création d'un événement : ils reçoivent un message à l'ouverture (QR code à montrer aux invités, lien de leur album) puis un autre à la révélation.
- Le QR code des invités figure aussi dans le message de bienvenue des photographes et sur la page des organisateurs ; un appui l'affiche en plein écran (`/qr/?c=CODE`).
- À la révélation, un e-mail prévient les photographes qui ont laissé leur adresse et envoyé au moins une photo. Il part de l'adresse `MAIL_FROM`, à la première visite du site après la révélation (ou par la tâche planifiée `api/cron.php`), une seule fois par album.
- L'administrateur voit toutes les photos à tout moment et peut en supprimer, même après la révélation. Il peut aussi supprimer un événement entier : ses photos sont alors effacées du serveur.

## Architecture

L'hébergement est un mutualisé OVH (PHP 8.3 + MySQL, pas de Node.js) :

- **Interface** : Next.js en export statique (`out/`), Tailwind v4, Motion.
- **API** : scripts PHP dans `public/api/`, connexion MySQL par PDO.
- **Photos** : réduites à 2560 px dans le navigateur avant envoi, stockées dans `ouisnap-data/`, à côté du dossier du site et inaccessible depuis le web.

| Dossier | Contenu |
|---|---|
| `src/app/` | page vitrine (`/`), appli invité (`/e/?c=CODE`), album des organisateurs (`/album/?k=CLÉ`), QR code plein écran (`/qr/?c=CODE`), administration (`/admin/`), pages légales (`/mentions-legales/`, `/confidentialite/`) |
| `src/components/guest/` | écrans de l'appli invité |
| `src/components/album/` | écrans de l'album des organisateurs |
| `src/components/admin/` | écrans de l'administration (`/admin/`) |
| `public/api/` | API PHP. Invités : `join`, `upload`, `photos`, `photo`, `delete`. Organisateurs : `album`, `album-photo`, `album-zip`, `album-like`. Administration : `admin-*`. Vitrine : `contact` |
| `database/` | migrations SQL numérotées (MySQL) et schéma SQLite de test |
| `scripts/` | mise en ligne, migrations, lancement local |

## Commandes

```bash
npm install
npm run dev       # interface seule (les appels à l'API échouent : pas de PHP)
npm run local     # appli complète sur une base SQLite de test
npm run migrate   # applique sur la base OVH les fichiers database/NNN_*.sql manquants
npm run deploy    # compile et envoie le site chez OVH (ajouter -- --dry-run pour simuler)
```

`npm run local` ouvre l'appli sur http://localhost:8000/e/?c=DEMO2026 et l'administration sur http://localhost:8000/admin/ (mot de passe local : `admin`). Les données de test vivent dans `.local/` ; les e-mails n'y sont pas envoyés mais écrits dans `.local/mails.log`.

## Mise en ligne

Les accès FTP et MySQL et le mot de passe de l'administration sont dans `.env.deploy`, non versionné (modèle : `deploy.env.example`).

1. `npm run migrate` si un nouveau fichier SQL a été ajouté. La base n'étant joignable que depuis l'hébergement, la commande dépose un script PHP temporaire, l'appelle une fois, puis le supprime.
2. `npm run deploy`. Le script génère `api/config.php` et envoie `out/` sans rien supprimer sur le serveur.

## Production

- **Adresse** : `https://ouisnap.pourunouieternel.fr`. Elle figure dans `OVH_SITE_URL` (`.env.deploy`, utilisée dans les e-mails) et dans `SITE_URL` (`src/app/layout.tsx`, utilisée pour le référencement). Les QR codes imprimés la contiennent : la changer les rendrait inutilisables.
- **Sécurité** : HTTPS forcé et mémorisé par le navigateur (HSTS), clés des liens privés jamais transmises à un autre site (`Referrer-Policy`), fichiers internes de l'API inaccessibles depuis le web, erreurs PHP jamais affichées.
- **Administration** : après 5 mots de passe erronés depuis une même adresse en 15 minutes, la connexion est bloquée pendant ce délai.
- **Référencement** : seule la page vitrine est ouverte aux moteurs de recherche (`robots.txt`).
- **Tâche planifiée** : pour que les e-mails d'ouverture et de révélation partent même si personne ne visite le site, créer dans l'espace client OVH une tâche horaire sur `ouisnap/api/cron.php`.
- **Téléchargement ZIP** : l'archive est écrite au fil de l'eau, sans fichier temporaire. Essai du 2026-10-03 sur le serveur : 1 000 photos (651 Mo) téléchargées en 64 secondes. L'hébergement refusant les réponses qui annoncent une très grosse taille, celle-ci n'est annoncée qu'en dessous de 150 Mo. Limite du format : 4 Go par archive.
- **Engagement de conservation** : la politique de confidentialité annonce la suppression des albums au plus tard six mois après leur clôture. Cette suppression se fait à la main, depuis l'administration.
- **Sauvegardes** : les photos (`ouisnap-data/`) et la base ne sont sauvegardées que par les instantanés d'OVH.

## Page vitrine

Elle présente OuiSnap comme le complément des reportages de PourUnOuiEternel (pourunouieternel.fr) et se termine par un formulaire de demande : chaque demande est enregistrée dans la table `requests` et envoyée par e-mail à l'adresse `MAIL_FROM`. Elle s'ouvre sur la vidéo de présentation (`public/media/ouisnap-teaser.mp4`, copie du fichier de `video/`) ; ses autres illustrations sont de vraies captures de l'application (`public/media/apercu-*.jpg`).

## Créer un événement

Tout se fait depuis l'administration : https://ouisnap.pourunouieternel.fr/admin/

1. « Nouvel événement » : nature, nom de l'album, début, révélation, clôture, limites.
2. « QR code et liens » : télécharger le **PDF pour les tables** (quatre cartes A6 par page A4, à découper) et copier le lien privé de l'album à remettre aux organisateurs.
