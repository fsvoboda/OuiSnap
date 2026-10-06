import { ArrowUpRight, Heart, MoonStars, Sun, SunHorizon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { Logo } from "@/components/logo";
import { RequestForm } from "@/components/request-form";
import { Reveal } from "@/components/reveal";
import { TeaserVideo } from "@/components/teaser-video";

const PUOE = "https://www.pourunouieternel.fr";

// Exemple de journée, repris de la vidéo de présentation.
const moments = [
  { heure: "11:00", nom: "La cérémonie", photos: 52, fond: "bg-sapin-700", Icone: Sun },
  { heure: "17:30", nom: "Le vin d'honneur", photos: 147, fond: "bg-ambre", Icone: SunHorizon },
  { heure: "23:45", nom: "La soirée", photos: 312, fond: "bg-nuit", Icone: MoonStars },
];

const surprise = [
  {
    titre: "Pendant la fête",
    texte: "Vous voyez seulement qui photographie, et combien. Les images restent une surprise.",
  },
  {
    titre: "Le lendemain",
    texte: "L'album se dévoile à l'heure convenue avec vous, le lendemain à midi le plus souvent. Vous le découvrez d'un coup, rangé invité par invité.",
  },
  {
    titre: "Vos coups de cœur",
    texte: "Posez un cœur sur vos photos préférées : leur auteur le voit sur son téléphone.",
  },
  {
    titre: "Tout télécharger",
    texte: "Récupérez l'album entier en un seul fichier, avec un dossier par invité.",
  },
];

function Numero({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-or text-sm font-semibold text-sapin-950">
      {children}
    </span>
  );
}

// Capture réelle d'un écran de l'application, dans un cadre de téléphone.
function Ecran({
  src,
  alt,
  height = 1560,
  priority = false,
}: {
  src: string;
  alt: string;
  height?: number;
  priority?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[19rem] overflow-hidden rounded-[2.25rem] border border-or/50 bg-sapin-950 p-2 shadow-[0_30px_80px_-30px_rgba(8,14,11,0.9)]">
      <Image
        src={src}
        alt={alt}
        width={780}
        height={height}
        priority={priority}
        className="h-auto w-full rounded-[1.75rem]"
      />
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 md:px-12">
      {/* Liseré doré du teaser, fixe au-dessus de la page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-2 z-40 rounded-sm border border-or/35 md:inset-4"
      />
      <header className="flex h-18 items-center justify-between gap-4">
        <p className="flex items-baseline gap-3">
          <Logo className="text-3xl" />
          <span className="hidden text-sm text-brume sm:inline">par PourUnOuiEternel</span>
        </p>
        <nav className="flex items-center gap-8 text-sm">
          <a href="#fonctionnement" className="hidden text-brume hover:text-creme md:block">
            Comment ça marche
          </a>
          <a href="#surprise" className="hidden text-brume hover:text-creme md:block">
            L&apos;album surprise
          </a>
          <a
            href="#demande"
            className="whitespace-nowrap rounded-full border border-or/60 px-5 py-2 font-medium text-or-clair transition-colors hover:bg-or hover:text-sapin-950"
          >
            Demander OuiSnap
          </a>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-12 pb-20 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pb-28 md:pt-12">
          <Reveal className="flex flex-col items-start gap-7">
            <p className="flex flex-wrap items-center gap-3">
              <span className="libelle rounded-full bg-or px-4 py-1.5 text-sapin-950">Nouveau service</span>
              <span className="libelle text-or-clair">L&apos;appli photo de vos invités</span>
            </p>
            <h1 className="pb-1 font-serif text-5xl leading-[1.1] md:text-6xl lg:text-7xl">
              Vos invités photographient, <em className="text-or">vous recevez tout.</em>
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-brume">
              Un QR code sur les tables, rien à installer. Mariage, baptême, anniversaire :
              toutes leurs photos réunies dans votre album.
            </p>
            <a
              href="#demande"
              className="rounded-full bg-or px-8 py-4 text-sm font-semibold tracking-wide text-sapin-950 transition-[transform,background-color] hover:bg-or-clair active:scale-[0.98]"
            >
              Demander OuiSnap
            </a>
          </Reveal>
          <Reveal delay={0.15}>
            <TeaserVideo />
          </Reveal>
        </section>

        <section id="fonctionnement" className="scroll-mt-8 py-20 md:py-28">
          <Reveal>
            <h2 className="max-w-[18ch] font-serif text-4xl leading-[1.1] md:text-5xl">
              Trois gestes, <em className="text-or">un seul album.</em>
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-12">
            <Reveal className="md:col-span-5">
              <article className="flex h-full flex-col gap-8 rounded-3xl bg-sapin-800 p-8">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Numero>1</Numero>
                    <h3 className="font-serif text-2xl italic">Ils scannent le QR code</h3>
                  </div>
                  <p className="leading-relaxed text-brume">
                    Une carte posée sur chaque table. L&apos;invité la vise avec son téléphone,
                    donne son prénom, et il peut photographier.
                  </p>
                </div>
                <Image
                  src="/media/apercu-carte.jpg"
                  alt="Carte à poser sur les tables, avec le QR code de l'album et la mention « Scannez-moi ! »"
                  width={620}
                  height={877}
                  className="mx-auto mt-auto h-auto w-56 rounded-xl"
                />
              </article>
            </Reveal>

            <Reveal delay={0.1} className="md:col-span-7">
              <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-sapin-800">
                <div className="flex flex-col gap-3 p-8">
                  <div className="flex items-center gap-3">
                    <Numero>2</Numero>
                    <h3 className="font-serif text-2xl italic">
                      Ils photographient toute la journée
                    </h3>
                  </div>
                  <p className="leading-relaxed text-brume">
                    Un appareil photo tout simple, sans application à télécharger ni compte à
                    créer. Vous choisissez, si vous le souhaitez, le nombre de photos par invité.
                  </p>
                </div>
                <ul className="mt-auto flex flex-1 flex-col">
                  {moments.map(({ heure, nom, photos, fond, Icone }) => (
                    <li
                      key={heure}
                      className={`grid flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-5 px-8 py-5 ${fond}`}
                    >
                      <Icone size={26} className="text-or-clair" />
                      <div className="flex flex-wrap items-baseline gap-x-4">
                        <span className="font-serif text-4xl">{heure}</span>
                        <span className="font-serif text-xl italic text-or-clair">{nom}</span>
                      </div>
                      <span className="libelle text-right text-creme">{photos} photos</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>

            <Reveal className="md:col-span-12">
              <article className="grid items-center gap-8 rounded-3xl bg-creme p-8 text-sapin-900 md:grid-cols-[1fr_auto] md:p-12">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Numero>3</Numero>
                    <h3 className="font-serif text-2xl italic">Et vous recevez tout</h3>
                  </div>
                  <p className="max-w-[52ch] leading-relaxed text-sapin-700">
                    Chaque photo rejoint votre album. Rien ne reste dans les téléphones, rien à
                    réclamer après la fête.
                  </p>
                </div>
                <div className="flex items-center gap-5 md:flex-col md:items-end md:gap-3">
                  <Heart size={40} weight="fill" className="text-corail" />
                  <p className="font-serif text-6xl leading-none md:text-7xl">
                    <CountUp to={312} />
                  </p>
                  <p className="libelle text-sapin-700">photos reçues</p>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        <section
          id="surprise"
          className="grid scroll-mt-8 items-center gap-12 py-20 md:grid-cols-[0.85fr_1.15fr] md:py-28"
        >
          <Reveal>
            <Ecran
              height={1900}
              src="/media/apercu-album.jpg"
              alt="Page de l'album avant sa révélation : compte à rebours, QR code des invités, et nombre de photos envoyées par chaque invité"
            />
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-8">
            <h2 className="max-w-[16ch] font-serif text-4xl leading-[1.1] md:text-5xl">
              Un album <em className="text-or">gardé secret jusqu&apos;au lendemain.</em>
            </h2>
            <dl className="flex flex-col">
              {surprise.map(({ titre, texte }) => (
                <div
                  key={titre}
                  className="grid gap-1 border-t border-creme/15 py-5 sm:grid-cols-[13rem_1fr] sm:gap-6"
                >
                  <dt className="font-serif text-2xl italic text-or-clair">{titre}</dt>
                  <dd className="leading-relaxed text-brume">{texte}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        <section className="py-20 md:py-28">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-7 rounded-3xl border border-or/40 px-6 py-14 text-center md:px-14 md:py-20">
            <h2 className="font-serif text-4xl leading-[1.1] md:text-5xl">
              Le photographe saisit les moments forts,{" "}
              <em className="text-or">vos invités racontent le reste.</em>
            </h2>
            <p className="max-w-[60ch] text-lg leading-relaxed text-brume">
              OuiSnap est le service de PourUnOuiEternel, photographe de mariage dans le
              Pas-de-Calais. Les deux se complètent : un regard professionnel sur les instants qui
              comptent, et tous les regards de vos proches sur ce qui se passe autour.
            </p>
            <a
              href={PUOE}
              className="flex items-center gap-2 font-medium text-or-clair underline-offset-4 hover:underline"
            >
              Découvrir PourUnOuiEternel
              <ArrowUpRight size={18} />
            </a>
          </Reveal>
        </section>

        <section id="demande" className="scroll-mt-8 py-20 md:py-28">
          <Reveal className="flex flex-col gap-8 md:pl-[10%]">
            <h2 className="max-w-[16ch] font-serif text-4xl leading-[1.1] md:text-6xl">
              Parlons de <em className="text-or">votre événement.</em>
            </h2>
            <p className="max-w-[52ch] text-lg leading-relaxed text-brume">
              Indiquez la date et le type d&apos;événement : nous revenons vers vous pour préparer
              votre album et vos cartes de table.
            </p>
            <RequestForm />
          </Reveal>
        </section>
      </main>

      <footer className="flex flex-col gap-3 border-t border-creme/15 py-10 pb-14 text-sm text-brume sm:flex-row sm:items-center sm:justify-between">
        <Logo className="text-2xl text-creme" />
        <p>
          Un service de{" "}
          <a href={PUOE} className="text-creme underline-offset-4 hover:underline">
            PourUnOuiEternel
          </a>
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/mentions-legales/" className="hover:text-creme">
            Mentions légales
          </Link>
          <Link href="/confidentialite/" className="hover:text-creme">
            Confidentialité
          </Link>
          <span>© 2026 OuiSnap</span>
        </p>
      </footer>
    </div>
  );
}
