import Link from "next/link";
import { Logo } from "@/components/logo";

// Coordonnées de l'éditeur, reprises des mentions légales de pourunouieternel.fr.
export const EDITEUR = {
  nom: "Franck Svoboda",
  statut: "entrepreneur individuel (EI)",
  enseigne: "PourUnOuiEternel",
  adresse: "955 rue Jean Jaurès, 62700 Bruay-la-Buissière, France",
  siret: "539 392 704 00018",
  ape: "74.20Z (activités photographiques)",
  telephone: "07 69 75 74 88",
  email: "ouisnap@pourunouieternel.fr",
};

export function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-creme/15 pt-8">
      <h2 className="font-serif text-3xl italic text-or-clair">{titre}</h2>
      <div className="flex flex-col gap-4 leading-relaxed text-brume [&_a]:text-creme [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-creme [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </section>
  );
}

// Gabarit commun aux pages d'information légale.
export function LegalPage({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  miseAJour: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 pb-20">
      <header className="flex h-18 items-center justify-between">
        <Link href="/" aria-label="Retour à l'accueil de OuiSnap">
          <Logo className="text-3xl" />
        </Link>
        <Link href="/" className="text-sm text-brume hover:text-creme">
          Retour à l&apos;accueil
        </Link>
      </header>
      <main className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-5xl leading-[1.1]">{titre}</h1>
          <p className="text-sm text-brume">Dernière mise à jour : {miseAJour}</p>
        </div>
        {children}
      </main>
      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-creme/15 pt-8 text-sm text-brume">
        <Link href="/mentions-legales/" className="hover:text-creme">
          Mentions légales
        </Link>
        <Link href="/confidentialite/" className="hover:text-creme">
          Confidentialité
        </Link>
        <span className="ml-auto">© 2026 OuiSnap</span>
      </footer>
    </div>
  );
}
