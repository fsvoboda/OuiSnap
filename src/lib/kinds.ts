// Natures d'événement et textes qui en dépendent, côté invités comme côté organisateurs.
export const KINDS = {
  mariage: {
    label: "Mariage",
    album: "Album des mariés",
    seenBy: "Les mariés verront qui a pris des photos.",
    nameNeeded: "Indiquez votre prénom pour que les mariés sachent qui a photographié.",
  },
  bapteme: {
    label: "Baptême",
    album: "Album du baptême",
    seenBy: "La famille verra qui a pris des photos.",
    nameNeeded: "Indiquez votre prénom pour que la famille sache qui a photographié.",
  },
  anniversaire: {
    label: "Anniversaire",
    album: "Album d'anniversaire",
    seenBy: "Les organisateurs verront qui a pris des photos.",
    nameNeeded: "Indiquez votre prénom pour que les organisateurs sachent qui a photographié.",
  },
  autre: {
    label: "Autre événement",
    album: "Album de l'événement",
    seenBy: "Les organisateurs verront qui a pris des photos.",
    nameNeeded: "Indiquez votre prénom pour que les organisateurs sachent qui a photographié.",
  },
} as const;

export type Kind = keyof typeof KINDS;

export const kindOf = (kind: string) => KINDS[kind as Kind] ?? KINDS.autre;
