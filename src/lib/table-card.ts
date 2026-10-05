// PDF à imprimer pour les tables : une page A4 portant quatre cartes A6 identiques, à découper.
// Chaque nature d'événement a sa carte : la même plaque blanche porte le QR code, et c'est le
// décor autour d'elle qui raconte la fête (alliances, onde, gâteau, viseur). Papier blanc, aucun
// cadre le long des bords, rien à moins de 84 px d'un bord : la coupe à la main et la marge non
// imprimable ne se voient pas.
import { kindKey, kindOf, type Kind } from "@/lib/kinds";
import {
  CORAIL,
  OR,
  OR_FONCE,
  SAPIN,
  accroche,
  alliances,
  basesNom,
  baton,
  bougie,
  composerNom,
  enregistrerPdf,
  filet,
  goutte,
  italique,
  libelle,
  logo,
  mire,
  nomDroit,
  nouvelleCarte,
  ondes,
  paragraphe,
  plaque,
  presentoir,
  texteCourbe,
  viseur,
  type Bougie,
  type Carte,
} from "@/lib/card-kit";

// Carte A6 (105 × 148 mm) à 300 points par pouce.
const LARGEUR = 1240;
const HAUTEUR = 1748;
const CENTRE = LARGEUR / 2;

type Dessin = (c: Carte, titre: string, etiquette: string, url: string) => void;

// Mariage, « l'emblème » : papier blanc, deux alliances entrelacées côte à côte en
// tête de carte, les prénoms en grand dessous, puis la plaque tenue par un filet d'or.
const mariage: Dessin = (c, titre, etiquette, url) => {
  const yEmbleme = 215;
  // En haut l'anneau de gauche passe devant, en bas celui de droite.
  alliances(c, {
    a: [CENTRE - 60, yEmbleme],
    b: [CENTRE + 60, yEmbleme],
    exterieur: 100,
    interieur: 84,
    traitInterieur: 3,
    ruban: 40,
    devantA: [CENTRE, yEmbleme - 70],
    devantB: [CENTRE, yEmbleme + 70],
    cote: 90,
  });
  filet(c, CENTRE - 390, yEmbleme, CENTRE - 200, yEmbleme, 3);
  filet(c, CENTRE + 200, yEmbleme, CENTRE + 390, yEmbleme, 3);
  plaque(c, url, 588, { contour: { couleur: OR, epaisseur: 3 } });

  libelle(c, etiquette, { x: CENTRE, y: 374 });
  nomDroit(c, titre, {
    x: CENTRE,
    alignement: "center",
    largeur: 940,
    zone: [396, 538],
    corpsMax: 112,
    corpsMaxDeuxLignes: 56,
  });
  accroche(c, "Scannez, immortalisez", { x: CENTRE, y: 1472, corps: 80 });
  paragraphe(c, "Visez ce code avec votre téléphone et partagez vos photos avec les mariés.", {
    x: CENTRE,
    y: 1532,
    interligne: 40,
    largeur: 800,
    alignement: "center",
  });
};

