// Outils de dessin communs aux cartes imprimables (cartes de table et carte des organisateurs).
// Tout est tracé sur un canevas 2D avec les polices du site : aucune image, aucune police ajoutée.
// Les coordonnées sont celles d'une carte de table (1240 × 1748 px, A6 à 300 points par pouce) ;
// les motifs prennent un décalage horizontal `dx` pour être repris sur le volet droit de la carte
// des organisateurs.
import QRCode from "qrcode";

export const SAPIN = "#1a2620";
export const OR = "#b8924a";
// L'or clair est trop pâle en petit corps : les libellés prennent l'or foncé.
export const OR_FONCE = "#7d5f24";
export const CREME = "#f5f0e6";
export const BLEU_EAU = "#7ea3ad";
export const CORAIL = "#d9605a";
export const BLANC = "#ffffff";

export const COTE_PLAQUE = 780;

export type Carte = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  serif: string;
  sans: string;
};

function famille(variable: string, repli: string) {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return valeur ? `${valeur}, ${repli}` : repli;
}

// Canevas blanc, polices du site chargées : sans cela le premier dessin partirait en police de repli.
export async function nouvelleCarte(largeur: number, hauteur: number): Promise<Carte> {
  const serif = famille("--font-cormorant", "Georgia, serif");
  const sans = famille("--font-montserrat", "Helvetica, Arial, sans-serif");
  await Promise.all(
    [`500 80px ${serif}`, `italic 500 80px ${serif}`, `500 26px ${sans}`, `600 26px ${sans}`].map((police) =>
      document.fonts.load(police),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BLANC;
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx, serif, sans };
}

export const romain = (c: Carte, corps: number) => `500 ${corps}px ${c.serif}`;
export const italique = (c: Carte, corps: number) => `italic 500 ${corps}px ${c.serif}`;
export const baton = (c: Carte, corps: number, graisse: 500 | 600 = 500) => `${graisse} ${corps}px ${c.sans}`;

type Alignement = "left" | "center";

// ---------------------------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------------------------

// Position de chaque lettre le long de la ligne. On mesure le début de la chaîne, pas la lettre
// seule, pour garder les approches de paires ; l'interlettrage est ajouté à la main, ce qui évite
// de dépendre de `letterSpacing` (absent de certains navigateurs) et centre le texte exactement.
function lettres(ctx: CanvasRenderingContext2D, texte: string, espacement: number) {
  const signes = Array.from(texte);
  const positions: { signe: string; debut: number; largeur: number }[] = [];
  let avant = 0;
  signes.forEach((signe, i) => {
    const apres = ctx.measureText(signes.slice(0, i + 1).join("")).width;
    positions.push({ signe, debut: avant + i * espacement, largeur: apres - avant });
    avant = apres;
  });
  return { positions, total: avant + Math.max(0, signes.length - 1) * espacement };
}

export function largeurEspacee(ctx: CanvasRenderingContext2D, texte: string, espacement: number) {
  return lettres(ctx, texte, espacement).total;
}

// Texte droit en lettres espacées (libellés, pastille, onglet). Police et couleur réglées avant.
export function texteEspace(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  espacement: number,
  alignement: Alignement = "center",
) {
  const { positions, total } = lettres(ctx, texte, espacement);
  const gauche = alignement === "center" ? x - total / 2 : x;
  ctx.textAlign = "left";
  for (const { signe, debut } of positions) ctx.fillText(signe, gauche + debut, y);
  return total;
}

// Texte posé lettre par lettre sur un cercle, centré au sommet (« haut », hauts de lettres vers
// l'extérieur) ou au point bas (« bas », hauts de lettres vers le centre). `rayon` est celui de
// la ligne de base. Police et couleur réglées avant.
export function texteCourbe(
  ctx: CanvasRenderingContext2D,
  texte: string,
  cx: number,
  cy: number,
  rayon: number,
  sens: "haut" | "bas",
  espacement = 0,
) {
  const { positions, total } = lettres(ctx, texte, espacement);
  ctx.textAlign = "center";
  for (const { signe, debut, largeur } of positions) {
    const angle = (debut + largeur / 2 - total / 2) / rayon;
    ctx.save();
    if (sens === "haut") {
      ctx.translate(cx + rayon * Math.sin(angle), cy - rayon * Math.cos(angle));
      ctx.rotate(angle);
    } else {
      ctx.translate(cx + rayon * Math.sin(angle), cy + rayon * Math.cos(angle));
      ctx.rotate(-angle);
    }
    ctx.fillText(signe, 0, 0);
    ctx.restore();
  }
}

// Découpe en lignes ; la largeur peut dépendre du rang de la ligne (arcs du baptême).
function couper(ctx: CanvasRenderingContext2D, texte: string, largeur: (rang: number) => number) {
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of texte.split(" ")) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ligne && ctx.measureText(essai).width > largeur(lignes.length)) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

