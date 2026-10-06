export type AdminEvent = {
  id: number;
  code: string;
  title: string;
  kind: string;
  organizerName: string | null;
  organizerEmail: string | null;
  hasQr: boolean; // image du QR code déposée sur le serveur, pour les e-mails
  startsAt: string | null;
  closesAt: string | null;
  revealAt: string | null;
  maxGuests: number | null;
  maxPhotos: number | null;
  albumKey: string | null;
  state: "upcoming" | "open" | "closed" | "expired";
  revealed: boolean;
  expired: boolean;
  emails: number; // photographes ayant laissé une adresse
  mailSentAt: string | null; // envoi du message de révélation
  deleteAt?: string | null; // suppression automatique : date choisie par l'administrateur (vide = clôture + six mois)
  deletesAt?: string | null; // date réelle prévue de la suppression ; null sans clôture
  deleteNear?: boolean; // à moins de trente jours, ou dépassée
  deleteWarnedAt?: string | null; // avertissement mis en file pour les organisateurs et l'administrateur
  deleteWarningSentAt?: string | null; // premier envoi réussi de cet avertissement ; null tant que rien n'est parti
  guests: number;
  photos: number;
  bytes: number;
};

// État de l'envoi des e-mails d'ouverture et de révélation.
export type AdminStatus = {
  cronLastRun: string | null; // dernier passage de la tâche planifiée
  cronAge: number | null; // secondes écoulées depuis ce passage, à l'horloge du serveur
  cronMode: "cli" | "web" | null; // lancée par l'hébergeur, ou par l'appel de son adresse web
  mailsPending: number; // e-mails de la file pas encore partis
  mailsAbandoned: number;
  autoDeleteLastAt?: string | null; // dernière suppression automatique d'un album par la tâche planifiée
  autoDeleteLastTitle?: string | null;
  autoDeleteCount?: number;
  retentionLastRun?: string | null; // dernier passage où les suppressions automatiques ont été examinées
  retentionAge?: number | null; // secondes écoulées depuis, à l'horloge du serveur
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
