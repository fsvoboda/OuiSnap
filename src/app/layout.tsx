import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

// Adresse de production. À changer ici, et dans OVH_SITE_URL de .env.deploy, si le site déménage.
const SITE_URL = "https://ouisnap.pourunouieternel.fr";
const DESCRIPTION =
  "Vos invités scannent un QR code et photographient toute la journée : vous recevez toutes leurs photos dans un album surprise. Un service de PourUnOuiEternel.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "OuiSnap, l'appli de vos invités",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Aperçu affiché quand le lien du site est partagé (messageries, réseaux sociaux).
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "OuiSnap",
    title: "OuiSnap, l'appli de vos invités",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/media/ouisnap-teaser-poster.jpg", width: 720, height: 1280 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2620",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${cormorant.variable} ${montserrat.variable} antialiased`}
    >
      <body className="min-h-[100dvh] font-sans">
        {children}
      </body>
    </html>
  );
}
