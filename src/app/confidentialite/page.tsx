import type { Metadata } from "next";
import { EDITEUR, LegalPage, Section } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Confidentialité, OuiSnap",
  robots: { index: false },
};

export default function Confidentialite() {
  return (
    <LegalPage titre="Politique de confidentialité" miseAJour="3 octobre 2026">
      <Section titre="Responsable du traitement">
        <p>
          <strong>{EDITEUR.nom}</strong> ({EDITEUR.enseigne}), {EDITEUR.adresse}. Pour toute
          question ou demande : <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
        </p>
      </Section>

      <Section titre="Données recueillies et finalités">
        <p>
          <strong>Si vous êtes invité à un événement</strong>
        </p>
        <ul>
          <li>
            Votre prénom, pour que les organisateurs sachent qui a pris quelles photos.
          </li>
          <li>
            Les photos que vous envoyez, avec leur date d&apos;envoi, pour constituer l&apos;album
            de l&apos;événement. Elles peuvent montrer d&apos;autres personnes.
          </li>
          <li>
            Votre adresse e-mail, seulement si vous choisissez de la donner : elle sert à vous
            envoyer un lien pour retrouver vos photos et à vous prévenir quand l&apos;album est
            dévoilé. Elle n&apos;est jamais montrée aux organisateurs ni aux autres invités.
          </li>
        </ul>
        <p>
          <strong>Si vous organisez un événement</strong>
        </p>
        <ul>
          <li>
            Votre nom et votre adresse e-mail, pour vous envoyer le lien de votre album et vous
            prévenir de son ouverture puis de sa révélation.
          </li>
        </ul>
        <p>
          <strong>Si vous remplissez le formulaire de demande</strong>
        </p>
        <ul>
          <li>
            Votre nom, votre adresse e-mail, le type et la date de votre événement, et votre
            message, pour répondre à votre demande.
          </li>
        </ul>
      </Section>

      <Section titre="Bases légales">
        <ul>
          <li>
            Prénom et photos des invités : intérêt légitime, celui de constituer l&apos;album de
            l&apos;événement à la demande de ses organisateurs.
          </li>
          <li>Adresse e-mail des invités : votre consentement, que vous pouvez retirer à tout moment.</li>
          <li>Données des organisateurs : exécution du contrat conclu avec PourUnOuiEternel.</li>
          <li>Formulaire de demande : mesures précontractuelles prises à votre demande.</li>
        </ul>
      </Section>

      <Section titre="Qui a accès à vos données">
        <ul>
          <li>
            Les organisateurs de l&apos;événement : pendant l&apos;événement, ils voient seulement
            les prénoms des invités et le nombre de photos envoyées ; après la révélation de
            l&apos;album, ils voient les photos et le prénom de leur auteur.
          </li>
          <li>
            {EDITEUR.nom}, en tant qu&apos;administrateur du service, qui peut consulter et retirer
            des photos.
          </li>
          <li>OVH, l&apos;hébergeur, pour le seul stockage des données, en France.</li>
        </ul>
        <p>
          Un invité ne voit que ses propres photos. Les données ne sont ni vendues, ni transmises à
          des tiers, ni utilisées à des fins publicitaires, et elles ne quittent pas l&apos;Union
          européenne.
        </p>
      </Section>

      <Section titre="Durées de conservation">
        <ul>
          <li>
            Photos, prénoms et adresses e-mail liés à un événement : jusqu&apos;à la suppression de
            l&apos;album, qui intervient au plus tard douze mois après sa date de clôture.
          </li>
          <li>Demandes reçues par le formulaire : trois ans après le dernier échange.</li>
          <li>
            Pièces comptables liées à une prestation : dix ans, comme l&apos;exige la loi.
          </li>
        </ul>
      </Section>

      <Section titre="Droit à l'image">
        <p>
          Si vous figurez sur une photo d&apos;un album et souhaitez son retrait, écrivez à{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a> en indiquant l&apos;événement
          concerné : la photo sera retirée.
        </p>
      </Section>

      <Section titre="Vos droits">
        <p>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de
          limitation, d&apos;opposition et de portabilité prévus par le RGPD. Pour les exercer,
          écrivez à <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>. Tant que l&apos;album
          n&apos;est pas dévoilé, un invité peut aussi supprimer lui-même ses photos depuis
          l&apos;application.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une
          réclamation à la CNIL (www.cnil.fr).
        </p>
      </Section>

      <Section titre="Cookies et stockage sur votre appareil">
        <ul>
          <li>
            Le site ne dépose aucun cookie de publicité, de mesure d&apos;audience ou de réseau
            social.
          </li>
          <li>
            Quand vous rejoignez un album, un identifiant de session est enregistré dans votre
            navigateur : il sert uniquement à vous reconnaître si vous revenez photographier.
          </li>
          <li>
            Un cookie de session est utilisé pour la seule connexion de l&apos;administrateur.
          </li>
          <li>
            OVH conserve des journaux techniques de connexion, à des fins de sécurité.
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
