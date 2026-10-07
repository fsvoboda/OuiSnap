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
  couper,
  enregistrerPdf,
  equilibrer,
  filet,
  flamme,
  goutte,
  italique,
  libelle,
  logo,
  mire,
  nomDroit,
  nouvelleCarte,
  ondes,
  paragraphe,
  petitQr,
  plaque,
  presentoir,
  texteCourbe,
  texteEspace,
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

// ---------------------------------------------------------------------------------------------
// Le verso : le recto est un objet qu'on vise, le verso est une page qu'on lit
// ---------------------------------------------------------------------------------------------

// Plus de plaque blanche, plus de motif à l'échelle de la carte : son absence suffit à dire « ceci
// est l'autre face ». Ce qui tient la carte, c'est la typographie, sur deux axes — le centre
// (x = 620) pour ce qui chante, la gauche (x = 196 et 254) pour ce qui s'exécute. Deux encres
// seulement, sapin et or : le bleu d'eau et le corail restent au recto, et le verso est impeccable
// en noir et blanc. Le verso est commun aux quatre natures d'événement, à deux détails près : le
// fleuron du filet séparateur, et le paragraphe d'explication.
//
// Colonne de texte de x = 176 à 1064 (888 px, 75 mm), donc 15 mm de blanc de chaque côté. Un
// recto-verso de bureau se décale de 2 à 3 mm : il reste alors 12 mm du côté serré, et rien
// n'approche la coupe.

const SITE_PHOTOGRAPHE = "https://www.pourunouieternel.fr";

// Coupe imposée après la virgule : c'est la respiration d'un faire-part, pas l'affaire d'un algorithme.
const SLOGAN = ["La fête,", "vue par vous."];

// Version resserrée de deux mots par rapport au contenu validé (« et dirigez-le vers » → « , visez »),
// sens inchangé : chaque étape tient ainsi sur deux lignes au corps 40, le plancher d'une consigne.
const ETAPES = [
  "Ouvrez l’appareil photo de votre téléphone, visez le code au recto.",
  "Touchez le lien qui s’affiche à l’écran, puis donnez votre prénom.",
  "Photographiez la fête : vos photos rejoignent l’album.",
];

// Posée juste sous la troisième étape, là où naît le doute. Points médians : elle se lit en trois
// coups d'œil au lieu d'une phrase.
const REASSURANCE = "Rien à installer · Aucun compte · Un prénom suffit";

// La seule phrase de la carte qui crée une urgence, et elle arrive après l'explication, jamais avant.
const FINALE = ["Ce que vous ne photographiez pas,", "personne ne le verra."];

// Le seul bloc de texte qui varie : qui découvre l'album, et ce qu'on y verra.
const EXPLICATIONS: Record<Kind, string> = {
  mariage:
    "OuiSnap réunit les photos de tous les invités dans un seul album, gardé secret jusqu’au lendemain. " +
    "Les mariés y découvriront leur mariage tel que vous l’avez vu : les tablées, les fous rires, la piste de danse.",
  bapteme:
    "OuiSnap réunit les photos de tous les invités dans un seul album, gardé secret jusqu’au lendemain. " +
    "La famille y découvrira cette journée telle que vous l’avez vue : les sourires, les retrouvailles, " +
    "les gestes que personne n’a vus.",
  anniversaire:
    "OuiSnap réunit les photos de tous les invités dans un seul album, gardé secret jusqu’au lendemain. " +
    "Les organisateurs y découvriront la fête telle que vous l’avez vue : les tablées, les fous rires, la piste de danse.",
  autre:
    "OuiSnap réunit les photos de tous les invités dans un seul album, gardé secret jusqu’au lendemain. " +
    "Les organisateurs y découvriront cette journée telle que vous l’avez vue : les visages, les rires, " +
    "tout ce qui s’est passé autour d’eux.",
};

function cercleOr(c: Carte, cx: number, cy: number, rayon: number, epaisseur: number) {
  const { ctx } = c;
  ctx.strokeStyle = OR;
  ctx.lineWidth = epaisseur;
  ctx.beginPath();
  ctx.arc(cx, cy, rayon, 0, 2 * Math.PI);
  ctx.stroke();
}

// Le motif du recto réduit à un signe de 56 px, posé dans la fenêtre du filet séparateur (x de 568
// à 672, y de 888 à 944), en or seul : un motif reprend de la force quand il revient petit, et les
// quatre fleurons se lisent par leur forme, jamais par leur couleur.
const FLEURONS: Record<Kind, (c: Carte) => void> = {
  // Les deux alliances de l'emblème du recto, au tiers de la taille et sans entrelacement : à 5 mm,
  // un ruban blanc de recouvrement ne donnerait qu'une bouillie, alors que deux anneaux qui se
  // chevauchent se lisent immédiatement.
  mariage: (c) => {
    for (const cx of [600, 640]) {
      cercleOr(c, cx, 916, 28, 3.5);
      cercleOr(c, cx, 916, 21, 2.5);
    }
  },
  // La goutte du recto à l'échelle 0,9 : le trou du filet se lit comme la surface qu'elle vient de percer.
  bapteme: (c) => goutte(c, 0, 539, 0.9),
  // Corps et flamme remplis d'or, sans contour : à 14 × 30 px, un blanc cerné d'un trait de 3 px se
  // refermerait à l'impression et donnerait un bâton sale. Une bougie de 5 mm est un signe, pas un dessin.
  anniversaire: (c) => {
    const { ctx } = c;
    ctx.fillStyle = OR;
    ctx.beginPath();
    ctx.roundRect(613, 914, 14, 30, 3);
    ctx.fill();
    filet(c, 620, 914, 620, 906, 2.5);
    flamme(c, 620, 906, 0.36, OR);
  },
  autre: (c) => mire(c, 620, 916, 0.7),
};

