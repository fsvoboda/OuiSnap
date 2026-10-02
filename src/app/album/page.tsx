import type { Metadata, Viewport } from "next";
import { AlbumApp } from "@/components/album/album-app";

export const metadata: Metadata = {
  title: "OuiSnap, votre album",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#1a2620",
  viewportFit: "cover",
};

// Page des mariés, ouverte par leur lien privé : /album/?k=CLÉ
export default function AlbumPage() {
  return <AlbumApp />;
}
