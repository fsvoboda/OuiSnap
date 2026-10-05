// PDF remis aux organisateurs : une feuille A4 coupée d'un trait en deux cartes A5 en paysage.
// Le QR code de cette carte ouvre l'album privé, pas la page des invités : tout est fait pour
// qu'on ne la confonde pas avec une carte de table (format paysage, carton crème qui porte les
// mots, onglet « ALBUM PRIVÉ » fixé à la plaque, consigne de ne pas la poser sur les tables).
import { kindKey, type Kind } from "@/lib/kinds";
import {
  BLANC,
  CORAIL,
  CREME,
  OR,
  SAPIN,
  accroche,
  alliances,
  baton,
  bougie,
  enregistrerPdf,
  filet,
  goutte,
  italique,
  largeurEspacee,
  libelle,
  logo,
  mire,
  nomDroit,
  nouvelleCarte,
  ondes,
  paragraphe,
  plaque,
  presentoir,
  romain,
  texteCourbe,
  texteEspace,
  viseur,
  type Carte,
} from "@/lib/card-kit";

// Carte A5 en paysage (210 × 148,5 mm) à 300 points par pouce : deux cartes de table côte à côte.
const LARGEUR = 2480;
const HAUTEUR = 1754;
// Le volet droit reprend les tracés des cartes de table, décalés d'une carte.
const DX = 1240;
const CENTRE = 620 + DX;
const GAUCHE_PLAQUE = 230 + DX;

const ONGLET = "ALBUM PRIVÉ";
const LEGENDE = "Scannez pour ouvrir votre album";
const PETITE_LIGNE = "Carte personnelle, à ne pas poser sur les tables.";

// Sapin éclairci, pour la signature discrète sous le logo (couleur pleine : aucune transparence).
const GRIS_SAPIN = "#5d6862";

const POUR: Record<Kind, string> = {
  mariage: "POUR LES MARIÉS",
  bapteme: "POUR LA FAMILLE",
  anniversaire: "POUR LES ORGANISATEURS",
  autre: "POUR LES ORGANISATEURS",
};

// Un morceau de la ligne de date : texte courant, exposant (« er ») ou lettre isolée par deux
// espaces fines (le « h » de l'heure).
type Morceau = { texte: string; exposant?: boolean; isole?: boolean };

// Moment de la révélation, à l'heure de Paris, sans année : « dimanche 1er novembre à 12 h 30 »,
// « à 12 h » pour une heure ronde.
function texteRevelation(revealAt: string | null, revealed: boolean): Morceau[] {
  const date = revealAt ? new Date(revealAt) : null;
  if (!date || Number.isNaN(date.getTime())) return [{ texte: "Vous serez prévenus par e-mail." }];
  if (revealed || date.getTime() <= Date.now()) return [{ texte: "Votre album est dévoilé." }];
  const parts = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Paris",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const premier = part("day") === "1";
  return [
    { texte: `${part("weekday")} ${part("day")}` },
    ...(premier ? [{ texte: "er", exposant: true }] : []),
    { texte: ` ${part("month")} à ${Number(part("hour"))}` },
    { texte: "h", isole: true },
    ...(part("minute") === "00" ? [] : [{ texte: part("minute") }]),
  ];
}

// Écrit la ligne de date, réduite par pas de 4 px si elle dépasse. En Cormorant italique « 1er »
// se lit presque « ler » : le « er » monte en exposant.
function ligneRevelation(c: Carte, morceaux: Morceau[], x: number, y: number, largeur: number) {
  const { ctx } = c;
  const poser = (corps: number, dessiner: boolean) => {
    let curseur = x;
    morceaux.forEach((morceau, rang) => {
      ctx.font = italique(c, morceau.exposant ? corps * 0.6 : corps);
      if (morceau.isole) curseur += corps * 0.09;
      if (dessiner) ctx.fillText(morceau.texte, curseur, morceau.exposant ? y - corps * 0.35 : y);
      curseur += ctx.measureText(morceau.texte).width;
      if (morceau.isole && rang < morceaux.length - 1) curseur += corps * 0.17;
    });
    return curseur - x;
  };
  let corps = 72;
  while (corps > 56 && poser(corps, false) > largeur) corps -= 4;
  ctx.fillStyle = SAPIN;
  ctx.textAlign = "left";
  poser(corps, true);
}

