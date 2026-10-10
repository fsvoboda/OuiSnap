# Visuels pour les réseaux sociaux

## Carrousel Instagram nº 1 — « comment ça marche »

Six vues, format 1080 × 1350, dans l'ordre de publication :

| Fichier | Ce qu'on voit | Origine |
|---|---|---|
| `insta-1-01-carte.jpg` | La carte posée sur une table dressée | image générée, QR code remplacé par le vrai |
| `insta-1-02-scan.jpg` | Le téléphone qui vise le code | image générée |
| `insta-1-03-connecte.jpg` | L'écran « Connecté ! », le prénom qu'on saisit | image générée, adresse du site corrigée |
| `insta-1-04-piste.jpg` | La piste de danse dans l'écran de l'appareil photo | image générée, compteur effacé et logo redessiné |
| `insta-1-05-promesses.png` | Rien à installer · Aucun compte · Un prénom suffit | fabriquée ici |
| `insta-1-06-slogan.png` | « La fête, vue par vous. » | fabriquée ici |

`graphique-trois-gestes.png` est en réserve : le mode d'emploi en trois étapes,
devenu inutile puisque les photos le montrent.

## Refabriquer les vues graphiques

```bash
bash reseaux/fabriquer.sh
```

Les sources sont `vue-2.html`, `vue-4.html`, `vue-5.html` et `vue-piste.html`,
avec `commun.css` pour les polices et les couleurs. Les polices sont celles du
flyer (`../flyer/assets/fonts/`).

## Le QR code des visuels

**Un seul code a le droit d'être publié : celui de la page de présentation**
(`qr-vitrine.svg`). Le code d'une vraie table ouvre l'album d'un vrai
événement ; publié en photo, même flou, il donne cet album à tout le monde.

Les images générées contiennent des codes inventés qui ne mènent nulle part.
Celui de la première vue a été remplacé par le vrai : `incruster-qr-vue1.html`
le pose à la teinte du papier (`qr-papier.svg`) et la lecture a été vérifiée,
elle renvoie `https://ouisnap.pourunouieternel.fr`. Les codes des vues 2 et 3
restent inventés : ils sont petits et flous, à l'arrière-plan.

Un code posé en fondu ou trop flouté n'est plus lisible : il faut le laisser
net et lui donner la couleur du support. Vérifié avec jsQR après chaque
modification, compression comprise.

## Droit à l'image

Aucune de ces images ne montre de personne réelle : rien à faire valider.
Une photo d'un vrai mariage demanderait l'accord écrit du couple, mentionnant
explicitement les réseaux sociaux.
