import type { Metadata } from "next";
import Link from "next/link";
import { EDITEUR, LegalPage, Section } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales, OuiSnap",
  robots: { index: false },
};

export default function MentionsLegales() {
  return (
    <LegalPage titre="Mentions légales" miseAJour="3 octobre 2026">
      <Section titre="Éditeur du site">
        <p>
          Le site ouisnap.pourunouieternel.fr et l&apos;application OuiSnap sont édités par{" "}
          <strong>{EDITEUR.nom}</strong>, {EDITEUR.statut}, sous le nom commercial{" "}
          <strong>{EDITEUR.enseigne}</strong>.
        </p>
        <ul>
          <li>Adresse : {EDITEUR.adresse}</li>
          <li>SIRET : {EDITEUR.siret}</li>
          <li>Code APE : {EDITEUR.ape}</li>
          <li>Immatriculé au Registre national des entreprises</li>
          <li>TVA non applicable, article 293 B du Code général des impôts</li>
          <li>Téléphone : {EDITEUR.telephone}</li>
          <li>
            E-mail : <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
          </li>
        </ul>
        <p>
          <strong>Directeur de la publication :</strong> {EDITEUR.nom}
        </p>
      </Section>

      <Section titre="Hébergement">
        <p>
          Le site, l&apos;application et les photos sont hébergés en France par{" "}
          <strong>OVH SAS</strong>, 2 rue Kellermann, 59100 Roubaix, France. RCS Lille Métropole
          424 761 419. Téléphone : 1007. Site : www.ovhcloud.com.
        </p>
      </Section>

      <Section titre="Propriété intellectuelle">
        <p>
          Le nom OuiSnap, les textes, la charte graphique, la vidéo de présentation et le code de
          l&apos;application appartiennent à {EDITEUR.nom}. Toute reproduction sans autorisation
          écrite est interdite.
        </p>
        <p>
          Les photos envoyées par les invités restent la propriété de leurs auteurs. En les
          envoyant, chaque invité autorise les organisateurs de l&apos;événement à les consulter,
          les télécharger et les conserver pour un usage privé.
        </p>
      </Section>

      <Section titre="Règles d'utilisation">
        <ul>
          <li>
            L&apos;invité qui envoie une photo s&apos;engage à n&apos;envoyer que des images prises
            pendant l&apos;événement, dont il est l&apos;auteur, et qui respectent les personnes
            photographiées.
          </li>
          <li>
            Sont interdits les contenus illicites, dégradants ou portant atteinte à la dignité, à
            la vie privée ou au droit à l&apos;image d&apos;autrui.
          </li>
          <li>
            PourUnOuiEternel peut retirer à tout moment une photo qui ne respecte pas ces règles,
            ou à la demande d&apos;une personne qui y figure.
          </li>
          <li>
            Le lien privé d&apos;un album donne accès à toutes ses photos : il appartient aux
            organisateurs de ne le partager qu&apos;avec des personnes de confiance.
          </li>
        </ul>
      </Section>

      <Section titre="Données personnelles">
        <p>
          Le traitement des données (prénoms, adresses e-mail, photos) est détaillé dans la{" "}
          <Link href="/confidentialite/">politique de confidentialité</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