// Baptême, « l'onde » : une goutte tombe sur le QR code et les cercles s'élargissent ; une onde
// sur deux est faite de mots. Aucune ligne droite hormis le QR code.
const bapteme: Dessin = (c, titre, etiquette, url) => {
  const { ctx } = c;
  const cy = 830;
  ondes(
    c,
    0,
    [
      [772, 4.5],
      [826, 4],
      [884, 3.5],
    ],
    // L'intervalle laissé entre 716 et 862 est la place du logo.
    [
      [672, 4.5],
      [716, 4],
      [862, 3.5],
      [916, 3],
      [974, 3],
    ],
  );
  goutte(c, 0, 0, 1.5);
  plaque(c, url, 440);

  // Le nom tourne dans l'anneau laissé entre le premier cercle et le haut de la carte (rayons 613
  // à 742). Un texte courbe ne s'étale pas à plus de 42° du sommet (1,466 × rayon), sinon les
  // lettres penchent trop : la largeur offerte dépend donc du rayon de chaque ligne.
  const rayons = (corps: number, lignes: number) =>
    basesNom(corps, lignes, 0).map((base) => 677.5 - base + 0.45 * corps);
  const nom = composerNom(ctx, titre, {
    police: (corps) => italique(c, corps),
    hauteur: 742 - 613,
    largeur: (corps, lignes, rang) => 1.466 * rayons(corps, lignes)[rang],
  });
  ctx.font = italique(c, nom.corps);
  ctx.fillStyle = SAPIN;
  const cercles = rayons(nom.corps, nom.lignes.length);
  nom.lignes.forEach((ligne, rang) => texteCourbe(ctx, ligne, CENTRE, cy, cercles[rang], "haut"));

  ctx.font = baton(c, 24, 600);
  ctx.fillStyle = OR_FONCE;
  texteCourbe(ctx, etiquette, CENTRE, cy, 545, "haut", 8);

  accroche(c, "Scannez-moi", { x: CENTRE, y: 1322, corps: 84 });
  ctx.font = baton(c, 30);
  ctx.fillStyle = SAPIN;
  texteCourbe(ctx, "Visez ce code avec votre téléphone et photographiez.", CENTRE, cy, 638, "bas", 2);
};

// Les sept bougies du gâteau : hauteurs, inclinaisons et habillages variés, comme plantées à la main.
const BOUGIES: Omit<Bougie, "pied">[] = [
  { x: 300, hauteur: 134, inclinaison: -3, habillage: "rayee" },
  { x: 407, hauteur: 168, inclinaison: 2, habillage: "pleine" },
  { x: 513, hauteur: 115, inclinaison: 0, habillage: "nue" },
  { x: 620, hauteur: 158, inclinaison: -2, habillage: "rayee" },
  { x: 727, hauteur: 108, inclinaison: 3, habillage: "nue" },
  { x: 833, hauteur: 168, inclinaison: 0, habillage: "pleine" },
  { x: 940, hauteur: 142, inclinaison: 2, habillage: "rayee" },
];

// Glaçage festonné : il se creuse au pied de chaque bougie et gonfle entre deux. Il monte, il ne
// coule pas : son bas s'arrête sur le bord de la plaque, la marge du QR code reste intacte.
function glacage(c: Carte, hautPlaque: number) {
  const { ctx } = c;
  const bas = hautPlaque + 2;
  const creux = hautPlaque - 16;
  const crete = hautPlaque - 38;
  ctx.beginPath();
  ctx.moveTo(222, bas);
  ctx.lineTo(222, creux + 14);
  ctx.quadraticCurveTo(222, creux, 236, creux);
  ctx.lineTo(BOUGIES[0].x, creux);
  for (let i = 1; i < BOUGIES.length; i++) {
    const de = BOUGIES[i - 1].x;
    const a = BOUGIES[i].x;
    const milieu = (de + a) / 2;
    const tension = (a - de) / 4;
    ctx.bezierCurveTo(de + tension, creux, milieu - tension, crete, milieu, crete);
    ctx.bezierCurveTo(milieu + tension, crete, a - tension, creux, a, creux);
  }
  ctx.lineTo(1004, creux);
  ctx.quadraticCurveTo(1018, creux, 1018, creux + 14);
  ctx.lineTo(1018, bas);
  ctx.closePath();
  ctx.fillStyle = CORAIL;
  ctx.fill();
}