// Raccourcit un texte mot par mot, puis lettre par lettre, jusqu'à tenir avec « … » au bout.
function tronquer(ctx: CanvasRenderingContext2D, texte: string, largeur: number) {
  const tient = (essai: string) => ctx.measureText(essai).width <= largeur;
  const net = (brut: string) => brut.replace(/[\s,;:.!?&·–—-]+$/u, "");
  const mots = texte.split(" ");
  while (mots.length > 1 && !tient(`${net(mots.join(" "))}…`)) mots.pop();
  let reste = net(mots.join(" "));
  while (reste.length > 1 && !tient(`${reste}…`)) reste = net(reste.slice(0, -1));
  return `${reste}…`;
}

// Répartit un texte sur autant de lignes qu'il y a de largeurs, en les remplissant au plus égal :
// pas de mot orphelin sur la dernière. Renvoie null si aucune coupe ne tient.
function equilibrer(ctx: CanvasRenderingContext2D, texte: string, largeurs: number[]) {
  const mots = texte.split(" ");
  let meilleur: string[] | null = null;
  let ecart = Infinity;
  const essayer = (debut: number, lignes: string[], taux: number[]) => {
    const rang = lignes.length;
    const dernier = rang === largeurs.length - 1;
    for (let fin = dernier ? mots.length : debut + 1; fin <= mots.length - (largeurs.length - 1 - rang); fin++) {
      const ligne = mots.slice(debut, fin).join(" ");
      const remplissage = ctx.measureText(ligne).width / largeurs[rang];
      if (remplissage > 1) break;
      const suite = [...taux, remplissage];
      if (!dernier) {
        essayer(fin, [...lignes, ligne], suite);
      } else if (Math.max(...suite) - Math.min(...suite) < ecart) {
        ecart = Math.max(...suite) - Math.min(...suite);
        meilleur = [...lignes, ligne];
      }
    }
  };
  if (mots.length >= largeurs.length) essayer(0, [], []);
  return meilleur as string[] | null;
}

export type RegleNom = {
  police: (corps: number) => string;
  // Hauteur de la zone réservée au nom : le bloc doit y tenir, sinon le corps diminue.
  hauteur: number;
  // Largeur offerte à une ligne ; sur un arc elle dépend du corps et du rang (baptême).
  largeur: (corps: number, lignes: 1 | 2, rang: number) => number;
  corpsMax?: number;
  corpsMaxDeuxLignes?: number;
};

const CORPS_NOM = 88;
// Sous 56 px on préfère deux lignes à une seule ligne trop petite.
const CORPS_MIN_UNE_LIGNE = 56;
// Plancher : 3 mm. En dessous on ne lit plus sur une table, on coupe par « … ».
const CORPS_PLANCHER = 36;
const INTERLIGNE_NOM = 1.2;

// Hauteur d'un bloc de nom, du haut des lettres au bas des jambages.
export const hauteurNom = (corps: number, lignes: number) => ((lignes - 1) * INTERLIGNE_NOM + 0.95) * corps;

