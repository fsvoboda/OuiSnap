"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { QrFullScreen } from "@/components/qr-card";
import { api, ApiError, type EventInfo } from "@/lib/api";
import { kindOf } from "@/lib/kinds";

export function QrPage() {
  const [found, setFound] = useState<{ code: string; event: EventInfo } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const code = (new URLSearchParams(window.location.search).get("c") ?? "").toUpperCase();
      try {
        const result = await api<{ event: EventInfo }>("join", { code });
        if (!cancelled) setFound({ code, event: result.event });
      } catch (reason) {
        if (!cancelled) setProblem((reason as ApiError).message);
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  if (found) {
    return <QrFullScreen code={found.code} title={found.event.title} label={kindOf(found.event.kind).album} />;
  }
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-8 text-center">
      <Logo className="text-4xl" />
      <p role={problem ? "alert" : "status"} className="max-w-[28ch] font-serif text-2xl italic">
        {problem ?? "Chargement du QR code"}
      </p>
    </main>
  );
}
