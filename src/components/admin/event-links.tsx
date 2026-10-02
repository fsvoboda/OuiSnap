"use client";

import { Check, Copy, DownloadSimple, FilePdf } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { kindOf } from "@/lib/kinds";
import { downloadTablePdf } from "@/lib/table-card";
import { buttonClass, type AdminEvent } from "./types";

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste sélectionnable à la main.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="libelle text-brume">{label}</p>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate rounded-xl bg-sapin-950/60 px-4 py-3 text-sm select-all">
          {url}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copier : ${label}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-creme/30 active:scale-95"
        >
          {copied ? <Check size={18} className="text-or-clair" /> : <Copy size={18} />}
        </button>
      </div>
    </div>
  );
}

// QR code, PDF des tables et lien privé de l'album pour un événement.
export function EventLinks({ event }: { event: AdminEvent }) {
  const origin = window.location.origin;
  const guestUrl = `${origin}/e/?c=${event.code}`;
  const [qr, setQr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState(false);

  async function printCards() {
    setPrinting(true);
    setPrintError(false);
    try {
      await downloadTablePdf({
        title: event.title,
        albumLabel: kindOf(event.kind).album,
        url: guestUrl,
        code: event.code,
      });
    } catch {
      setPrintError(true);
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(guestUrl, { width: 900, margin: 2, color: { dark: "#1a2620", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [guestUrl]);

  return (
    <div className="grid gap-6 border-t border-creme/15 pt-5 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-start gap-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code de l'album ${event.title}`} className="size-44 rounded-xl" />
        ) : (
          <div className="size-44 animate-pulse rounded-xl bg-sapin-700" />
        )}
        <button
          type="button"
          onClick={printCards}
          disabled={printing}
          className={`${buttonClass} bg-or text-sapin-950`}
        >
          <FilePdf size={18} weight="bold" />
          {printing ? "Préparation…" : "PDF pour les tables"}
        </button>
        {printError && (
          <p role="alert" className="max-w-44 text-sm text-[#f0a39e]">
            Le PDF n&apos;a pas pu être créé. Réessayez.
          </p>
        )}
        {qr && (
          <a
            href={qr}
            download={`ouisnap-qr-${event.code}.png`}
            className={`${buttonClass} border border-creme/30`}
          >
            <DownloadSimple size={18} />
            QR code seul
          </a>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <p className="text-sm leading-relaxed text-brume">
          Le PDF contient quatre cartes par page A4, à imprimer et à découper pour les tables.
        </p>
        <CopyRow label="Lien des invités (celui du QR code)" url={guestUrl} />
        {event.albumKey && (
          <CopyRow label="Lien privé de l'album (pour les organisateurs)" url={`${origin}/album/?k=${event.albumKey}`} />
        )}
      </div>
    </div>
  );
}