// Lignes de base d'un nom centré verticalement sur `centre`. L'interligne suit le corps.
export function basesNom(corps: number, lignes: number, centre: number) {
  const premiere = centre - hauteurNom(corps, lignes) / 2 + 0.7 * corps;
  return Array.from({ length: lignes }, (_, rang) => premiere + rang * INTERLIGNE_NOM * corps);
}

// Règle du nom de l'événement, commune à toutes les cartes. On réduit le corps par pas de 4 px
// pour tenir sur une ligne, jusqu'à 56 px ; ensuite deux lignes équilibrées, en réduisant encore
// jusqu'au plancher ; là seulement, la seconde ligne est coupée par « … ». Jamais de troisième ligne.
export function composerNom(ctx: CanvasRenderingContext2D, nom: string, regle: RegleNom) {
  const texte = nom.replace(/\s+/gu, " ").trim();
  const tient = (ligne: string, largeur: number) => ctx.measureText(ligne).width <= largeur;
  const uneLigne = (corps: number) => {
    ctx.font = regle.police(corps);
    return hauteurNom(corps, 1) <= regle.hauteur && tient(texte, regle.largeur(corps, 1, 0));
  };
  for (let corps = regle.corpsMax ?? CORPS_NOM; corps >= CORPS_MIN_UNE_LIGNE; corps -= 4) {
    if (uneLigne(corps)) return { corps, lignes: [texte] };
  }
  const largeurs = (corps: number): [number, number] => [regle.largeur(corps, 2, 0), regle.largeur(corps, 2, 1)];
  for (let corps = regle.corpsMaxDeuxLignes ?? 62; ; corps = Math.max(CORPS_PLANCHER, corps - 4)) {
    // Un mot seul trop long pour 56 px : il peut encore tenir sur une ligne plus petite.
    if (uneLigne(corps)) return { corps, lignes: [texte] };
    if (hauteurNom(corps, 2) <= regle.hauteur) {
      const lignes = equilibrer(ctx, texte, largeurs(corps));
      if (lignes) return { corps, lignes };
    }
    if (corps === CORPS_PLANCHER) break;
  }
  const [l1, l2] = largeurs(CORPS_PLANCHER);
  const lignes = couper(ctx, texte, (rang) => (rang === 0 ? l1 : l2));
  // Un premier mot plus large que la ligne : on le coupe et on s'arrête là.
  if (!tient(lignes[0], l1)) return { corps: CORPS_PLANCHER, lignes: [tronquer(ctx, texte, l1)] };
  return { corps: CORPS_PLANCHER, lignes: [lignes[0], tronquer(ctx, lignes.slice(1).join(" "), l2)] };
}

// Nom en lignes droites, sapin, centré verticalement dans sa zone. Le bas de la zone est fixé par
// chaque carte à 50 px au moins de ce qui suit : le nom ne colle jamais au texte ou à la plaque.
export function nomDroit(
  c: Carte,
  nom: string,
  options: {
    droit?: boolean; // romain droit (carte « autre ») au lieu de l'italique
    x: number;
    alignement: Alignement;
    largeur: number;
    zone: [haut: number, bas: number];
    corpsMax?: number;
    corpsMaxDeuxLignes?: number;
  },
) {
  const { ctx } = c;
  const police = (taille: number) => (options.droit ? romain(c, taille) : italique(c, taille));
  const [haut, bas] = options.zone;
  const { corps, lignes } = composerNom(ctx, nom, {
    police,
    hauteur: bas - haut,
    largeur: () => options.largeur,
    corpsMax: options.corpsMax,
    corpsMaxDeuxLignes: options.corpsMaxDeuxLignes,
  });
  ctx.font = police(corps);
  ctx.fillStyle = SAPIN;
  ctx.textAlign = options.alignement;
  const bases = basesNom(corps, lignes.length, (haut + bas) / 2);
  lignes.forEach((ligne, rang) => ctx.fillText(ligne, options.x, bases[rang]));
}

