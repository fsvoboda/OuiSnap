---
name: pw
description: Joue les tests de bout en bout Playwright de OuiSnap (Franck dit « pw ») sur le serveur local, enregistre les résultats, régénère la page de bilan « Tests Playwright » et la republie pour qu'elle s'affiche dans VS Code. À utiliser dès que Franck parle de pw, de Playwright, de tests de bout en bout, de « lancer / relancer / passer les tests », de « vérifier que rien n'est cassé » après un changement, du bilan des tests, ou demande d'ajouter une étape ou un nouveau test Playwright. À utiliser aussi de soi-même avant une mise en ligne qui touche aux parcours admin, organisateurs ou invités.
---

# Tests Playwright de OuiSnap

« pw » est le mot de Franck pour Playwright : le comprendre quand il le dit, mais ne jamais l'employer soi-même. Dans les réponses, les documents et la page de bilan, écrire « Playwright » en toutes lettres (consigne du 4 octobre 2026). Les tests jouent de vrais parcours dans un navigateur, contre le serveur local, et finissent toujours par la page de bilan : c'est elle que Franck regarde, pas le journal de la conversation.

Franck est photographe, pas développeur. Lui rendre compte en termes de ce que voient les utilisateurs (« l'invité voit ses photos dans l'ordre »), en français et en le tutoyant.

## Les tests

| Test | Script | Ce qu'il joue |
|---|---|---|
| `mariage` | `scripts/e2e-mariage.js` | Création d'un mariage par l'admin, album des mariés, invité qui prend 5 photos, suppression d'une photo par l'admin, révélation, coups de cœur |
| `mot-de-passe` | `scripts/e2e-mot-de-passe.js` | Mot de passe oublié de l'admin : demande du lien, e-mail HTML, nouveau mot de passe, refus, plafond de demandes |
| `types` | `scripts/e2e-types.js` | Un événement de chaque type (mariage, baptême, anniversaire, autre) : les textes doivent s'adapter au type |

Sans précision de Franck, jouer les trois. S'il en nomme un, ne jouer que celui-là : le bilan garde le dernier résultat des autres.

## Déroulé d'un passage

Toutes les commandes se lancent depuis la racine du projet.

### 1. Vérifier le serveur local

```bash
bash .claude/skills/pw/scripts/base-locale.sh etat
```

Si la commande répond ARRÊT, lancer `npm run local` en arrière-plan, attendre que `etat` réponde OK, puis continuer. Cette vérification compte : après une mise en ligne, le dossier `out/` contient la configuration de production, et les tests écriraient dans la vraie base. `etat` refuse de continuer dans ce cas.

### 2. Jouer chaque test

Charger les outils du MCP Playwright (`mcp__playwright__browser_run_code_unsafe` et `mcp__playwright__browser_close`), puis pour chaque test :

1. Pour `mot-de-passe` seulement, avant : `bash .claude/skills/pw/scripts/base-locale.sh mdp`. Ce test change le mot de passe local et épuise le plafond de trois demandes par heure ; sans remise à zéro, il échoue au deuxième passage.
2. Appeler `mcp__playwright__browser_run_code_unsafe` avec le seul paramètre `filename`, par exemple `.claude/skills/pw/scripts/e2e-mariage.js`. Un test dure 10 à 30 secondes.
3. Appeler `mcp__playwright__browser_close`.
4. Pour `mot-de-passe` seulement, après, même en cas d'échec : la même commande `mdp`, pour rendre à Franck un admin local qui s'ouvre avec « admin ».

Chaque script enregistre lui-même son résultat complet, avec la date et les heures, dans `.playwright-mcp/dernier-<test>.json`, et ne renvoie qu'un résumé : `ok`, nombre d'étapes et de contrôles, `constats`, `error`, `enregistre`. Ne rien recopier à la main : le fichier fait foi. Si `enregistre` commence par « ÉCHEC », le résultat n'est pas sur le disque ; le dire, et ne pas l'ajouter au bilan.

Jouer chaque test une seule fois. Un test en échec ne se rejoue pas « pour voir » : chaque passage crée des événements dans la base locale, et un deuxième essai ne dit rien de plus que le premier.

**Déléguer les passages.** La réponse de l'outil contient tout le code du script joué, ce qui pèse lourd dans le contexte. Confier l'étape 2 à un sous-agent léger (modèle Haiku ou Sonnet) qui joue les tests et ne rapporte que les résumés ; garder pour soi l'analyse, le bilan et le compte rendu. C'est l'application des trois règles prioritaires de Franck.

### 3. Ajouter les passages au bilan

Pour chaque test joué :

