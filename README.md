# OuiSnap

L'appli photo des invités de mariage : ils scannent le QR code posé sur leur table, photographient toute la journée, et les mariés reçoivent tout dans un album.

En ligne : https://ouisnap.pourunouieternel.fr

## Où en est le projet

| Étape | État |
|---|---|
| Page vitrine avec liste d'attente | en ligne |
| Parcours invité (QR code, « Connecté ! », appareil photo, envoi) | en ligne |
| Album des organisateurs (compteurs, révélation, ZIP, coups de cœur) | en ligne |
| Administration (événements, QR code, PDF des tables, photos) | en ligne |
| Paiement, mentions légales, domaine dédié | à faire |

## Règles du produit

- Un événement a une nature (mariage, baptême, anniversaire, autre) ; les textes de l'appli s'y adaptent.
- L'invité n'installe rien et ne crée pas de compte : il scanne, donne son prénom, photographie.
- Chaque événement a une date de **début** (pas d'envoi avant), de **révélation** (fin des envois, les organisateurs découvrent les photos ; par défaut le lendemain du début à 12h00) et de **clôture** (une date sans heure, proposée deux semaines après le début, postérieure à la révélation ; passé ce jour, l'album n'est plus accessible aux organisateurs ni aux invités ; vide = jamais). Les photos d'un album clôturé restent sur le serveur.
- Deux limites réglables par événement, vides = illimité : nombre de photographes, et nombre de photos par photographe.
- Un invité ne voit que ses propres photos, et peut en supprimer tant que l'album est ouvert.
- L'album est une surprise : avant la révélation, les organisateurs voient seulement qui a posté et combien.
- Après la révélation, les organisateurs voient l'album rangé par invité, le téléchargent en ZIP et peuvent poser un coup de cœur sur une photo ; le photographe le voit sur la sienne.
- L'administrateur voit toutes les photos à tout moment et peut en supprimer, même après la révélation.

## Architecture

L'hébergement est un mutualisé OVH (PHP 8.3 + MySQL, pas de Node.js) :

- **Interface** : Next.js en export statique (`out/`), Tailwind v4, Motion.
- **API** : scripts PHP dans `public/api/`, connexion MySQL par PDO.
- **Photos** : réduites à 2560 px dans le navigateur avant envoi, stockées dans `ouisnap-data/`, à côté du dossier du site et inaccessible depuis le web.

| Dossier | Contenu |
|---|---|
| `src/app/` | page vitrine (`/`), appli invité (`/e/?c=CODE`), album des organisateurs (`/album/?k=CLÉ`), administration (`/admin/`) |
| `src/components/guest/` | écrans de l'appli invité |
| `src/components/album/` | écrans de l'album des organisateurs |
| `src/components/admin/` | écrans de l'administration (`/admin/`) |
| `public/api/` | API PHP. Invités : `join`, `upload`, `photos`, `photo`, `delete`. Organisateurs : `album`, `album-photo`, `album-zip`, `album-like`. Administration : `admin-*`. Vitrine : `waitlist` |
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

`npm run local` ouvre l'appli sur http://localhost:8000/e/?c=DEMO2026 et l'administration sur http://localhost:8000/admin/ (mot de passe local : `admin`). Les données de test vivent dans `.local/`.

## Mise en ligne

Les accès FTP et MySQL et le mot de passe de l'administration sont dans `.env.deploy`, non versionné (modèle : `deploy.env.example`).

1. `npm run migrate` si un nouveau fichier SQL a été ajouté. La base n'étant joignable que depuis l'hébergement, la commande dépose un script PHP temporaire, l'appelle une fois, puis le supprime.
2. `npm run deploy`. Le script génère `api/config.php` et envoie `out/` sans rien supprimer sur le serveur.

## Créer un événement

Tout se fait depuis l'administration : https://ouisnap.pourunouieternel.fr/admin/

1. « Nouvel événement » : nature, nom de l'album, début, révélation, clôture, limites.
2. « QR code et liens » : télécharger le **PDF pour les tables** (quatre cartes A6 par page A4, à découper) et copier le lien privé de l'album à remettre aux organisateurs.