// Texte courant en Montserrat, sapin. S'il dépasse le nombre de lignes prévu, il perd 2 px.
// Centré, ses lignes sont équilibrées.
export function paragraphe(
  c: Carte,
  texte: string,
  options: {
    x: number;
    y: number;
    interligne: number;
    largeur: number;
    alignement: Alignement;
    corps?: number;
    lignesMax?: number;
  },
) {
  const { ctx } = c;
  const corps = options.corps ?? 30;
  const largeurDe = () => options.largeur;
  ctx.font = baton(c, corps);
  let lignes = couper(ctx, texte, largeurDe);
  if (lignes.length > (options.lignesMax ?? 2)) {
    ctx.font = baton(c, corps - 2);
    lignes = couper(ctx, texte, largeurDe);
  }
  if (options.alignement === "center" && lignes.length > 1) {
    lignes = equilibrer(ctx, texte, lignes.map(largeurDe)) ?? lignes;
  }
  ctx.fillStyle = SAPIN;
  ctx.textAlign = options.alignement;
  lignes.forEach((ligne, rang) => ctx.fillText(ligne, options.x, options.y + rang * options.interligne));
}

// Ligne en Cormorant italique (accroches, légendes, date), réduite par pas de 4 px si elle dépasse.
export function accroche(
  c: Carte,
  texte: string,
  options: { x: number; y: number; corps: number; alignement?: Alignement; largeur?: number; corpsMin?: number },
) {
  const { ctx } = c;
  let corps = options.corps;
  ctx.font = italique(c, corps);
  while (options.largeur && corps > (options.corpsMin ?? 40) && ctx.measureText(texte).width > options.largeur) {
    corps -= 4;
    ctx.font = italique(c, corps);
  }
  ctx.fillStyle = SAPIN;
  ctx.textAlign = options.alignement ?? "center";
  ctx.fillText(texte, options.x, options.y);
}

// Libellé en petites capitales espacées, or foncé. Renvoie sa largeur.
export function libelle(
  c: Carte,
  texte: string,
  options: { x: number; y: number; alignement?: Alignement; corps?: number; espacement?: number },
) {
  c.ctx.font = baton(c, options.corps ?? 26, 600);
  c.ctx.fillStyle = OR_FONCE;
  return texteEspace(c.ctx, texte.toUpperCase(), options.x, options.y, options.espacement ?? 9, options.alignement);
}

// ---------------------------------------------------------------------------------------------
// Plaque du QR code et logo
// ---------------------------------------------------------------------------------------------

type Qr = {
  modules: QRCode.BitMatrix;
  // Zone centrale laissée blanche pour le logo, en modules ; absente si elle gênerait la lecture.
  cartouche: { colonne: number; rang: number; largeur: number; hauteur: number } | null;
};

// Le QR code porte « OuiSnap » en son centre : exception voulue à la règle « rien sur le QR code ».
// Pour qu'elle ne coûte rien à la lecture, le cartouche est large et bas (30 % de la largeur au
// plus, 5 modules de haut), calé sur la grille, et le code est produit au plus fort niveau de
// correction d'erreurs pour lequel le cartouche ne recouvre aucun module de fonction (repères
// d'angle, repère d'alignement, lignes de synchronisation). Les grandes versions de QR code ont
// un repère d'alignement en plein centre : on descend alors d'un niveau pour retrouver une
// version plus petite ; si rien ne convient, le code est tracé sans logo.
function coderQr(url: string): Qr {
  for (const niveau of ["H", "Q", "M"] as const) {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: niveau });
    const n = modules.size;
    if (n < 29) continue;
    let largeur = Math.floor(n * 0.3);
    if (largeur % 2 === 0) largeur -= 1;
    const hauteur = 5;
    const cartouche = { colonne: (n - largeur) / 2, rang: (n - hauteur) / 2, largeur, hauteur };
    let libre = true;
    for (let r = cartouche.rang; r < cartouche.rang + hauteur; r++) {
      for (let col = cartouche.colonne; col < cartouche.colonne + largeur; col++) {
        if (modules.reservedBit[r * n + col]) libre = false;
      }
    }
    if (libre) return { modules, cartouche };
  }
  return { modules: QRCode.create(url, { errorCorrectionLevel: "M" }).modules, cartouche: null };
}