```bash
node .claude/skills/pw/scripts/rapport.mjs ajouter mariage
```

La commande lit `dernier-<test>.json`, ajoute le passage à l'historique (`.playwright-mcp/resultats.json`) et régénère `.playwright-mcp/rapport-pw.html`. Elle refuse d'ajouter deux fois le même passage. Sa sortie donne le verdict, la page, la racine et la liste des captures.

Un passage interrompu par une panne de l'outil (navigateur qui ne répond plus, capture impossible) n'est pas un résultat de test : ne pas l'ajouter, corriger la cause, rejouer.

### 4. Publier la page

Franck veut voir le bilan s'afficher dans VS Code après chaque passage. C'est la publication qui l'affiche : appeler l'outil `Artifact` (action `publish`) avec

- `file_path` : la valeur `page` de la sortie précédente ;
- `root` : la valeur `racine` ;
- `files` : la liste `fichiers` telle quelle (les captures) ;
- `url` : `https://claude.ai/artifact/NCe9RVJ1fZGARy2Wn6eM4y`, pour mettre à jour la page existante au lieu d'en créer une nouvelle. Si la publication est refusée parce que la page n'a pas été lue dans cette session, la lire d'abord (action `read`, même adresse), puis republier ;
- `label` : la date et l'heure du passage, par exemple « Passage du 4 octobre, 22 h 49 ».

Le titre de la page est « Tests Playwright » (choix de Franck) : ne pas le changer.

### 5. Rendre compte

Commencer par le verdict, en une phrase. Puis un tableau court : test, étapes, contrôles, résultat. Donner l'adresse du bilan. Signaler ce qui n'a pas été joué ou pas vérifié.

Un message d'erreur 401 dans la console de l'admin est normal : la page vérifie s'il existe une session avant la connexion. Le bilan le range déjà parmi les messages attendus.

## Quand un test échoue

Distinguer trois cas, parce que la suite n'est pas la même.

- **L'appli a un défaut** (un contrôle `✗`, ou une étape qui s'arrête sur un comportement faux) : c'est le test qui fait son travail. Ajouter le passage au bilan tel quel, expliquer le défaut à Franck en termes d'écran, le corriger, relancer le serveur local, rejouer le test, puis mettre en ligne et commiter si la correction est bonne.
- **Le script a un défaut** (bouton renommé, attente trop courte après un changement voulu de l'appli) : corriger le script, rejouer, et le dire.
- **L'outil est en panne** (capture impossible, navigateur fermé) : ne pas compter le passage.

Si la liste des événements de l'admin devient longue, les captures ralentissent puis plantent. Nettoyer de temps en temps :

```bash
bash .claude/skills/pw/scripts/base-locale.sh nettoyer
```

Cela supprime seulement les événements créés par les tests (« Léa & Tom E2E … », « Test <type> E2E … ») et leurs photos.

## Ajouter une étape ou un test

Prendre `scripts/e2e-mariage.js` pour modèle : ses sélecteurs sont éprouvés.

- Un script est une fonction `async (page) => { … }` jouée dans le serveur Playwright : pas de `require`, pas d'accès aux fichiers. Tout passe par `page` et `page.context()`.
- Le scénario remplit `log` : une ligne `N. Titre` par étape, puis `  ✓ texte` par contrôle réussi (deux espaces, coche). Un constat qui ne doit pas arrêter le test s'écrit `  ✗ texte`. Le bilan s'appuie sur cette forme.
- La fin du fichier (bloc « Enregistrement du résultat ») est commune aux trois scripts : la recopier telle quelle dans un nouveau test, en changeant seulement son identifiant.
- Il n'y a pas de webcam : la caméra est remplacée par un flux vidéo synthétique (`addInitScript` sur `getUserMedia`). Pour dévoiler un album sans attendre le lendemain, l'admin avance la date de révélation.
- Les captures vont dans `.playwright-mcp/e2e/`. Celles de l'admin se prennent sans `fullPage`.
- Pour un nouveau test, l'ajouter au tableau `TESTS` de `scripts/rapport.mjs` (nom, résumé, limites, captures avec leur légende), et à la table en tête de ce fichier.

Jouer le test modifié, vérifier qu'il passe, mettre le bilan à jour, puis commiter la skill : elle est versionnée dans le dépôt.

## Où sont les choses

- `.claude/skills/pw/` : cette skill et ses scripts, versionnés.
- `.playwright-mcp/` : résultats, captures et page générée. Ignoré par git, donc présent seulement sur le Mac de Franck ; l'historique des passages y vit.
- `.local/` : la base SQLite de test, les photos de test et le journal des e-mails (en local, aucun e-mail ne part).
