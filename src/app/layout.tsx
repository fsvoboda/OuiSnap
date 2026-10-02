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

export const metadata: Metadata = {
  title: "OuiSnap, l'appli de vos invités",
  description:
    "Vos invités scannent un QR code, photographient toute la journée, et les mariés reçoivent tout. Lancement fin 2026.",
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
        {/* Liseré doré du teaser, fixe au-dessus de la page. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-2 z-40 rounded-sm border border-or/35 md:inset-4"
        />
      </body>
    </html>
  );
}
