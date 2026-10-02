"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { qrDataUrl } from "@/lib/qr";

function useQr(code: string) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    qrDataUrl(code)
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);
  return qr;
}

// QR code en plein écran, à présenter aux invités depuis un téléphone.
export function QrFullScreen({
  code,
  title,
  label,
  onClose,
}: {
  code: string;
  title: string;
  label: string;
  onClose?: () => void;
}) {
  const qr = useQr(code);
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-creme px-6 py-8 text-center text-sapin-900">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full border border-sapin-700/40 active:scale-95"
        >
          <X size={20} />
        </button>
      )}
      <Logo className="text-4xl" />
      <p className="libelle text-or-fonce">{label}</p>
      <p className="font-serif text-3xl italic leading-[1.15]">{title}</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt={`QR code de l'album ${title}`}
          className="aspect-square w-full max-w-[min(80vw,52dvh)] rounded-3xl border border-or bg-white"
        />
      ) : (
        <div className="aspect-square w-full max-w-[min(80vw,52dvh)] animate-pulse rounded-3xl bg-white" />
      )}
      <p className="font-serif text-3xl italic">Scannez-moi !</p>
    </div>
  );
}

// QR code en vignette : un appui l'affiche en plein écran.
export function QrCard({
  code,
  title,
  label,
  caption,
}: {
  code: string;
  title: string;
  label: string;
  caption: string;
}) {
  const qr = useQr(code);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Afficher le QR code en plein écran"
        className="flex w-full items-center gap-5 rounded-3xl bg-sapin-800 p-5 text-left active:scale-[0.99]"
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" className="size-24 shrink-0 rounded-xl bg-white" />
        ) : (
          <span className="size-24 shrink-0 animate-pulse rounded-xl bg-sapin-700" />
        )}
        <span className="flex flex-col gap-1">
          <span className="font-serif text-2xl italic">QR code des invités</span>
          <span className="text-sm leading-relaxed text-brume">{caption}</span>
        </span>
      </button>
      {open && <QrFullScreen code={code} title={title} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}