// Anniversaire, « le gâteau » : le QR code est le gâteau, avec ses bougies et son présentoir.
// Tout le gâteau est 26 px plus haut que dans le cahier : les bougies ont grandi et le présentoir
// a pris un vrai pied, il fallait leur faire de la place.
const anniversaire: Dessin = (c, titre, etiquette, url) => {
  const haut = 514;
  plaque(c, url, haut, { contour: { couleur: SAPIN, epaisseur: 5 } });
  for (const b of BOUGIES) bougie(c, { ...b, pied: haut - 22, largeur: 34, arrondi: 6 });
  // Le glaçage vient après les bougies pour couvrir leurs pieds.
  glacage(c, haut);
  presentoir(c, 0, haut + 780 + 14);

  libelle(c, etiquette, { x: CENTRE, y: 112 });
  nomDroit(c, titre, { x: CENTRE, alignement: "center", largeur: 980, zone: [136, 236] });
  accroche(c, "Scannez, c’est la fête !", { x: CENTRE, y: 1478, corps: 80 });
  paragraphe(c, "Visez ce code avec l’appareil photo de votre téléphone et partagez vos photos de la fête.", {
    x: CENTRE,
    y: 1536,
    interligne: 40,
    largeur: 900,
    alignement: "center",
  });
};

// Autre événement, « le viseur » : on montre le geste. Le QR code est au point entre quatre
// équerres ; texte aligné à gauche sur le bord de la plaque, nom en romain droit.
// La plaque et ce qui la suit sont 50 px plus bas que dans le cahier, pour ne pas laisser un
// grand vide au-dessus du logo.
const autre: Dessin = (c, titre, etiquette, url) => {
  const { ctx } = c;
  const gauche = 230;
  const haut = 520;
  const milieu = haut + 390;
  plaque(c, url, haut);
  viseur(c, 0, haut);
  // Repères de mi-côté, à 8 px hors de la plaque.
  filet(c, 620, haut - 52, 620, haut - 8, 5);
  filet(c, 620, haut + 788, 620, haut + 832, 5);
  filet(c, 178, milieu, 222, milieu, 5);
  filet(c, 1018, milieu, 1062, milieu, 5);

  const fin = gauche + libelle(c, etiquette, { x: gauche, y: 170, alignement: "left" });
  filet(c, fin + 30, 160, 916, 160, 2);
  mire(c, 966, 160);
  nomDroit(c, titre, {
    droit: true,
    x: gauche,
    alignement: "left",
    largeur: 780,
    zone: [204, 370],
    corpsMaxDeuxLignes: 64,
  });
  filet(c, 230, 420, 350, 420, 5);

  // L'accroche s'arrête avant le déclencheur.
  accroche(c, "Scannez, déclenchez.", { x: gauche, y: 1434, corps: 76, alignement: "left", largeur: 870 - gauche });
  ctx.strokeStyle = SAPIN;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(958, 1408, 46, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = OR;
  ctx.beginPath();
  ctx.arc(958, 1408, 32, 0, 2 * Math.PI);
  ctx.fill();
  paragraphe(c, "Visez ce code avec l’appareil photo de votre téléphone et partagez vos photos.", {
    x: gauche,
    y: 1500,
    interligne: 40,
    largeur: 780,
    alignement: "left",
  });
};

const DESSINS: Record<Kind, Dessin> = { mariage, bapteme, anniversaire, autre };

export async function drawTableCard(titre: string, kind: string, url: string) {
  const c = await nouvelleCarte(LARGEUR, HAUTEUR);
  // Apostrophe typographique : la droite jure en Cormorant comme en capitales espacées.
  DESSINS[kindKey(kind)](c, titre, kindOf(kind).album.toUpperCase().replace("'", "’"), url);
  logo(c);
  return c.canvas;
}

export async function downloadTablePdf({
  title,
  kind,
  url,
  code,
}: {
  title: string;
  kind: string;
  url: string;
  code: string;
}) {
  const carte = await drawTableCard(title, kind, url);
  // Quatre cartes A6 : deux colonnes, deux rangées, et les deux traits de coupe.
  await enregistrerPdf(carte, `ouisnap-tables-${code}.pdf`, {
    largeur: 105,
    hauteur: 148.5,
    places: [
      [0, 0],
      [105, 0],
      [0, 148.5],
      [105, 148.5],
    ],
    coupes: [
      [105, 0, 105, 297],
      [0, 148.5, 210, 148.5],
    ],
  });
}