// Modules tracés un par un, en pixels entiers, pour des bords nets à l'impression (une image
// étirée serait floue). Les modules du cartouche sont laissés blancs en entier : aucun module à
// moitié coupé. Le logo y garde un module de blanc tout autour.
function tracerQr(c: Carte, qr: Qr, x: number, y: number, pas: number) {
  const { ctx } = c;
  const { modules, cartouche } = qr;
  const dansCartouche = (rang: number, colonne: number) =>
    cartouche !== null &&
    rang >= cartouche.rang &&
    rang < cartouche.rang + cartouche.hauteur &&
    colonne >= cartouche.colonne &&
    colonne < cartouche.colonne + cartouche.largeur;
  ctx.fillStyle = SAPIN;
  for (let rang = 0; rang < modules.size; rang++) {
    for (let colonne = 0; colonne < modules.size; colonne++) {
      if (modules.get(rang, colonne) && !dansCartouche(rang, colonne)) {
        ctx.fillRect(x + colonne * pas, y + rang * pas, pas, pas);
      }
    }
  }
  if (!cartouche) return;
  // Corps le plus grand qui tienne dans le cartouche moins son module de blanc.
  ctx.font = romain(c, 100);
  const oui = ctx.measureText("Oui").width;
  ctx.font = italique(c, 100);
  const largeurLogo = (oui + ctx.measureText("Snap").width) / 100;
  const corps = Math.floor(
    Math.min(((cartouche.largeur - 2) * pas) / largeurLogo, ((cartouche.hauteur - 2) * pas) / 0.9),
  );
  const centre = y + (modules.size * pas) / 2;
  logo(c, x + (modules.size * pas) / 2, centre + 0.2 * corps, corps);
}

// Image d'un QR code seul, logo au centre, pour les vignettes de l'administration et le bouton
// « QR code seul ». Un bandeau sapin peut dire à qui il est réservé : une fois téléchargée,
// l'image du QR code privé ne doit pas pouvoir passer pour celle des invités.
export async function imageQr(url: string, bandeau?: string) {
  const qr = coderQr(url);
  const pas = 20;
  const marge = 3 * pas;
  const cote = qr.modules.size * pas + 2 * marge;
  const haut = bandeau ? 110 : 0;
  const c = await nouvelleCarte(cote, cote + haut);
  if (bandeau) {
    c.ctx.fillStyle = SAPIN;
    c.ctx.fillRect(0, 0, cote, haut);
    c.ctx.font = baton(c, 44, 600);
    c.ctx.fillStyle = BLANC;
    texteEspace(c.ctx, bandeau, cote / 2, 71, 10);
  }
  tracerQr(c, qr, marge, haut + marge, pas);
  return c.canvas.toDataURL("image/png");
}

