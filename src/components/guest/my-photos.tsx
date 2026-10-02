"use client";

import { ArrowLeft, Heart, Trash, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { PhotoImage, ZoomablePhoto } from "@/components/photo-view";
import { api, ApiError } from "@/lib/api";

type Photo = { id: number; width: number; height: number; liked: boolean };

export function MyPhotos({
  token,
  readOnly = false,
  onBack,
  onCount,
}: {
  token: string;
  readOnly?: boolean; // album dévoilé : plus de retour à l'appareil photo ni de suppression
  onBack?: () => void;
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
      const result = await api<{ count: number }>("delete", {
        token,
        id: String(photo.id),
      });
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
        {!readOnly && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour à l'appareil photo"
            className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="font-serif text-3xl">
          Mes <em className="text-or">photos</em>
        </h1>
      </header>

      {readOnly && (
        <p className="mb-5 rounded-2xl bg-sapin-800 px-5 py-4 text-sm leading-relaxed text-brume">
          L&apos;album a été dévoilé. Il n&apos;est plus possible d&apos;ajouter ou de supprimer des photos.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-[#f0a39e]">
          {error}
        </p>
      )}

      {photos === null && !error && (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-lg bg-sapin-800"
            />
          ))}
        </div>
      )}

      {photos?.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-2xl italic">
            Aucune photo pour l&apos;instant.
          </p>
          {!readOnly && (
            <p className="text-sm text-brume">
              Votre première photo apparaîtra ici.
            </p>
          )}
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
                className="relative block aspect-square w-full overflow-hidden rounded-lg active:scale-[0.98]"
              >
                <PhotoImage
                  endpoint="photo"
                  token={token}
                  id={photo.id}
                  size="thumb"
                  className="h-full w-full object-cover"
                />
                {photo.liked && (
                  <Heart
                    size={22}
                    weight="fill"
                    aria-label="Coup de cœur"
                    className="absolute bottom-1.5 right-1.5 text-corail drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                  />
                )}
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
            <ZoomablePhoto
              key={open.id}
              endpoint="photo"
              token={token}
              id={open.id}
            />
          </div>
          <div className="flex min-h-12 flex-col items-center gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {open.liked && (
              <p className="flex items-center gap-2 font-serif text-xl italic text-creme">
                <Heart size={22} weight="fill" className="text-corail" />
                Coup de cœur pour cette photo
              </p>
            )}
            {!readOnly && (
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  confirming ? remove(open) : setConfirming(true)
                }
                className={`flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold active:scale-[0.98] disabled:opacity-60 ${confirming ? "bg-corail text-sapin-950" : "border border-creme/30"}`}
              >
                <Trash size={18} />
                {deleting
                  ? "Suppression…"
                  : confirming
                    ? "Confirmer la suppression"
                    : "Supprimer"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