// Volet gauche, commun aux quatre natures : le carton crème qui porte les mots.
function carton(c: Carte, titre: string, type: Kind, revelation: Morceau[]) {
  const { ctx } = c;
  const x = 200;
  const largeur = 930;

  ctx.fillStyle = CREME;
  ctx.beginPath();
  ctx.roundRect(120, 120, 1090, 1514, 36);
  ctx.fill();

  // Pastille « à qui est la carte », et la clé d'or à sa droite.
  ctx.font = baton(c, 26, 600);
  const pastille = largeurEspacee(ctx, POUR[type], 7) + 72;
  ctx.fillStyle = SAPIN;
  ctx.beginPath();
  ctx.roundRect(x, 196, pastille, 64, 32);
  ctx.fill();
  ctx.fillStyle = BLANC;
  texteEspace(ctx, POUR[type], x + pastille / 2, 238, 7);

  ctx.strokeStyle = OR;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(938, 228, 34, 0, 2 * Math.PI);
  ctx.stroke();
  filet(c, 972, 228, 1130, 228, 8);
  ctx.fillStyle = OR;
  ctx.fillRect(1076, 228, 12, 34);
  ctx.fillRect(1108, 228, 12, 24);

  // Titre construit comme le logo : un mot droit en sapin, un mot italique en or.
  let corps = 190;
  const mesurer = () => {
    ctx.font = romain(c, corps);
    const votre = ctx.measureText("Votre ").width;
    ctx.font = italique(c, corps);
    return { votre, total: votre + ctx.measureText("album").width };
  };
  while (mesurer().total > largeur && corps > 120) corps -= 6;
  const { votre } = mesurer();
  ctx.textAlign = "left";
  ctx.font = romain(c, corps);
  ctx.fillStyle = SAPIN;
  ctx.fillText("Votre", x, 470);
  ctx.font = italique(c, corps);
  ctx.fillStyle = OR;
  ctx.fillText("album", x + votre, 470);

  nomDroit(c, titre, {
    droit: type === "autre",
    x,
    alignement: "left",
    largeur,
    zone: [500, 670],
  });
  filet(c, x, 712, x + 120, 712, 5);

  const intertitre = (texte: string, y: number) =>
    libelle(c, texte, { x, y, alignement: "left", corps: 24, espacement: 7 });
  const texte = (contenu: string, y: number) =>
    paragraphe(c, contenu, { x, y, interligne: 44, largeur, alignement: "left" });

  intertitre("AVANT LA RÉVÉLATION", 800);
  texte("Suivez qui photographie et combien de photos arrivent. Les photos, elles, restent secrètes.", 850);
  intertitre("APRÈS", 990);
  texte("Découvrez toutes les photos, posez vos coups de cœur et téléchargez l’album entier.", 1040);
  intertitre("RÉVÉLATION DE L’ALBUM", 1190);
  ligneRevelation(c, revelation, x, 1280, largeur);

  filet(c, x, 1430, x + largeur, 1430, 2);
  paragraphe(
    c,
    "Ce code est personnel : il ouvre votre album privé. Gardez cette carte pour vous et ne la posez pas sur les tables.",
    { x, y: 1492, interligne: 40, largeur, alignement: "left", corps: 28, lignesMax: 3 },
  );
}

const legende = (c: Carte, texte: string, y: number, corps = 56) => accroche(c, texte, { x: CENTRE, y, corps });

// La consigne reste lisible même si la carte est pliée et que seul ce volet se voit.
function petiteLigne(c: Carte, y: number) {
  c.ctx.font = baton(c, 30, 600);
  c.ctx.fillStyle = SAPIN;
  c.ctx.textAlign = "center";
  c.ctx.fillText(PETITE_LIGNE, CENTRE, y);
}