// La plaque blanche et son QR code. Rien d'autre ne doit être dessiné dans ce carré : c'est la
// marge calme qui garantit la lecture.
export function plaque(
  c: Carte,
  url: string,
  haut: number,
  options: {
    gauche?: number;
    contour?: { couleur: string; epaisseur: number };
    // Étiquette sapin fixée au-dessus de la plaque, hors d'elle (carte des organisateurs). Elle a
    // la largeur de la plaque : même si la carte est pliée, le QR code porte sa mention.
    onglet?: { texte: string; leve?: number; lisere?: string };
  } = {},
) {
  const { ctx } = c;
  const gauche = options.gauche ?? 230;
  ctx.fillStyle = BLANC;
  ctx.fillRect(gauche, haut, COTE_PLAQUE, COTE_PLAQUE);
  if (options.contour) {
    ctx.strokeStyle = options.contour.couleur;
    ctx.lineWidth = options.contour.epaisseur;
    ctx.lineJoin = "miter";
    ctx.strokeRect(gauche, haut, COTE_PLAQUE, COTE_PLAQUE);
  }

  const qr = coderQr(url);
  const pas = Math.ceil(590 / qr.modules.size);
  const marge = Math.round((COTE_PLAQUE - pas * qr.modules.size) / 2);
  tracerQr(c, qr, gauche + marge, haut + marge, pas);

  if (options.onglet) {
    const hauteur = 96;
    const bas = haut - (options.onglet.leve ?? 0);
    const centre = gauche + COTE_PLAQUE / 2;
    ctx.fillStyle = SAPIN;
    ctx.beginPath();
    ctx.roundRect(gauche, bas - hauteur, COTE_PLAQUE, hauteur, [14, 14, 0, 0]);
    ctx.fill();
    if (options.onglet.lisere) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = options.onglet.lisere;
      ctx.fillRect(gauche, bas - hauteur, COTE_PLAQUE, 10);
      ctx.restore();
    }
    ctx.font = baton(c, 40, 600);
    ctx.fillStyle = BLANC;
    texteEspace(ctx, options.onglet.texte, centre, bas - 34 + (options.onglet.lisere ? 4 : 0), 10);
  }
}

// Signature de la maison, en pied : « Oui » droit en sapin, « Snap » italique en or, collés.
export function logo(c: Carte, centre = 620, base = 1648, corps = 60) {
  const { ctx } = c;
  ctx.font = romain(c, corps);
  const oui = ctx.measureText("Oui").width;
  ctx.font = italique(c, corps);
  const snap = ctx.measureText("Snap").width;
  const gauche = centre - (oui + snap) / 2;
  ctx.textAlign = "left";
  ctx.font = romain(c, corps);
  ctx.fillStyle = SAPIN;
  ctx.fillText("Oui", gauche, base);
  ctx.font = italique(c, corps);
  ctx.fillStyle = OR;
  ctx.fillText("Snap", gauche + oui, base);
}

// ---------------------------------------------------------------------------------------------
// Motifs
// ---------------------------------------------------------------------------------------------

function trait(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function filet(c: Carte, x1: number, y1: number, x2: number, y2: number, epaisseur: number, couleur = OR) {
  c.ctx.strokeStyle = couleur;
  c.ctx.lineWidth = epaisseur;
  c.ctx.lineCap = "butt";
  trait(c.ctx, x1, y1, x2, y2);
}

export type Anneaux = {
  a: [x: number, y: number]; // centre du premier anneau
  b: [x: number, y: number];
  exterieur: number; // rayon et épaisseur des deux bords du jonc
  interieur: number;
  traitInterieur: number;
  ruban: number; // largeur du blanc qui interrompt l'anneau passant dessous
  devantA: [x: number, y: number]; // croisement où A passe devant
  devantB: [x: number, y: number];
  cote: number; // côté du carré de retouche autour de chaque croisement
};

// Mariage. Deux alliances passées l'une dans l'autre. Chaque anneau est un jonc dessiné par ses
// deux bords : c'est ce double trait qui fait lire une alliance et non un cercle. À chaque
// croisement, l'anneau qui passe dessous est effacé par un ruban blanc qui suit l'autre.
export function alliances(c: Carte, g: Anneaux) {
  const { ctx } = c;
  const cercle = ([x, y]: [number, number], rayon: number, epaisseur: number, couleur: string) => {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.arc(x, y, rayon, 0, 2 * Math.PI);
    ctx.stroke();
  };
  const anneau = (centre: [number, number]) => {
    cercle(centre, g.exterieur, 5, OR);
    cercle(centre, g.interieur, g.traitInterieur, OR);
  };
  const autour = ([x, y]: [number, number], dessiner: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - g.cote / 2, y - g.cote / 2, g.cote, g.cote);
    ctx.clip();
    dessiner();
    ctx.restore();
  };
  const ruban = (centre: [number, number]) => cercle(centre, (g.exterieur + g.interieur) / 2, g.ruban, BLANC);

  anneau(g.b);
  autour(g.devantA, () => ruban(g.a));
  anneau(g.a);
  autour(g.devantB, () => {
    ruban(g.b);
    anneau(g.b);
  });
}

