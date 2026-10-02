import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "OuiSnap, administration",
  robots: { index: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
