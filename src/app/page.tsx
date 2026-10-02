import {
  Heart,
  MoonStars,
  Sun,
  SunHorizon,
} from "@phosphor-icons/react/dist/ssr";
import QRCode from "qrcode";
import { CountUp } from "@/components/count-up";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { TeaserVideo } from "@/components/teaser-video";
import { WaitlistForm } from "@/components/waitlist-form";

// Les trois moments et leurs compteurs sont ceux du teaser.
const moments = [
  { heure: "11:00", nom: "La cérémonie", photos: 52, fond: "bg-sapin-700", Icone: Sun },
  { heure: "17:30", nom: "Le vin d'honneur", photos: 147, fond: "bg-ambre", Icone: SunHorizon },
  { heure: "23:45", nom: "La soirée", photos: 312, fond: "bg-nuit", Icone: MoonStars },
];

function Numero({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-or text-sm font-semibold text-sapin-950">
      {children}
    </span>
  );
}

export default async function Home() {
  const qr = await QRCode.toString("OuiSnap, l'appli de vos invités. Bientôt.", {
    type: "svg",
    margin: 0,
    color: { dark: "#1a2620", light: "#0000" },
  });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 md:px-12">
      {/* Liseré doré du teaser, fixe au-dessus de la page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-2 z-40 rounded-sm border border-or/35 md:inset-4"
      />
      <header className="flex h-18 items-center justify-between">
        <Logo className="text-3xl" />
        <nav className="flex items-center gap-8 text-sm">
          <a href="#fonctionnement" className="hidden text-brume hover:text-creme sm:block">
            Comment ça marche
          </a>
          <a
            href="#liste"
            className="rounded-full border border-or/60 px-5 py-2 font-medium text-or-clair transition-colors hover:bg-or hover:text-sapin-950"
          >
            Rejoindre la liste
          </a>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-12 pb-20 pt-8 md:grid-cols-[1.1fr_0.9fr] md:pb-28 md:pt-12">
          <Reveal className="flex flex-col items-start gap-7">
            <span className="libelle rounded-full bg-or px-4 py-1.5 text-sapin-950">
              Bientôt, fin 2026
            </span>
            <h1 className="pb-1 font-serif text-5xl leading-[1.1] md:text-6xl lg:text-7xl">
              Vos invités photographient,{" "}
              <em className="text-or">les mariés reçoivent tout.</em>
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-brume">
              Un QR code sur chaque table, rien à installer. Chaque photo de la
              journée arrive dans l&apos;album des mariés.
            </p>
            <a
              href="#liste"
              className="rounded-full bg-or px-8 py-4 text-sm font-semibold tracking-wide text-sapin-950 transition-[transform,background-color] hover:bg-or-clair active:scale-[0.98]"
            >
              Rejoindre la liste
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
                    Un QR code posé sur chaque table. L&apos;invité le vise avec son
                    téléphone et rejoint l&apos;album.
                  </p>
                </div>
                <div className="mx-auto mt-auto flex w-52 flex-col items-center gap-3 rounded-3xl border border-or bg-creme p-5 text-sapin-900">
                  <Logo className="text-2xl" />
                  <div
                    role="img"
                    aria-label="Exemple de QR code OuiSnap"
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <p className="font-serif text-lg italic">Scannez-moi !</p>
                </div>
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
                    Un appareil photo tout simple, à tout moment de la journée. Le
                    compteur monte, de la mairie à la piste de danse.
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
                    <h3 className="font-serif text-2xl italic">
                      Et partagent tout aux mariés
                    </h3>
                  </div>
                  <p className="max-w-[52ch] leading-relaxed text-sapin-700">
                    Chaque photo rejoint l&apos;album des mariés. Le lendemain, toute
                    la journée est là, vue par ceux qui l&apos;ont vécue.
                  </p>
                </div>
                <div className="flex items-center gap-5 md:flex-col md:items-end md:gap-1">
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

        <section id="liste" className="scroll-mt-8 py-20 md:py-28">
          <Reveal className="flex flex-col gap-8 md:pl-[12%]">
            <h2 className="max-w-[16ch] font-serif text-4xl leading-[1.1] md:text-6xl">
              Soyez prévenus <em className="text-or">le jour de la sortie.</em>
            </h2>
            <p className="max-w-[52ch] text-lg leading-relaxed text-brume">
              OuiSnap arrive fin 2026. Laissez votre e-mail, nous vous écrirons
              au lancement.
            </p>
            <WaitlistForm />
          </Reveal>
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-creme/15 py-10 pb-14 text-sm text-brume sm:flex-row sm:items-center sm:justify-between">
        <Logo className="text-2xl text-creme" />
        <p className="libelle">L&apos;appli de vos invités</p>
        <p>© 2026 OuiSnap</p>
      </footer>
    </div>
  );
}
