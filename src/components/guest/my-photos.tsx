"use client";

import { ArrowLeft, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, fetchPhoto } from "@/lib/api";
import { usePinch } from "@/lib/pinch";

type Photo = { id: number; width: number; height: number };

// Image protégée : chargée avec le jeton de l'invité, puis affichée depuis la mémoire.
function PhotoImage({
  token,
  id,
  size,
  className,
}: {
  token: string;
  id: number;
  size: "thumb" | "full";
  className: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchPhoto(token, id, size)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, id, size]);

  if (!url) return <div className={`animate-pulse bg-sapin-800 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}

// Photo agrandie : pincer pour zoomer, glisser pour se déplacer dans l'image.
function ZoomablePhoto({ token, id }: { token: string; id: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const base = useRef(1);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  // Garde l'image dans le cadre : on ne peut pas la faire glisser hors de l'écran.
  function clamp(scale: number, x: number, y: number) {
    const maxX = ((frame.current?.clientWidth ?? 0) * (scale - 1)) / 2;
    const maxY = ((frame.current?.clientHeight ?? 0) * (scale - 1)) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  const pinch = usePinch({
    start: () => (base.current = view.scale),
    pinch: (ratio) =>
      setView((current) => clamp(Math.min(5, Math.max(1, base.current * ratio)), current.x, current.y)),
    pan: (dx, dy) => setView((current) => clamp(current.scale, current.x + dx, current.y + dy)),
  });

  return (
    <div ref={frame} className="h-full w-full touch-none overflow-hidden rounded-lg" {...pinch}>
      <div
        className="h-full w-full"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <PhotoImage token={token} id={id} size="full" className="h-full w-full object-contain" />
      </div>
    </div>
  );
}

export function MyPhotos({
  token,
  onBack,
  onCount,
}: {
  token: string;
  onBack: () => void;
  onCount: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ photos: Photo[]; count: number }>("photos", { token })
      .then((result) => {
        if (cancelled) return;
        setPhotos(result.photos);
        onCount(result.count);
      })
      .catch((reason: ApiError) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onCount]);

  function close() {
    setOpen(null);
    setConfirming(false);
  }

  async function remove(photo: Photo) {
    setDeleting(true);
    try {
      const result = await api<{ count: number }>("delete", { token, id: String(photo.id) });
      setPhotos((list) => list?.filter((item) => item.id !== photo.id) ?? null);
      onCount(result.count);
      close();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col bg-sapin-900 px-4 pb-10 text-creme">
      <header className="flex items-center gap-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à l'appareil photo"
          className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif text-3xl">
          Mes <em className="text-or">photos</em>
        </h1>
      </header>

      {error && (
        <p role="alert" className="mb-4 text-sm text-[#f0a39e]">
          {error}
        </p>
      )}

      {photos === null && !error && (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="aspect-square animate-pulse rounded-lg bg-sapin-800" />
          ))}
        </div>
      )}

      {photos?.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-2xl italic">Aucune photo pour l&apos;instant.</p>
          <p className="text-sm text-brume">Votre première photo apparaîtra ici.</p>
        </div>
      )}

      {photos && photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpen(photo)}
                aria-label="Agrandir la photo"
                className="block aspect-square w-full overflow-hidden rounded-lg active:scale-[0.98]"
              >
                <PhotoImage token={token} id={photo.id} size="thumb" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal
          aria-label="Photo agrandie"
          className="fixed inset-0 z-10 flex touch-none flex-col bg-sapin-950"
        >
          <div className="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 px-4">
            <ZoomablePhoto key={open.id} token={token} id={open.id} />
          </div>
          <div className="flex justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={deleting}
              onClick={() => (confirming ? remove(open) : setConfirming(true))}
              className={`flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold active:scale-[0.98] disabled:opacity-60 ${confirming ? "bg-corail text-sapin-950" : "border border-creme/30"}`}
            >
              <Trash size={18} />
              {deleting ? "Suppression…" : confirming ? "Confirmer la suppression" : "Supprimer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
