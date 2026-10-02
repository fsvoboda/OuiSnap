import type { Metadata, Viewport } from "next";
import { GuestApp } from "@/components/guest/guest-app";

export const metadata: Metadata = {
  title: "OuiSnap, l'album des mariés",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#121a16",
  viewportFit: "cover",
};

// Page ouverte par le QR code : /e/?c=CODE
export default function GuestPage() {
  return <GuestApp />;
}