// Les trois anneaux sont à 124 px l'un de l'autre : l'œil les compte avant d'avoir lu un mot.
const yEtape = (rang: number) => 478 + rang * 124;

// Le chiffre de l'étape au centre de son anneau, puis son texte à droite. Chiffre en sapin sur
// blanc : un chiffre blanc sur or ne donnerait qu'un rapport de contraste de 2,4 pour 1, assez sur
// un écran, insuffisant sur un papier éclairé par des bougies.
function texteEtape(c: Carte, rang: number, texte: string) {
  const { ctx } = c;
  const centre = yEtape(rang);
  ctx.fillStyle = SAPIN;
  ctx.font = baton(c, 30, 600);
  ctx.textAlign = "center";
  ctx.fillText(String(rang + 1), 196, centre + 11);

  // Deux lignes équilibrées, pour qu'aucune seconde ligne ne porte un mot orphelin : `paragraphe`
  // n'équilibre que les blocs centrés, et les étapes sont alignées à gauche.
  ctx.font = baton(c, 40);
  const lignes = equilibrer(ctx, texte, [810, 810]) ?? couper(ctx, texte, () => 810);
  ctx.textAlign = "left";
  lignes.forEach((ligne, rangLigne) => ctx.fillText(ligne, 254, centre + 14 + rangLigne * 50));
}

// Le bloc d'explication reste centré sur y = 1078 : cinq lignes commencent à 994, quatre à 1015.
// On compte les lignes comme `paragraphe` les coupera, en perdant 2 px au-delà de cinq.
function basePremiereLigne(c: Carte, texte: string) {
  const compter = (corps: number) => {
    c.ctx.font = baton(c, corps);
    return couper(c.ctx, texte, () => 888).length;
  };
  let lignes = compter(32);
  if (lignes > 5) lignes = compter(30);
  return 1078 - ((Math.min(lignes, 5) - 1) * 42) / 2;
}

// Le dos des cartes. Les traits d'abord, les textes ensuite, comme au recto : aucun ornement n'est
// dessiné après un texte, et rien n'entre dans le bloc réservé du petit QR code.
export async function drawTableBack(kind: string) {
  const c = await nouvelleCarte(LARGEUR, HAUTEUR);
  const { ctx } = c;
  const nature = kindKey(kind);
  const explication = EXPLICATIONS[nature];

  // Les deux seuls traits longs de la carte : 2,5 px et non 2, car un trait plus fin sur 888 px sort
  // haché au jet d'encre. Le séparateur laisse sa fenêtre au fleuron.
  filet(c, 176, 916, 548, 916, 2.5);
  filet(c, 692, 916, 1064, 916, 2.5);
  filet(c, 176, 1374, 1064, 1374, 2.5);
  FLEURONS[nature](c);
  // Anneau évidé de 3 px, rayon 26 : un anneau franc de 4,4 mm, net en gris comme en couleur.
  ETAPES.forEach((_, rang) => cercleOr(c, 196, yEtape(rang), 26, 3));
  petitQr(c, SITE_PHOTOGRAPHE, 176, 1410, 236);

  // Le slogan, puis le logo qui le signe : au verso la lecture commence en haut, la maison signe
  // donc en haut — et le plus loin possible du QR code du photographe, pour que le petit code ne
  // puisse pas passer pour un second album.
  accroche(c, SLOGAN[0], { x: CENTRE, y: 196, corps: 112 });
  accroche(c, SLOGAN[1], { x: CENTRE, y: 316, corps: 112 });
  logo(c, CENTRE, 404, 52);

  ETAPES.forEach((texte, rang) => texteEtape(c, rang, texte));

  // Une seule ligne, jamais coupée : un point médian ne doit pas commencer une ligne. Or foncé,
  // jamais l'or clair, qui serait pâle en petit corps.
  ctx.font = baton(c, 30, 600);
  if (ctx.measureText(REASSURANCE).width > 888) ctx.font = baton(c, 28, 600);
  ctx.fillStyle = OR_FONCE;
  ctx.textAlign = "center";
  ctx.fillText(REASSURANCE, CENTRE, 856);

  // Le plus petit texte de la carte (32 px, 7,7 pt), donc interligne généreux et cinq lignes au plus.
  paragraphe(c, explication, {
    x: CENTRE,
    y: basePremiereLigne(c, explication),
    interligne: 42,
    largeur: 888,
    alignement: "center",
    corps: 32,
    lignesMax: 5,
  });

  accroche(c, FINALE[0], { x: CENTRE, y: 1248, corps: 52 });
  accroche(c, FINALE[1], { x: CENTRE, y: 1310, corps: 52 });

  // Le libellé du petit QR code, accroché à l'axe de gauche à 468 : la moitié droite du pied reste
  // blanche, c'est elle qui lui donne son air de carton et non de prospectus.
  ctx.font = baton(c, 30);
  ctx.fillStyle = SAPIN;
  ctx.textAlign = "left";
  ctx.fillText("Le photographe de votre événement", 468, 1502);
  ctx.font = baton(c, 30, 600);
  ctx.fillStyle = OR_FONCE;
  texteEspace(ctx, "pourunouieternel.fr", 468, 1556, 1, "left");

  return c.canvas;
}

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
  // Le dos des quatre cartes, sur une seconde page du même fichier : c'est ce qu'attend le mode
  // recto-verso d'une imprimante, qui prend les pages deux par deux. Retournement sur le bord long,
  // le réglage courant : les quatre cartes étant identiques et la grille symétrique, le verso se
  // pose aux mêmes places que le recto, sans rotation ni miroir.
  const verso = await drawTableBack(kind);
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
    verso,
  });
}
