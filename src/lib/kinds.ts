// Natures d'événement et textes qui en dépendent, côté invités comme côté organisateurs.
// L'invité choisit un pseudo, pas son état civil : INVITE_PSEUDO l'y invite, nameNeeded le réclame.
// Cette invitation ne dépend pas de la nature de l'événement, contrairement à seenBy et nameNeeded.
export const INVITE_PSEUDO = "Prénom, surnom, ce que vous voulez.";
export const KINDS = {
  mariage: {
    label: "Mariage",
    album: "Album des mariés",
    seenBy: "Les mariés verront qui a pris des photos.",
    nameNeeded: "Indiquez un pseudo pour que les mariés sachent qui a photographié.",
  },
  bapteme: {
    label: "Baptême",
    album: "Album du baptême",
    seenBy: "La famille verra qui a pris des photos.",
    nameNeeded: "Indiquez un pseudo pour que la famille sache qui a photographié.",
  },
  anniversaire: {
    label: "Anniversaire",
    album: "Album d'anniversaire",
    seenBy: "Les organisateurs verront qui a pris des photos.",
    nameNeeded: "Indiquez un pseudo pour que les organisateurs sachent qui a photographié.",
  },
  autre: {
    label: "Autre événement",
    album: "Album de l'événement",
    seenBy: "Les organisateurs verront qui a pris des photos.",
    nameNeeded: "Indiquez un pseudo pour que les organisateurs sachent qui a photographié.",
  },
} as const;

export type Kind = keyof typeof KINDS;

export const kindOf = (kind: string) => KINDS[kind as Kind] ?? KINDS.autre;

// Nature connue, ou « autre » pour tout le reste (choix du dessin des cartes imprimables).
export const kindKey = (kind: string): Kind => (kind in KINDS ? (kind as Kind) : "autre");