type Onde = [rayon: number, epaisseur: number];

// Baptême. Premier cercle d'or puis ondes bleues autour du centre de la plaque. Ces grands cercles
// sortent de la carte : la zone de dessin les arrête à 84 px des bords (marge non imprimable).
// Les ondes s'affinent en s'éloignant, par l'épaisseur seule : aucune transparence.
export function ondes(c: Carte, dx: number, haut: Onde[], bas: Onde[]) {
  const { ctx } = c;
  const cx = 620 + dx;
  const cy = 830;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(84 + dx, 84, 1072, 1580, 48);
  ctx.clip();
  ctx.lineCap = "butt";
  ctx.strokeStyle = OR;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 585, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = BLEU_EAU;
  const demiCercles = (liste: Onde[], debut: number) => {
    for (const [rayon, epaisseur] of liste) {
      ctx.lineWidth = epaisseur;
      ctx.beginPath();
      ctx.arc(cx, cy, rayon, debut, debut + Math.PI);
      ctx.stroke();
    }
  };
  demiCercles(haut, Math.PI);
  demiCercles(bas, 0);
  ctx.restore();
}

// Baptême. La goutte d'or qui donne la clé de lecture des cercles.
export function goutte(c: Carte, dx: number, dy = 0, echelle = 1) {
  const { ctx } = c;
  ctx.save();
  // L'échelle s'applique depuis le bas de la goutte, qui reste à sa place au-dessus de la plaque.
  ctx.translate(620 + dx, 404 + dy);
  ctx.scale(echelle, echelle);
  ctx.translate(-620, -404);
  ctx.beginPath();
  ctx.moveTo(620, 344);
  ctx.bezierCurveTo(626, 360, 640, 370, 640, 384);
  ctx.bezierCurveTo(640, 396, 631, 404, 620, 404);
  ctx.bezierCurveTo(609, 404, 600, 396, 600, 384);
  ctx.bezierCurveTo(600, 370, 614, 360, 620, 344);
  ctx.closePath();
  ctx.fillStyle = OR;
  ctx.fill();
  ctx.restore();
}

export type Bougie = {
  x: number;
  pied: number;
  hauteur: number;
  inclinaison: number; // en degrés
  habillage: "nue" | "pleine" | "rayee";
  largeur?: number;
  arrondi?: number;
  meche?: number;
  flamme?: number; // échelle de la flamme
};

// Anniversaire. Une bougie, dessinée dans un repère placé à son pied et tourné de son inclinaison.
export function bougie(c: Carte, b: Bougie) {
  const { ctx } = c;
  const largeur = b.largeur ?? 26;
  const meche = b.meche ?? 12;
  const corps = () => {
    ctx.beginPath();
    ctx.roundRect(-largeur / 2, -b.hauteur, largeur, b.hauteur, b.arrondi ?? 5);
  };
  ctx.save();
  ctx.translate(b.x, b.pied);
  ctx.rotate((b.inclinaison * Math.PI) / 180);
  corps();
  ctx.fillStyle = b.habillage === "pleine" ? OR : BLANC;
  ctx.fill();
  if (b.habillage === "rayee") {
    // Rayures à 45°, limitées au corps de la bougie.
    ctx.save();
    corps();
    ctx.clip();
    ctx.strokeStyle = OR;
    ctx.lineWidth = 6;
    ctx.lineCap = "butt";
    for (let y = -b.hauteur - largeur; y < 2 * largeur; y += 18) {
      trait(ctx, -largeur, y + largeur, largeur, y - largeur);
    }
    ctx.restore();
  }
  corps();
  ctx.strokeStyle = SAPIN;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.lineWidth = 3;
  trait(ctx, 0, -b.hauteur, 0, -b.hauteur - meche);
  ctx.translate(0, -b.hauteur - meche);
  ctx.scale(b.flamme ?? 1, b.flamme ?? 1);
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.bezierCurveTo(20, -2, 17, -28, 0, -50);
  ctx.bezierCurveTo(-17, -28, -20, -2, 0, 2);
  ctx.closePath();
  ctx.fillStyle = CORAIL;
  ctx.fill();
  ctx.restore();
}

