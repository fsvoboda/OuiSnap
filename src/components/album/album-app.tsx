"use client";

import { CaretLeft, CaretRight, DownloadSimple, Heart, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { LazyThumb, ZoomablePhoto } from "@/components/photo-view";
import { QrCard } from "@/components/qr-card";
import { api, ApiError } from "@/lib/api";
import { kindOf } from "@/lib/kinds";

type Photo = { id: number; width: number; height: number; guest: number; name: string; liked: boolean };
type Album = {
  title: string;
  kind: string;
  code: string;
  revealAt: string | null;
  revealed: boolean;
  closesAt?: string | null; // dernier jour d'accès à l'album
  deletesAt?: string | null; // suppression automatique, seulement si elle est à moins de trente jours
  total: number;
  guests: { name: string; count: number }[];
  photos?: Photo[];
};

const REFRESH_MS = 30_000;
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

// « 12 avril 2027 », en heure de Paris.
const longDay = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

// Horloge à la seconde pour le compte à rebours.
function subscribeSeconds(notify: () => void) {
  const timer = setInterval(notify, 1000);
  return () => clearInterval(timer);
}
const readSeconds = () => Math.floor(Date.now() / 1000);

function Countdown({ until, onDone }: { until: number; onDone: () => void }) {
  const now = useSyncExternalStore(subscribeSeconds, readSeconds, () => 0);
  const left = Math.max(0, until - now);
  const done = now > 0 && left === 0;

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  if (now === 0) return <div className="h-20" />;
  const parts = [
    { value: Math.floor(left / 86400), label: "jours" },
    { value: Math.floor((left % 86400) / 3600), label: "heures" },
    { value: Math.floor((left % 3600) / 60), label: "minutes" },
    { value: left % 60, label: "secondes" },
  ];
  return (
    <div role="timer" className="grid grid-cols-4 gap-2">
      {parts.map(({ value, label }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="font-serif text-5xl leading-none tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-sapin-700">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AlbumApp() {
  const [token, setToken] = useState("");
  const [album, setAlbum] = useState<Album | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null); // rang de la photo agrandie

  const load = useCallback(async () => {
    const key = new URLSearchParams(window.location.search).get("k") ?? "";
    try {
      const result = await api<Album>("album", { token: key });
      setToken(key);
      setAlbum(result);
      setProblem(null);
    } catch (reason) {
      const error = reason as ApiError;
      // Coupure passagère : on garde l'affichage en place, le prochain rafraîchissement réessaiera.
      setAlbum((current) => {
        if (!current || !error.temporary) setProblem(error.message);
        return current;
      });
    }
  }, []);

  // Avant la révélation, les compteurs se rafraîchissent tout seuls pendant la fête.
  const waiting = album !== null && !album.revealed;
  useEffect(() => {
    const first = setTimeout(load, 0);
    if (!waiting) return () => clearTimeout(first);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, waiting]);

  // Coup de cœur : affiché tout de suite, annulé si le serveur refuse.
  async function toggleLike(photo: Photo) {
    const setLiked = (liked: boolean) =>
      setAlbum((current) =>
        current && {
          ...current,
          photos: current.photos?.map((item) => (item.id === photo.id ? { ...item, liked } : item)),
        },
      );
    setLiked(!photo.liked);
    try {
      await api("album-like", { token, id: String(photo.id), liked: photo.liked ? "0" : "1" });
    } catch {
      setLiked(photo.liked);
    }
  }

  if (problem) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-8 text-center">
        <Logo className="text-4xl" />
        <p role="alert" className="max-w-[30ch] font-serif text-2xl italic">
          {problem}
        </p>
      </main>
    );
  }

  if (!album) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4">
        <Logo className="text-4xl" />
        <p role="status" className="libelle animate-pulse text-brume">
          Ouverture de l&apos;album
        </p>
      </main>
    );
  }

  const header = (
    <header className="flex flex-col items-center gap-3 pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
      <Logo className="text-3xl" />
      <p className="libelle text-or-clair">{kindOf(album.kind).album}</p>
      <h1 className="pb-1 font-serif text-5xl leading-[1.1] md:text-6xl">{album.title}</h1>
    </header>
  );

  if (!album.revealed) {
    const revealDate = album.revealAt ? new Date(album.revealAt) : null;
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col gap-10 px-5 pb-16">
        {header}

        <section className="flex flex-col items-center gap-6 rounded-3xl bg-creme px-6 py-8 text-center text-sapin-900">
          {revealDate ? (
            <>
              <p className="font-serif text-2xl italic leading-snug">
                Votre album se dévoile
                <br />
                {revealDate.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Paris",
                })}{" "}
                à{" "}
                {revealDate.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Paris",
                })}
              </p>
              <Countdown until={Math.floor(revealDate.getTime() / 1000)} onDone={load} />
            </>
          ) : (
            <p className="font-serif text-2xl italic leading-snug">
              La date de révélation de votre album n&apos;est pas encore fixée.
            </p>
          )}
          <p className="max-w-[36ch] text-sm leading-relaxed text-sapin-700">
            D&apos;ici là, les photos restent une surprise. Vous pouvez seulement
            voir qui photographie.
          </p>
        </section>

        <QrCard
          code={album.code}
          title={album.title}
          label={kindOf(album.kind).album}
          caption="Touchez pour l'afficher en plein écran et le faire scanner à vos invités."
        />

        <section className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 border-b border-creme/15 pb-5">
            <div className="flex items-center gap-4">
              <Heart size={34} weight="fill" className="text-corail" />
              <p className="font-serif text-6xl leading-none tabular-nums">{album.total}</p>
            </div>
            <p className="libelle pb-1 text-right text-brume">
              {album.total > 1 ? "photos reçues" : "photo reçue"}
              <br />
              {plural(album.guests.length, "invité")}
            </p>
          </div>

          {album.guests.length === 0 ? (
            <p className="py-6 text-center leading-relaxed text-brume">
              Aucune photo pour l&apos;instant. Les premières arriveront dès que vos
              invités scanneront le QR code.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {album.guests.map((guest, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-2xl">{guest.name}</span>
                  <span className="text-sm tabular-nums text-or-clair">
                    {plural(guest.count, "photo")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  // Les photos arrivent déjà rangées par invité : on découpe la liste en un groupe par invité.
  const photos = album.photos ?? [];
  const groups: { guest: number; name: string; start: number; photos: Photo[] }[] = [];
  photos.forEach((photo, index) => {
    const last = groups[groups.length - 1];
    if (last?.guest === photo.guest) last.photos.push(photo);
    else groups.push({ guest: photo.guest, name: photo.name, start: index, photos: [photo] });
  });
  const current = open === null ? null : photos[open];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-8 px-3 pb-16 md:px-8">
      {header}

      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-brume">
          {plural(album.total, "photo")}, {plural(album.guests.length, "invité")}
        </p>
        {album.deletesAt && (
          <p role="note" className="max-w-[44ch] text-sm leading-relaxed text-or-clair">
            {album.closesAt && longDay(album.closesAt) !== longDay(album.deletesAt)
              ? `Cet album reste accessible jusqu'au ${longDay(album.closesAt)}, puis sera supprimé le ${longDay(album.deletesAt)}.`
              : `Cet album sera supprimé le ${longDay(album.deletesAt)}.`}{" "}
            Pensez à télécharger vos photos.
          </p>
        )}
        {photos.length > 0 && (
          // Envoi de formulaire classique : le navigateur télécharge l'archive sans la charger en mémoire.
          <form method="post" action="/api/album-zip.php">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="flex h-13 items-center gap-3 rounded-full bg-or px-7 text-sm font-semibold text-sapin-950 transition-[transform,background-color] hover:bg-or-clair active:scale-[0.98]"
            >
              <DownloadSimple size={20} weight="bold" />
              Tout télécharger
            </button>
          </form>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="py-10 text-center font-serif text-2xl italic">
          Aucune photo n&apos;a été envoyée pour cet événement.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.guest} className="flex flex-col gap-3">
              <h2 className="flex items-baseline justify-between gap-4 border-b border-creme/15 px-1 pb-2">
                <span className="font-serif text-3xl">{group.name}</span>
                <span className="text-sm tabular-nums text-or-clair">
                  {plural(group.photos.length, "photo")}
                </span>
              </h2>
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                {group.photos.map((photo, index) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(group.start + index)}
                      aria-label={`Agrandir la photo de ${photo.name}`}
                      className="relative block aspect-square w-full overflow-hidden rounded-lg active:scale-[0.98]"
                    >
                      <LazyThumb endpoint="album-photo" token={token} id={photo.id} />
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
            </section>
          ))}
        </div>
      )}

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Photo de ${current.name}`}
          className="fixed inset-0 z-10 flex touch-none flex-col bg-sapin-950"
        >
          <div className="flex items-center justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <p className="font-serif text-2xl italic">{current.name}</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Fermer"
              className="grid size-11 place-items-center rounded-full border border-creme/30 active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 px-3">
            <ZoomablePhoto
              key={current.id}
              endpoint="album-photo"
              token={token}
              id={current.id}
              onSwipe={(step) => {
                if (open !== null && open + step >= 0 && open + step < photos.length) setOpen(open + step);
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-6 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setOpen(open - 1)}
              disabled={open === 0}
              aria-label="Photo précédente"
              className="grid size-12 place-items-center rounded-full border border-creme/30 active:scale-95 disabled:opacity-30"
            >
              <CaretLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => toggleLike(current)}
              aria-pressed={current.liked}
              aria-label={current.liked ? "Retirer le coup de cœur" : "Ajouter un coup de cœur"}
              className={`grid size-14 place-items-center rounded-full border transition-transform active:scale-90 ${current.liked ? "border-corail text-corail" : "border-creme/30"}`}
            >
              <Heart size={26} weight={current.liked ? "fill" : "regular"} />
            </button>
            <p className="min-w-16 text-center text-sm tabular-nums text-brume">
              {open + 1} sur {photos.length}
            </p>
            <button
              type="button"
              onClick={() => setOpen(open + 1)}
              disabled={open === photos.length - 1}
              aria-label="Photo suivante"
              className="grid size-12 place-items-center rounded-full border border-creme/30 active:scale-95 disabled:opacity-30"
            >
              <CaretRight size={22} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
