// PDF à imprimer pour les tables : une page A4 portant quatre cartes A6 identiques, à découper.
// La carte est dessinée sur un canevas (avec les polices du site), puis posée dans le PDF.
import QRCode from "qrcode";

// Carte A6 (105 x 148 mm) à 300 points par pouce.
const WIDTH = 1240;
const HEIGHT = 1748;

const SAPIN = "#1a2620";
const OR = "#b8924a";
const CREME = "#f5f0e6";

function fontFamily(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

// Découpe un texte en lignes qui tiennent dans la largeur donnée.
function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const attempt = line ? `${line} ${word}` : word;
    if (line && context.measureText(attempt).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function drawCard(title: string, albumLabel: string, url: string) {
  const serif = fontFamily("--font-cormorant", "Georgia, serif");
  const sans = fontFamily("--font-montserrat", "Helvetica, Arial, sans-serif");
  await Promise.all(
    [`500 100px ${serif}`, `italic 500 100px ${serif}`, `500 40px ${sans}`].map((font) =>
      document.fonts.load(font),
    ),
  );

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;
  const center = WIDTH / 2;

  context.fillStyle = CREME;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.strokeStyle = OR;
  context.lineWidth = 4;
  context.strokeRect(60, 60, WIDTH - 120, HEIGHT - 120);

  // Logo : « Oui » droit, « Snap » en italique doré.
  context.textBaseline = "alphabetic";
  context.font = `500 150px ${serif}`;
  const oui = context.measureText("Oui").width;
  context.font = `italic 500 150px ${serif}`;
  const snap = context.measureText("Snap").width;
  const logoLeft = center - (oui + snap) / 2;
  context.textAlign = "left";
  context.font = `500 150px ${serif}`;
  context.fillStyle = SAPIN;
  context.fillText("Oui", logoLeft, 290);
  context.font = `italic 500 150px ${serif}`;
  context.fillStyle = OR;
  context.fillText("Snap", logoLeft + oui, 290);

  context.textAlign = "center";
  context.fillStyle = OR;
  context.font = `500 34px ${sans}`;
  context.letterSpacing = "9px";
  context.fillText(albumLabel.toUpperCase(), center, 385);
  context.letterSpacing = "0px";

  // Nom de l'événement : la taille diminue jusqu'à tenir sur deux lignes au plus.
  context.fillStyle = SAPIN;
  let size = 92;
  let lines: string[] = [];
  do {
    context.font = `italic 500 ${size}px ${serif}`;
    lines = wrap(context, title, WIDTH - 260);
    size -= 6;
  } while (lines.length > 2 && size > 40);
  const lineHeight = (size + 6) * 1.12;
  lines.slice(0, 2).forEach((line, index) => {
    context.fillText(line, center, 510 + index * lineHeight);
  });

  // QR code sur fond blanc, pour rester lisible par tous les téléphones.
  const side = 660;
  const top = 700;
  const pad = 44;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(center - side / 2 - pad, top - pad, side + pad * 2, side + pad * 2, 36);
  context.fill();
  context.strokeStyle = OR;
  context.lineWidth = 3;
  context.stroke();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, { width: side, margin: 0, color: { dark: SAPIN, light: "#ffffff" } });
  context.drawImage(qr, center - side / 2, top, side, side);

  context.fillStyle = SAPIN;
  context.font = `italic 500 84px ${serif}`;
  context.fillText("Scannez-moi !", center, 1525);

  context.font = `500 31px ${sans}`;
  wrap(
    context,
    "Visez le QR code avec l'appareil photo de votre téléphone et partagez vos photos.",
    WIDTH - 300,
  ).forEach((line, index) => {
    context.fillText(line, center, 1595 + index * 44);
  });

  return canvas;
}

export async function downloadTablePdf({
  title,
  albumLabel,
  url,
  code,
}: {
  title: string;
  albumLabel: string;
  url: string;
  code: string;
}) {
  const [{ jsPDF }, card] = await Promise.all([import("jspdf"), drawCard(title, albumLabel, url)]);
  const image = card.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Quatre cartes A6 : deux colonnes, deux rangées.
  for (const [x, y] of [
    [0, 0],
    [105, 0],
    [0, 148.5],
    [105, 148.5],
  ]) {
    pdf.addImage(image, "JPEG", x, y, 105, 148.5, "carte", "FAST");
  }
  // Traits de coupe.
  pdf.setDrawColor(170);
  pdf.setLineWidth(0.1);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  pdf.line(105, 0, 105, 297);
  pdf.line(0, 148.5, 210, 148.5);

  pdf.save(`ouisnap-tables-${code}.pdf`);
}
