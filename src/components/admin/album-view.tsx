"use client";

import { ArrowLeft, CaretLeft, CaretRight, Trash, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { LazyThumb, ZoomablePhoto } from "@/components/photo-view";
import { api, ApiError } from "@/lib/api";
import { buttonClass, type AdminEvent } from "./types";

type Photo = { id: number; width: number; height: number; guest: number; name: string };

// Toutes les photos d'un album, consultables et supprimables à tout moment par l'administrateur.
export function AlbumView({ event, onBack }: { event: AdminEvent; onBack: () => void }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null); // rang de la photo agrandie
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ photos: Photo[] }>("admin-album", { id: String(event.id) })
      .then((result) => {
        if (!cancelled) setPhotos(result.photos);
      })
      .catch((reason: ApiError) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  function show(index: number | null) {
    setOpen(index);
    setConfirming(false);
  }

  async function remove(photo: Photo) {
    setDeleting(true);
    try {
      await api("admin-photo-delete", { id: String(photo.id) });
      const rest = (photos ?? []).filter((item) => item.id !== photo.id);
      setPhotos(rest);
      // On reste sur la photo suivante, ou on ferme s'il n'en reste plus.
      show(rest.length === 0 ? null : Math.min(open ?? 0, rest.length - 1));
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setDeleting(false);
    }
  }

  const list = photos ?? [];
  const groups: { guest: number; name: string; start: number; photos: Photo[] }[] = [];
  list.forEach((photo, index) => {
    const last = groups[groups.length - 1];
    if (last?.guest === photo.guest) last.photos.push(photo);
    else groups.push({ guest: photo.guest, name: photo.name, start: index, photos: [photo] });
  });
  const current = open === null ? null : list[open];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste des événements"
          className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-serif text-4xl leading-[1.1]">{event.title}</h2>
          <p className="text-sm text-brume">
            {photos === null
              ? "Chargement des photos"
              : `${list.length} photo${list.length > 1 ? "s" : ""}, ${groups.length} photographe${groups.length > 1 ? "s" : ""}`}
            {event.revealed ? "" : " (pas encore révélé)"}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#f0a39e]">
          {error}
        </p>
      )}

      {photos?.length === 0 && (
        <p className="py-10 text-center font-serif text-2xl italic">
          Aucune photo dans cet album pour l&apos;instant.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.guest} className="flex flex-col gap-3">
          <h3 className="flex items-baseline justify-between gap-4 border-b border-creme/15 pb-2">
            <span className="font-serif text-2xl">{group.name}</span>
            <span className="text-sm tabular-nums text-or-clair">
              {group.photos.length} photo{group.photos.length > 1 ? "s" : ""}
            </span>
          </h3>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">
            {group.photos.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => show(group.start + index)}
                  aria-label={`Agrandir la photo de ${photo.name}`}
                  className="block aspect-square w-full overflow-hidden rounded-lg active:scale-[0.98]"
                >
                  <LazyThumb endpoint="admin-photo" token="" id={photo.id} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Photo de ${current.name}`}
          className="fixed inset-0 z-10 flex touch-none flex-col bg-sapin-950"
        >
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="font-serif text-2xl italic">{current.name}</p>
            <button
              type="button"
              onClick={() => show(null)}
              aria-label="Fermer"
              className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 px-3">
            <ZoomablePhoto key={current.id} endpoint="admin-photo" token="" id={current.id} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 p-4">
            <button
              type="button"
              onClick={() => show(open - 1)}
              disabled={open === 0}
              aria-label="Photo précédente"
              className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95 disabled:opacity-30"
            >
              <CaretLeft size={20} />
            </button>
            <p className="min-w-20 text-center text-sm tabular-nums text-brume">
              {open + 1} sur {list.length}
            </p>
            <button
              type="button"
              onClick={() => show(open + 1)}
              disabled={open === list.length - 1}
              aria-label="Photo suivante"
              className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95 disabled:opacity-30"
            >
              <CaretRight size={20} />
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => (confirming ? remove(current) : setConfirming(true))}
              className={`${buttonClass} ${confirming ? "bg-corail text-sapin-950" : "border border-creme/30"}`}
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