// Anniversaire. Le présentoir à gâteau : plateau épais, pied évasé, socle large. Un pied trop
// petit ferait lire un écran sur son socle.
export function presentoir(c: Carte, dx: number, haut: number) {
  const { ctx } = c;
  const cx = 620 + dx;
  ctx.fillStyle = SAPIN;
  ctx.beginPath();
  ctx.roundRect(150 + dx, haut, 940, 16, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 60, haut + 16);
  ctx.lineTo(cx + 60, haut + 16);
  ctx.lineTo(cx + 35, haut + 76);
  ctx.lineTo(cx - 35, haut + 76);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 160, haut + 76, 320, 14, 7);
  ctx.fill();
}

// Autre événement. Les équerres du viseur, à 14 px hors de la plaque ; `ferme` les relie par un
// cadre fin (mise au point verrouillée, carte des organisateurs).
export function viseur(c: Carte, dx: number, hautPlaque: number, ferme = false) {
  const { ctx } = c;
  const gauche = 216 + dx;
  const haut = hautPlaque - 14;
  const cote = COTE_PLAQUE + 28;
  ctx.strokeStyle = SAPIN;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  if (ferme) {
    ctx.lineWidth = 4;
    ctx.strokeRect(gauche, haut, cote, cote);
  }
  ctx.lineWidth = 12;
  for (const [sx, sy] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]) {
    const x = gauche + sx * cote;
    const y = haut + sy * cote;
    ctx.beginPath();
    ctx.moveTo(x, y + (sy ? -120 : 120));
    ctx.lineTo(x, y);
    ctx.lineTo(x + (sx ? -120 : 120), y);
    ctx.stroke();
  }
}

// Autre événement. La mire : un cercle et une croix d'or.
export function mire(c: Carte, cx: number, cy: number, echelle = 1) {
  const { ctx } = c;
  ctx.strokeStyle = OR;
  ctx.lineWidth = echelle > 1 ? 4 : 3;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(cx, cy, 24 * echelle, 0, 2 * Math.PI);
  ctx.stroke();
  trait(ctx, cx - 40 * echelle, cy, cx + 40 * echelle, cy);
  trait(ctx, cx, cy - 40 * echelle, cx, cy + 40 * echelle);
}

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------

// Pose la même carte plusieurs fois sur une feuille A4 en portrait, avec ses traits de coupe.
// L'image est en PNG : du trait sur blanc s'y compresse bien, sans le halo du JPEG autour du QR code.
export async function enregistrerPdf(
  canvas: HTMLCanvasElement,
  nom: string,
  format: { largeur: number; hauteur: number; places: [number, number][]; coupes: [number, number, number, number][] },
) {
  const { jsPDF } = await import("jspdf");
  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  for (const [x, y] of format.places) {
    pdf.addImage(image, "PNG", x, y, format.largeur, format.hauteur, "carte", "FAST");
  }
  // Gris soutenu : plus clair, le trait de coupe disparaît à l'impression.
  pdf.setDrawColor(115);
  pdf.setLineWidth(0.15);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  for (const [x1, y1, x2, y2] of format.coupes) pdf.line(x1, y1, x2, y2);
  pdf.save(nom);
}
