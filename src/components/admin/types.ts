export type AdminEvent = {
  id: number;
  code: string;
  title: string;
  kind: string;
  startsAt: string | null;
  closesAt: string | null;
  revealAt: string | null;
  maxGuests: number | null;
  maxPhotos: number | null;
  albumKey: string | null;
  state: "upcoming" | "open" | "closed" | "expired";
  revealed: boolean;
  expired: boolean;
  guests: number;
  photos: number;
  bytes: number;
};

export const inputClass =
  "h-12 w-full rounded-xl border border-creme/25 bg-sapin-950/60 px-4 text-base text-creme placeholder:text-brume/60 focus:border-or-clair focus:outline-none";

export const buttonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60";

// Date sans heure, pour la clôture.
export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDate(iso: string | null) {
  if (!iso) return "non définie";
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
