"use client";

import { ArrowSquareOut, Check, Copy, DownloadSimple, FilePdf, LockKey, QrCode } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { downloadOrganizerPdf } from "@/lib/organizer-card";
import { imageQr } from "@/lib/card-kit";
import { albumUrl, guestUrl as guestUrlOf } from "@/lib/qr";
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
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir dans un nouvel onglet : ${label}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-creme/30 active:scale-95"
        >
          <ArrowSquareOut size={18} />
        </a>
      </div>
    </div>
  );
}

// Un QR code avec ses deux téléchargements (PDF à imprimer, image seule). Les deux cases se
// ressemblent exprès, sauf par leur titre et leur liseré : on ne doit pas imprimer l'une pour l'autre.
function QrCase({
  title,
  hint,
  url,
  alt,
  imageName,
  imageLabel,
  pdfLabel,
  onPdf,
  isPrivate = false,
}: {
  title: string;
  hint: string;
  url: string;
  alt: string;
  imageName: string;
  imageLabel: string;
  pdfLabel: string;
  onPdf: () => Promise<void>;
  isPrivate?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    imageQr(url, isPrivate ? "ALBUM PRIVÉ" : undefined)
      .then((image) => {
        if (!cancelled) setQr(image);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, isPrivate]);

  async function print() {
    setPrinting(true);
    setPrintError(false);
    try {
      await onPdf();
    } catch {
      setPrintError(true);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <section
      className={`flex min-w-0 flex-col gap-4 rounded-2xl border p-4 ${
        isPrivate ? "border-or/70 bg-sapin-950/40" : "border-creme/20"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <h3 className={`flex items-start gap-2 text-sm font-semibold ${isPrivate ? "text-or-clair" : "text-creme"}`}>
          {isPrivate ? (
            <LockKey size={18} weight="bold" className="mt-0.5 shrink-0" />
          ) : (
            <QrCode size={18} weight="bold" className="mt-0.5 shrink-0" />
          )}
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-brume">{hint}</p>
      </div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={alt} className="w-40 rounded-xl" />
      ) : (
        <div className={`w-40 animate-pulse rounded-xl bg-sapin-700 ${isPrivate ? "h-[11.7rem]" : "h-40"}`} />
      )}
      <div className="flex flex-wrap gap-3">
        {/* Une seule action dominante, celle des tables : le PDF privé reste en contour. */}
        <button
          type="button"
          onClick={print}
          disabled={printing}
          className={`${buttonClass} ${isPrivate ? "border border-or text-or-clair" : "bg-or text-sapin-950"}`}
        >
          <FilePdf size={18} weight="bold" />
          {printing ? "Préparation…" : pdfLabel}
        </button>
        {qr && (
          <a href={qr} download={imageName} className={`${buttonClass} border border-creme/30`}>
            <DownloadSimple size={18} />
            {imageLabel}
          </a>
        )}
      </div>
      {printError && (
        <p role="alert" className="text-sm text-[#f0a39e]">
          Le PDF n&apos;a pas pu être créé. Réessayez.
        </p>
      )}
    </section>
  );
}

// QR codes, PDF à imprimer et liens d'un événement : ce qui va aux invités, et ce qui reste aux organisateurs.
export function EventLinks({ event }: { event: AdminEvent }) {
  const guestUrl = guestUrlOf(event.code);
  const privateUrl = event.albumKey ? albumUrl(event.albumKey) : null;

  return (
    <div className="flex flex-col gap-6 border-t border-creme/15 pt-5">
      <div className="grid gap-4 md:grid-cols-2">
        <QrCase
          title="QR code des invités"
          hint="À poser sur les tables : les invités le scannent pour photographier. Le PDF contient quatre cartes par page A4, à découper."
          url={guestUrl}
          alt={`QR code des invités de l'album ${event.title}`}
          imageName={`ouisnap-qr-${event.code}.png`}
          imageLabel="QR code des invités seul"
          pdfLabel="PDF pour les tables"
          onPdf={() => downloadTablePdf({ title: event.title, kind: event.kind, url: guestUrl, code: event.code })}
        />
        {privateUrl && (
          <QrCase
            isPrivate
            title="QR code des organisateurs (album privé)"
            hint="À remettre en main propre, jamais sur les tables : il ouvre l'album privé. Le PDF contient deux cartes par page A4."
            url={privateUrl}
            alt={`QR code des organisateurs, album privé ${event.title}`}
            // Le fichier porte le code de l'événement, jamais la clé de l'album.
            imageName={`ouisnap-qr-organisateurs-${event.code}.png`}
            imageLabel="QR code privé seul"
            pdfLabel="PDF des organisateurs"
            onPdf={() =>
              downloadOrganizerPdf({
                title: event.title,
                kind: event.kind,
                url: privateUrl,
                code: event.code,
                revealAt: event.revealAt,
                revealed: event.revealed,
              })
            }
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <CopyRow label="Lien des invités (celui du QR code des invités)" url={guestUrl} />
        {privateUrl && <CopyRow label="Lien privé de l'album (pour les organisateurs)" url={privateUrl} />}
      </div>
    </div>
  );
}
