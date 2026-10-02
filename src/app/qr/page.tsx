import type { Metadata, Viewport } from "next";
import { QrPage } from "@/components/qr-page";

export const metadata: Metadata = {
  title: "OuiSnap, QR code de l'album",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f0e6",
  viewportFit: "cover",
};

// QR code d'un album en plein écran, ouvert depuis les e-mails : /qr/?c=CODE
export default function Page() {
  return <QrPage />;
}
