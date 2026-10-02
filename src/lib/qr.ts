// QR code des invités : il ouvre /e/?c=CODE sur le site courant.
import QRCode from "qrcode";
import { api } from "@/lib/api";

export const guestUrl = (code: string) => `${window.location.origin}/e/?c=${code}`;

export function qrDataUrl(code: string, width = 900) {
  return QRCode.toDataURL(guestUrl(code), {
    width,
    margin: 2,
    color: { dark: "#1a2620", light: "#ffffff" },
  });
}

// Les e-mails ne peuvent afficher qu'une image hébergée : l'administration dépose
// donc sur le serveur l'image du QR code de chaque événement.
export async function uploadEventQr(id: number, code: string) {
  const image = await (await fetch(await qrDataUrl(code, 600))).blob();
  await api("admin-event-qr", { id: String(id), qr: image });
}
