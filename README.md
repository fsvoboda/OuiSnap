# OuiSnap

L'appli photo des invités de mariage : ils scannent le QR code posé sur leur table, photographient toute la journée, et les mariés reçoivent tout dans un album.

En ligne : https://ouisnap.pourunouieternel.fr

## Où en est le projet

| Étape | État |
|---|---|
| Page vitrine avec liste d'attente | en ligne |
| Parcours invité (QR code, « Connecté ! », appareil photo, envoi) | en ligne, mariage de démonstration `DEMO2026` |
| Album des mariés (qui a posté et combien, puis révélation des photos, ZIP) | en ligne |
| Administration (création des mariages, QR codes à imprimer) | à faire |
| Paiement, mentions légales | à faire |

## Règles du produit

- L'invité n'installe rien et ne crée pas de compte : il scanne, donne son prénom, photographie.
- Les mariés fixent un nombre maximum de photos par invité (vide = illimité).
- Un invité ne voit que ses propres photos, et peut en supprimer.
- L'album est une surprise : avant la révélation, les mariés voient seulement qui a posté et combien.
- La révélation est automatique, le lendemain du mariage à 12h00 (heure de Paris). Les mariés peuvent alors voir toutes les photos et les télécharger en un fichier ZIP.
- Une fois l'album dévoilé, il est figé : les invités ne peuvent plus ajouter ni supprimer de photos, seulement revoir les leurs.
- Pour un test, la colonne `events.reveal_at` (date en UTC) remplace cette règle : l'album se dévoile à l'instant indiqué.

## Architecture

L'hébergement est un mutualisé OVH (PHP 8.3 + MySQL, pas de Node.js) :

- **Interface** : Next.js en export statique (`out/`), Tailwind v4, Motion.
- **API** : scripts PHP dans `public/api/`, connexion MySQL par PDO.
- **Photos** : réduites à 2560 px dans le navigateur avant envoi, stockées dans `ouisnap-data/`, à côté du dossier du site et inaccessible depuis le web.

| Dossier | Contenu |
|---|---|
| `src/app/` | page vitrine (`/`), appli invité (`/e/?c=CODE`), album des mariés (`/album/?k=CLÉ`) |
| `src/components/guest/` | écrans de l'appli invité |
| `src/components/album/` | écrans de l'album des mariés |
| `public/api/` | API PHP. Invités : `join`, `upload`, `photos`, `photo`, `delete`. Mariés : `album`, `album-photo`, `album-zip`. Vitrine : `waitlist` |
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

`npm run local` ouvre l'appli sur http://localhost:8000/e/?c=DEMO2026. Les données de test vivent dans `.local/`, avec deux mariages : `DEMO2026` (album pas encore révélé, clé `aaaa…`, 48 fois « a ») et `PASSE2026` (album révélé, clé `bbbb…`).

## Mise en ligne

Les accès FTP et MySQL sont dans `.env.deploy`, non versionné (modèle : `deploy.env.example`).

1. `npm run migrate` si un nouveau fichier SQL a été ajouté. La base n'étant joignable que depuis l'hébergement, la commande dépose un script PHP temporaire, l'appelle une fois, puis le supprime.
2. `npm run deploy`. Le script génère `api/config.php` et envoie `out/` sans rien supprimer sur le serveur.

## Créer un mariage

En attendant la page d'administration, un mariage se crée par une migration SQL. Le lien privé de l'album repose sur une clé dont la base ne garde que l'empreinte :

```bash
CLE=$(openssl rand -hex 24)                 # clé du lien de l'album, à remettre aux mariés
printf %s "$CLE" | shasum -a 256            # empreinte à mettre dans album_token_hash
```

```sql
INSERT INTO events (code, title, wedding_date, max_photos_per_guest, album_token_hash)
VALUES ('JULIEENZO26', 'Julie & Enzo', '2027-06-19', 30, '<empreinte>');  -- NULL = photos illimitées
```

- QR code des tables : `https://ouisnap.pourunouieternel.fr/e/?c=JULIEENZO26`
- Lien des mariés : `https://ouisnap.pourunouieternel.fr/album/?k=<clé>`
