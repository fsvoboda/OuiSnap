# OuiSnap
Application photo


## Page vitrine

Next.js en export statique, Tailwind v4, Motion. La liste d'attente passe par un script PHP qui écrit dans MySQL (hébergement OVH).

```bash
npm install
npm run dev      # aperçu de la page (le formulaire a besoin de PHP, voir plus bas)
npm run build    # génère le site dans out/
```

### Mise en ligne chez OVH

1. Dans phpMyAdmin, exécuter `database/001_waitlist.sql`.
2. Copier `public/api/config.example.php` en `public/api/config.php` et renseigner les identifiants MySQL.
3. `npm run build`, puis déposer le contenu de `out/` dans le dossier `www/` par FTP.

PHP 8.1 minimum (à régler dans l'espace client OVH).

### Tester le formulaire en local

```bash
npm run build && php -S localhost:8000 -t out
```