// Volet droit : le motif de la nature, repris de la carte de table mais dessiné autrement, autour
// de la même plaque. Chaque fonction dit ce qui change par rapport à la carte de table.
const VOLETS: Record<Kind, (c: Carte, url: string) => void> = {
  // Les alliances en bijou : deux petits anneaux entiers, côte à côte, au-dessus de la plaque.
  // Sur la carte de table ils sont immenses et l'un au-dessus de l'autre ; ici rien n'entoure la plaque.
  mariage(c, url) {
    libelle(c, "RÉSERVÉ AUX MARIÉS", { x: CENTRE, y: 130 });
    // En haut l'anneau de gauche passe devant, en bas celui de droite.
    alliances(c, {
      a: [CENTRE - 50, 250],
      b: [CENTRE + 50, 250],
      exterieur: 84,
      interieur: 70,
      traitInterieur: 3,
      ruban: 36,
      devantA: [CENTRE, 182],
      devantB: [CENTRE, 318],
      cote: 80,
    });
    filet(c, CENTRE - 300, 250, CENTRE - 160, 250, 3);
    filet(c, CENTRE + 160, 250, CENTRE + 300, 250, 3);
    plaque(c, url, 500, {
      gauche: GAUCHE_PLAQUE,
      contour: { couleur: OR, epaisseur: 3 },
      onglet: { texte: ONGLET },
    });
    legende(c, LEGENDE, 1376);
    petiteLigne(c, 1440);
  },
  // L'onde sans les mots de la carte de table : seulement des cercles, plus nombreux, et la goutte.
  // La consigne ne tient pas en ligne droite dans le premier cercle : elle suit l'arc du bas.
  bapteme(c, url) {
    ondes(
      c,
      DX,
      [
        [672, 4.5],
        [716, 4],
        [772, 4],
        [826, 3.5],
        [884, 3],
      ],
      [
        [672, 4.5],
        [716, 4],
        [862, 3.5],
        [916, 3],
        [974, 3],
      ],
    );
    goutte(c, DX, -74);
    plaque(c, url, 440, { gauche: GAUCHE_PLAQUE, onglet: { texte: ONGLET } });
    legende(c, "Ouvrez votre album", 1322, 64);
    c.ctx.font = baton(c, 30, 600);
    c.ctx.fillStyle = SAPIN;
    texteCourbe(c.ctx, PETITE_LIGNE, CENTRE, 830, 638, "bas", 1);
  },
  // Une seule bougie, grande, au milieu : ce gâteau est le leur. L'onglet remplace le glaçage,
  // qu'un liseré corail rappelle, et couvre le pied de la bougie, dessinée avant lui.
  anniversaire(c, url) {
    bougie(c, {
      x: CENTRE,
      pied: 426,
      hauteur: 170,
      inclinaison: 0,
      habillage: "rayee",
      largeur: 40,
      arrondi: 7,
      meche: 14,
      flamme: 1.3,
    });
    // Le gâteau est 24 px plus haut que sur la carte de table : le pied du présentoir a grandi.
    plaque(c, url, 516, {
      gauche: GAUCHE_PLAQUE,
      contour: { couleur: SAPIN, epaisseur: 5 },
      onglet: { texte: ONGLET, lisere: CORAIL },
    });
    presentoir(c, DX, 1310);
    legende(c, LEGENDE, 1470);
    petiteLigne(c, 1530);
  },
  // Le cadre fermé : les équerres sont reliées, comme une mise au point verrouillée. L'onglet est
  // posé sur le cadre, 14 px au-dessus de la plaque.
  autre(c, url) {
    mire(c, CENTRE, 262, 2);
    plaque(c, url, 510, { gauche: GAUCHE_PLAQUE, onglet: { texte: ONGLET, leve: 14 } });
    viseur(c, DX, 510, true);
    legende(c, LEGENDE, 1420);
    petiteLigne(c, 1488);
  },
};

type OrganizerCard = {
  title: string;
  kind: string;
  url: string; // adresse de l'album privé
  revealAt: string | null;
  revealed: boolean;
};

export async function drawOrganizerCard({ title, kind, url, revealAt, revealed }: OrganizerCard) {
  const c = await nouvelleCarte(LARGEUR, HAUTEUR);
  const type = kindKey(kind);
  carton(c, title, type, texteRevelation(revealAt, revealed));
  VOLETS[type](c, url);
  // Sur ce grand format la marque est plus présente, et dit de qui vient le service, comme
  // l'en-tête du site.
  logo(c, CENTRE, 1622, 78);
  c.ctx.font = baton(c, 21);
  c.ctx.fillStyle = GRIS_SAPIN;
  texteEspace(c.ctx, "par PourUnOuiEternel", CENTRE, 1664, 1.5);
  return c.canvas;
}

// Le fichier porte le code de l'événement, jamais la clé de l'album : un nom de fichier se voit
// dans un aperçu ou un dossier partagé.
export async function downloadOrganizerPdf({ code, ...carte }: OrganizerCard & { code: string }) {
  await enregistrerPdf(await drawOrganizerCard(carte), `ouisnap-organisateurs-${code}.pdf`, {
    largeur: 210,
    hauteur: 148.5,
    places: [
      [0, 0],
      [0, 148.5],
    ],
    coupes: [[0, 148.5, 210, 148.5]],
  });
}
