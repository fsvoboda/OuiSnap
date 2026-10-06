// Bilan des tests Playwright de OuiSnap : fabrique .playwright-mcp/rapport-pw.html à partir de resultats.json.
// Chaque script de test enregistre son résultat dans .playwright-mcp/dernier-<test>.json (avec date et heures). Ensuite :
//   node .claude/skills/pw/scripts/rapport.mjs ajouter <mariage|mot-de-passe|types|reprise>   ajoute ce passage à l'historique
//   node .claude/skills/pw/scripts/rapport.mjs                                        régénère seulement la page
// La sortie donne le verdict et la liste des captures à publier avec la page.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Les scripts vivent dans la skill ; résultats, captures et page générée restent dans .playwright-mcp/ (ignoré par git).
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", ".playwright-mcp");
const RESULTS = join(DIR, "resultats.json");
const OUT = join(DIR, "rapport-pw.html");

const TESTS = [
  {
    id: "mariage",
    name: "Parcours mariage",
    script: "e2e-mariage.js",
    summary:
      "De la création de l'événement par l'admin à la découverte de l'album par les mariés, avec un invité qui prend cinq photos.",
    limits: [
      "La caméra est simulée par un flux vidéo synthétique : le navigateur de test n'a pas de webcam.",
      "La révélation est forcée en avançant sa date depuis l'admin ; le passage automatique à l'heure prévue n'est pas testé.",
      "Le téléchargement ZIP et le PDF des tables ne sont pas testés.",
    ],
    expected: [{ pattern: /401 \(Unauthorized\)/, why: "la page admin vérifie s'il existe une session avant la connexion" }],
    shots: [
      ["1-admin-evenement.png", "Admin : événement créé"],
      ["2-maries-avant.png", "Mariés : avant la révélation"],
      ["3-invite-accueil.png", "Invité : accueil"],
      ["4-invite-camera.png", "Invité : cinquième photo"],
      ["5-invite-mes-photos.png", "Invité : mes photos"],
      ["6-maries-compteurs.png", "Mariés : compteurs"],
      ["6b-admin-photo-2.png", "Admin : photo 2 à supprimer"],
      ["6c-admin-apres-suppression.png", "Admin : après suppression"],
      ["7-admin-revele.png", "Admin : album révélé"],
      ["8-maries-album.png", "Mariés : l'album"],
      ["9-maries-photo.png", "Mariés : photo en grand"],
      ["10-maries-coups-de-coeur.png", "Mariés : trois coups de cœur"],
      ["10b-admin-coups-de-coeur.png", "Admin : coups de cœur"],
      ["11-invite-apres.png", "Invité : album figé"],
    ],
  },
  {
    id: "mot-de-passe",
    name: "Mot de passe oublié",
    script: "e2e-mot-de-passe.js",
    summary:
      "Demande du lien depuis l'écran de connexion, ouverture de l'e-mail, choix d'un nouveau mot de passe, puis vérification des refus.",
    limits: [
      "En local aucun e-mail ne part : le message est lu dans le journal du serveur de test. L'envoi réel par OVH n'est pas couvert.",
      "L'expiration du lien au bout d'une heure n'est pas rejouée.",
    ],
    expected: [],
    shots: [
      ["mdp-1-connexion.png", "Écran de connexion"],
      ["mdp-2-envoye.png", "Lien envoyé"],
      ["mdp-3-mail.png", "L'e-mail HTML"],
      ["mdp-4-formulaire.png", "Saisie refusée"],
      ["mdp-5-modifie.png", "Mot de passe modifié"],
      ["mdp-6-lien-invalide.png", "Lien déjà utilisé"],
      ["mdp-7-plafond.png", "Plafond de demandes"],
    ],
  },
  {
    id: "types",
    name: "Types d'événement",
    script: "e2e-types.js",
    summary:
      "Un événement de chaque type (mariage, baptême, anniversaire, autre) : les textes de l'admin, de l'album, de la page invité et du QR code doivent s'adapter au type.",
    limits: [
      "Les e-mails et le PDF des tables ne sont pas testés (relus dans le code seulement).",
      "La page vitrine et le formulaire de demande sont hors périmètre.",
      "Le texte affiché quand un album n'a pas de date de révélation n'est pas atteignable depuis l'admin.",
    ],
    expected: [{ pattern: /401 \(Unauthorized\)/, why: "la page admin vérifie s'il existe une session avant la connexion" }],
    shots: ["mariage", "bapteme", "anniversaire", "autre"].flatMap((kind) => {
      const label = { mariage: "Mariage", bapteme: "Baptême", anniversaire: "Anniversaire", autre: "Autre" }[kind];
      return [
        [`types-${kind}-1-admin-evenement.png`, `${label} : admin`],
        [`types-${kind}-2-album-avant.png`, `${label} : album avant révélation`],
        [`types-${kind}-3-invite-prenom-vide.png`, `${label} : accueil invité`],
        [`types-${kind}-4-qr-plein-ecran.png`, `${label} : QR code`],
        [`types-${kind}-5-album-vide.png`, `${label} : album révélé vide`],
      ];
    }),
  },
  {
    id: "reprise",
    name: "Reprise de l'envoi",
    script: "e2e-reprise.js",
    summary:
      "Les photos d'un invité sont gardées sur son téléphone quand le réseau tombe, repartent à la réouverture de la page, ne sont jamais enregistrées deux fois, et se comportent bien quand la limite est atteinte ou l'album dévoilé avant l'envoi : les photos prises avant la révélation rejoignent encore l'album, celles qui ne le sont pas sont refusées.",
    limits: [
      "Un onglet tué ou gelé par le téléphone n'est pas simulé : seule la fermeture ou le rechargement de la page est joué.",
      "L'écran verrouillé et le maintien réel de l'écran allumé ne sont pas testés.",
      "Safari sur iPhone et ses défauts de stockage ne sont pas couverts (le test tourne dans Chromium).",
      "La vraie navigation privée et un quota réellement plein ne sont pas simulés : l'absence de stockage est imitée en retirant IndexedDB de la page.",
      "Le navigateur intégré d'une autre application (Instagram, Facebook…) n'est pas testé.",
      "Deux envois vraiment simultanés du même identifiant ne sont pas rejoués : le serveur de test traite une requête à la fois.",
      "MySQL (production) n'est pas couvert : le test tourne sur SQLite.",
      "Le délai maximal d'un envoi (75 à 180 secondes) n'est pas rejoué.",
      "Une horloge de téléphone mal réglée de plus de quinze minutes n'est pas simulée : Playwright ne décale pas l'horloge du navigateur de test, seul l'envoi direct avec une fausse date de prise l'imite.",
      "Les sept jours au bout desquels une photo jamais partie est effacée du téléphone ne sont pas joués : il faudrait avancer le temps. La fenêtre réelle entre la prise de vue et cet effacement n'est donc pas vérifiée.",
      "Le cas « page ouverte à l'instant exact de la révélation » est approché par l'étape 10 (révélation avancée pendant que des photos attendent), pas rejoué à l'identique.",
    ],
    expected: [
      { pattern: /401 \(Unauthorized\)/, why: "la page admin vérifie s'il existe une session avant la connexion" },
      { pattern: /ERR_INTERNET_DISCONNECTED/, why: "réseau coupé volontairement pour que les photos restent en attente" },
      { pattern: /ERR_FAILED|ERR_CONNECTION_RESET/, why: "envoi coupé volontairement par le test" },
      { pattern: /409 \(Conflict\)/, why: "limite de photos atteinte, refusée par le serveur" },
      { pattern: /403 \(Forbidden\)/, why: "photo non prise avant la révélation, ou ancienne page sans date : refusée par le serveur" },
      { pattern: /400 \(Bad Request\)/, why: "identifiant de photo mal formé, refusé par le serveur" },
    ],
    shots: [
      ["reprise-3-hors-ligne.png", "Réseau coupé : 3 photos gardées"],
      ["reprise-4-retrouvees.png", "Réouverture : photos retrouvées"],
      ["reprise-6-doublon.png", "Réponse perdue : photo non dupliquée"],
      ["reprise-7-sans-stockage.png", "Sans stockage : ne fermez pas la page"],
      ["reprise-8-limite.png", "Limite atteinte pendant la coupure"],
      ["reprise-10-album-devoile.png", "Album dévoilé : les photos en attente partent quand même"],
      ["reprise-11-photo-tardive.png", "Photo tardive refusée, fiche ancienne repartie"],
    ],
  },
];

const read = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const data = read(RESULTS, { runs: [] });

const [action, testId] = process.argv.slice(2);
if (action === "ajouter") {
  if (!TESTS.some((test) => test.id === testId)) throw new Error(`Test inconnu : ${testId}`);
  // Le script range son résultat dans l'état du navigateur (stockage local, clé pw-resultat) : on l'en extrait.
  const state = read(join(DIR, `dernier-${testId}.json`), null);
  if (!state) throw new Error(`Fichier dernier-${testId}.json introuvable.`);
  const stored = (state.origins ?? []).flatMap((origin) => origin.localStorage ?? []).find((item) => item.name === "pw-resultat");
  const result = stored ? JSON.parse(stored.value) : state;
  if (!result.date || !result.debut) throw new Error(`dernier-${testId}.json n'a ni date ni heure : le script n'a pas enregistré son résultat.`);
  // Un même passage n'est compté qu'une fois, même si la commande est relancée.
  if (data.runs.some((run) => run.test === testId && run.date === result.date && run.start === result.debut))
    throw new Error(`Ce passage de ${testId} (${result.date} ${result.debut}) est déjà dans l'historique.`);
  data.runs.push({
    test: testId,
    date: result.date,
    start: result.debut,
    end: result.fin ?? null,
    ok: result.ok === true,
    title: result.title ?? null,
    log: result.log ?? [],
    errors: result.errors ?? [],
    error: result.error ?? null,
  });
  writeFileSync(RESULTS, JSON.stringify(data, null, 2) + "\n");
}

const esc = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Journal du script : une ligne sans retrait ouvre une étape ; « ✓ » est un contrôle réussi, « ✗ » un constat.
function steps(log) {
  const list = [];
  for (const line of log) {
    if (line.startsWith("  "))
      list[list.length - 1]?.checks.push({ ok: !/^\s*✗/.test(line), text: line.replace(/^\s*[✓✗]\s*/, "") });
    else {
      const match = line.match(/^(\d+(?: bis)?)\.\s*(.*)$/);
      list.push({ number: match ? match[1] : "", name: match ? match[2] : line, checks: [] });
    }
  }
  return list;
}
const seconds = (time) => {
  if (!time) return null;
  const [h, m, s = 0] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
const duration = (run) => {
  const a = seconds(run.start);
  const b = seconds(run.end);
  return a === null || b === null ? null : b - a;
};
const frenchDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const hour = (time) => (time ? time.slice(0, 5).replace(":", " h ") : "");
const plural = (count, word) => `${count} ${word}${count > 1 ? "s" : ""}`;

const latest = TESTS.map((test) => ({ test, run: [...data.runs].reverse().find((run) => run.test === test.id) ?? null }));
const played = latest.filter((entry) => entry.run);
const failed = played.filter((entry) => !entry.run.ok);
const passed = (log) => steps(log).reduce((n, step) => n + step.checks.filter((check) => check.ok).length, 0);
const missed = (log) => steps(log).reduce((n, step) => n + step.checks.filter((check) => !check.ok).length, 0);
const totalChecks = played.reduce((sum, { run }) => sum + passed(run.log), 0);
const totalMissed = played.reduce((sum, { run }) => sum + missed(run.log), 0);
const totalSteps = played.reduce((sum, { run }) => sum + steps(run.log).length, 0);
const totalDuration = played.reduce((sum, { run }) => sum + (duration(run) ?? 0), 0);
const last = [...data.runs].sort((a, b) => `${a.date} ${a.end ?? a.start ?? ""}`.localeCompare(`${b.date} ${b.end ?? b.start ?? ""}`)).pop();

const verdict =
  played.length === 0
    ? "Aucun test joué"
    : failed.length === 0
      ? played.length === TESTS.length
        ? "Tous les tests passent"
        : "Les tests joués passent"
      : `${plural(failed.length, "test")} en échec`;

function testSection({ test, run }) {
  if (!run) {
    return `<section class="test" id="${test.id}">
  <header class="test-head"><h2>${esc(test.name)}</h2><span class="etat attente">Jamais joué</span></header>
  <p class="resume">${esc(test.summary)}</p>
</section>`;
  }
  const list = steps(run.log);
  const checks = passed(run.log);
  const findings = missed(run.log);
  const time = duration(run);
  const unexpected = run.errors.filter((message) => !test.expected.some((rule) => rule.pattern.test(message)));
  const expected = run.errors.filter((message) => test.expected.some((rule) => rule.pattern.test(message)));
  const shots = test.shots.filter(([file]) => existsSync(join(DIR, "e2e", file)));

  const stepRows = list
    .map((step, index) => {
      const broken = Boolean(run.error) && index === list.length - 1;
      const flawed = broken || step.checks.some((check) => !check.ok);
      return `<li class="etape${flawed ? " rompue" : ""}">
      <p class="etape-nom"><span class="numero">${esc(step.number)}</span>${esc(step.name)}</p>
      <ul class="controles">${step.checks.map((check) => `<li${check.ok ? "" : ' class="echec"'}>${esc(check.text)}</li>`).join("")}${
        broken ? `<li class="echec">${esc((run.error ?? "Étape interrompue").replace(/^ÉCHEC — /, ""))}</li>` : ""
      }</ul>
    </li>`;
    })
    .join("\n");

  const consoleNote =
    run.errors.length === 0
      ? `<p>Aucune erreur dans la console du navigateur.</p>`
      : `${unexpected.length ? `<p class="alerte">${plural(unexpected.length, "erreur")} inattendue${unexpected.length > 1 ? "s" : ""} dans la console :</p><ul>${unexpected.map((m) => `<li><code>${esc(m)}</code></li>`).join("")}</ul>` : ""}${
          expected.length
            ? `<p>${plural(expected.length, "message")} attendu${expected.length > 1 ? "s" : ""} dans la console : ${esc(
                test.expected.map((rule) => rule.why).join(" ; "),
              )}.</p>`
            : ""
        }`;

  return `<section class="test" id="${test.id}">
  <header class="test-head">
    <h2>${esc(test.name)}</h2>
    <span class="etat ${run.ok ? "reussi" : "echoue"}">${run.ok ? "Réussi" : "Échec"}</span>
  </header>
  <p class="resume">${esc(test.summary)}</p>
  <dl class="fiche">
    <div><dt>Joué le</dt><dd>${esc(frenchDate(run.date))}${run.start ? `, ${esc(hour(run.start))}` : ""}</dd></div>
    <div><dt>Durée</dt><dd>${time === null ? "non mesurée" : `${time} s`}</dd></div>
    <div><dt>Étapes</dt><dd>${list.length}</dd></div>
    <div><dt>Contrôles réussis</dt><dd>${checks}</dd></div>
    ${findings ? `<div><dt>Constats</dt><dd class="constats">${findings}</dd></div>` : ""}
    <div><dt>Script</dt><dd><code>${esc(test.script)}</code></dd></div>
    ${run.title ? `<div><dt>Événement créé</dt><dd>${esc(run.title)}</dd></div>` : ""}
  </dl>

  ${
    shots.length
      ? `<h3>Planche-contact</h3>
  <div class="planche" tabindex="0" role="group" aria-label="Captures du test ${esc(test.name)}">
    ${shots
      .map(
        ([file, caption], index) => `<button type="button" class="vue" data-src="e2e/${esc(file)}" data-legende="${esc(caption)}">
      <img src="e2e/${esc(file)}" alt="${esc(caption)}" loading="lazy">
      <span class="legende"><span class="rang">${String(index + 1).padStart(2, "0")}</span>${esc(caption)}</span>
    </button>`,
      )
      .join("\n    ")}
  </div>`
      : ""
  }

  <h3>Déroulé</h3>
  <ol class="etapes">
${stepRows}
  </ol>

  <div class="notes">
    <div>
      <h3>Console</h3>
      ${consoleNote}
    </div>
    <div>
      <h3>Ce que ce test ne couvre pas</h3>
      <ul>${test.limits.map((limit) => `<li>${esc(limit)}</li>`).join("")}</ul>
    </div>
  </div>
</section>`;
}

const history = [...data.runs]
  .map((run, index) => ({ run, index }))
  .sort((a, b) => b.index - a.index)
  .map(({ run }) => {
    const test = TESTS.find((entry) => entry.id === run.test);
    const checks = passed(run.log);
    const findings = missed(run.log);
    const time = duration(run);
    return `<tr>
        <td>${esc(new Date(`${run.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}${run.start ? `, ${esc(hour(run.start))}` : ""}</td>
        <td>${esc(test?.name ?? run.test)}</td>
        <td><span class="etat ${run.ok ? "reussi" : "echoue"}">${run.ok ? "Réussi" : "Échec"}</span></td>
        <td class="nombre">${checks}</td>
        <td class="nombre">${findings || "—"}</td>
        <td class="nombre">${time === null ? "—" : `${time} s`}</td>
      </tr>`;
  })
  .join("\n");

const html = `<title>Tests Playwright OuiSnap</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Montserrat:wght@400;500;600&display=swap">
<style>
/* Mise en page : une colonne large alignée à gauche ; bilan en tête, puis un bloc par test
   (fiche, planche-contact des captures, déroulé en deux colonnes étape / contrôles). Charte OuiSnap. */
:root {
  color-scheme: dark;
  --fond: #1a2620;
  --fond-creux: #121a16;
  --surface: #23332b;
  --trait: #30443a;
  --texte: #f5f0e6;
  --discret: #b7c1b7;
  --or: #cba660;
  --or-texte: #e2c88f;
  --reussi: #7fcf9c;
  --reussi-fond: #1f3a2b;
  --echec: #f08a84;
  --echec-fond: #45211f;
  --serif: "Cormorant Garamond", Georgia, serif;
  --sans: "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --fond: #f5f0e6; --fond-creux: #ebe4d5; --surface: #fffdf8; --trait: #d9d0bd;
    --texte: #1a2620; --discret: #56655b; --or: #a57f33; --or-texte: #7d5f24;
    --reussi: #23703f; --reussi-fond: #dcedde; --echec: #a3312c; --echec-fond: #f6dcd9;
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --fond: #f5f0e6; --fond-creux: #ebe4d5; --surface: #fffdf8; --trait: #d9d0bd;
  --texte: #1a2620; --discret: #56655b; --or: #a57f33; --or-texte: #7d5f24;
  --reussi: #23703f; --reussi-fond: #dcedde; --echec: #a3312c; --echec-fond: #f6dcd9;
}
* { box-sizing: border-box; }
body {
  background: var(--fond); color: var(--texte);
  font: 400 15px/1.6 var(--sans);
  padding-block: 40px 72px; padding-inline: 20px;
}
main { max-width: 1040px; margin-inline: auto; display: flex; flex-direction: column; gap: 56px; }
h1, h2, h3, p, ul, ol, dl, dd { margin: 0; }
ul, ol { padding: 0; list-style: none; }
h1, h2 { font-family: var(--serif); font-weight: 500; text-wrap: balance; line-height: 1.1; }
h1 { font-size: clamp(2.4rem, 6vw, 3.6rem); }
h1 em { color: var(--or-texte); }
h2 { font-size: clamp(1.8rem, 4vw, 2.4rem); }
h3, .libelle, dt, th {
  font: 600 0.7rem/1.4 var(--sans); letter-spacing: 0.2em; text-transform: uppercase; color: var(--discret);
}
code { font: 0.86em var(--mono); overflow-wrap: anywhere; }
:focus-visible { outline: 2px solid var(--or-texte); outline-offset: 3px; }

.entete { display: flex; flex-direction: column; gap: 14px; }
.entete .libelle { color: var(--or-texte); }
.verdict { font-family: var(--serif); font-style: italic; font-size: 1.5rem; }
.verdict.reussi { color: var(--reussi); }
.verdict.echoue { color: var(--echec); }
.passage { color: var(--discret); }

.bilan { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); border-block: 1px solid var(--trait); }
.bilan div { padding: 18px 20px 18px 0; display: flex; flex-direction: column; gap: 4px; }
.bilan dd { font: 500 2.6rem/1 var(--serif); font-variant-numeric: tabular-nums; }
.bilan dd small { font: 400 0.9rem var(--sans); color: var(--discret); margin-left: 4px; }

.sommaire { display: flex; flex-direction: column; }
.sommaire a {
  display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: baseline;
  padding: 14px 0; border-bottom: 1px solid var(--trait); color: inherit; text-decoration: none;
}
.sommaire a:hover .nom { color: var(--or-texte); }
.sommaire .nom { font: 500 1.35rem var(--serif); }
.sommaire .detail { color: var(--discret); font-size: 0.85rem; font-variant-numeric: tabular-nums; }

.etat {
  display: inline-block; padding: 3px 12px; border-radius: 999px; white-space: nowrap;
  font: 600 0.72rem/1.6 var(--sans); letter-spacing: 0.08em; text-transform: uppercase;
}
.etat.reussi { background: var(--reussi-fond); color: var(--reussi); }
.etat.echoue { background: var(--echec-fond); color: var(--echec); }
.etat.attente { background: var(--surface); color: var(--discret); }

.test { display: flex; flex-direction: column; gap: 22px; scroll-margin-top: 24px; }
.test-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; }
.resume { max-width: 65ch; color: var(--discret); }
.fiche { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px 24px; }
.fiche div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fiche dd { font-variant-numeric: tabular-nums; }

/* Planche-contact : les captures défilent comme une bande de négatifs. */
.planche {
  display: flex; gap: 10px; overflow-x: auto; padding: 14px; background: var(--fond-creux);
  border-radius: 6px; scroll-snap-type: x proximity;
}
.vue {
  flex: none; display: flex; flex-direction: column; gap: 8px; padding: 0; border: 0; background: none;
  color: inherit; font: inherit; text-align: left; cursor: zoom-in; scroll-snap-align: start;
}
.vue img {
  display: block; height: 210px; width: auto; max-width: 300px; object-fit: cover; object-position: top;
  border: 1px solid var(--trait); border-radius: 3px; background: var(--surface);
}
.vue:hover img { border-color: var(--or); }
.legende { font-size: 0.74rem; color: var(--discret); max-width: 300px; }
.rang { font: 0.74rem var(--mono); color: var(--or-texte); margin-right: 8px; }

.etapes { display: flex; flex-direction: column; border-top: 1px solid var(--trait); }
.etape { display: grid; grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: 6px 32px; padding: 14px 0; border-bottom: 1px solid var(--trait); }
.etape-nom { font-weight: 500; display: flex; gap: 12px; }
.numero { flex: none; min-width: 2.6rem; font: 0.82rem/1.9 var(--mono); color: var(--or-texte); }
.controles { display: flex; flex-direction: column; gap: 4px; color: var(--discret); font-size: 0.9rem; min-width: 0; }
.controles li { padding-left: 1.5rem; position: relative; overflow-wrap: anywhere; }
.controles li::before { content: "✓"; position: absolute; left: 0; color: var(--reussi); font-weight: 600; }
.controles li.echec { color: var(--echec); font-weight: 500; }
.controles li.echec::before { content: "✕"; color: var(--echec); }
.etape.rompue .etape-nom { color: var(--echec); }

.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px 40px; }
.notes > div { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.notes p, .notes li { color: var(--discret); font-size: 0.9rem; max-width: 60ch; }
.notes ul { display: flex; flex-direction: column; gap: 6px; }
.notes ul li { padding-left: 1.1rem; position: relative; }
.notes ul li::before { content: "–"; position: absolute; left: 0; color: var(--or-texte); }
.alerte { color: var(--echec) !important; font-weight: 500; }
.constats { color: var(--echec); }

.historique { display: flex; flex-direction: column; gap: 16px; }
.tableau { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 10px 16px 10px 0; border-bottom: 1px solid var(--trait); white-space: nowrap; }
td.nombre, th.nombre { text-align: right; padding-left: 16px; }

dialog {
  border: 0; padding: 0; background: var(--fond-creux); color: var(--texte); border-radius: 8px;
  max-width: min(96vw, 1200px); max-height: 94vh;
}
dialog::backdrop { background: rgba(8, 12, 10, 0.82); }
.agrandi { display: flex; flex-direction: column; max-height: 94vh; }
.agrandi-barre { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 16px; }
.agrandi-barre button {
  font: 600 0.75rem var(--sans); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  background: none; color: var(--texte); border: 1px solid var(--trait); border-radius: 999px; padding: 6px 16px;
}
.agrandi-image { overflow: auto; padding: 0 16px 16px; }
.agrandi-image img { display: block; max-width: 100%; height: auto; margin-inline: auto; }

@media (max-width: 640px) {
  .etape { grid-template-columns: minmax(0, 1fr); }
  .controles { padding-left: calc(2.6rem + 12px); }
  .sommaire a { grid-template-columns: 1fr auto; }
  .sommaire .detail { grid-column: 1 / -1; }
  .vue img { height: 170px; }
}
</style>

<main>
  <header class="entete">
    <p class="libelle">OuiSnap · tests de bout en bout</p>
    <h1>Tests <em>Playwright</em></h1>
    <p class="verdict ${failed.length ? "echoue" : "reussi"}">${esc(verdict)}</p>
    ${last ? `<p class="passage">Dernier passage : ${esc(frenchDate(last.date))}${last.end || last.start ? `, ${esc(hour(last.end ?? last.start))}` : ""}. Joués en local sur le serveur de test (port 8000).</p>` : ""}
  </header>

  <dl class="bilan">
    <div><dt>Tests réussis</dt><dd>${played.length - failed.length}<small>sur ${TESTS.length}</small></dd></div>
    <div><dt>Étapes</dt><dd>${totalSteps}</dd></div>
    <div><dt>Contrôles réussis</dt><dd>${totalChecks}</dd></div>
    <div><dt>Constats</dt><dd${totalMissed ? ' class="constats"' : ""}>${totalMissed}</dd></div>
    <div><dt>Durée mesurée</dt><dd>${totalDuration}<small>s</small></dd></div>
  </dl>

  <nav class="sommaire" aria-label="Tests">
    ${latest
      .map(({ test, run }) => {
        const checks = run ? passed(run.log) : 0;
        const findings = run ? missed(run.log) : 0;
        return `<a href="#${test.id}"><span class="nom">${esc(test.name)}</span><span class="detail">${
          run ? `${plural(steps(run.log).length, "étape")}, ${plural(checks, "contrôle")}${findings ? `, ${plural(findings, "constat")}` : ""}` : "pas encore joué"
        }</span><span class="etat ${run ? (run.ok ? "reussi" : "echoue") : "attente"}">${run ? (run.ok ? "Réussi" : "Échec") : "Jamais joué"}</span></a>`;
      })
      .join("\n    ")}
  </nav>

${latest.map(testSection).join("\n\n")}

  <section class="historique">
    <h2>Historique des passages</h2>
    <div class="tableau">
      <table>
        <thead><tr><th>Passage</th><th>Test</th><th>Résultat</th><th class="nombre">Contrôles</th><th class="nombre">Constats</th><th class="nombre">Durée</th></tr></thead>
        <tbody>
${history}
        </tbody>
      </table>
    </div>
  </section>
</main>

<dialog id="agrandi" aria-label="Capture agrandie">
  <div class="agrandi">
    <div class="agrandi-barre"><span id="agrandi-legende"></span><button type="button" id="agrandi-fermer">Fermer</button></div>
    <div class="agrandi-image"><img id="agrandi-img" alt=""></div>
  </div>
</dialog>

<script>
(function () {
  var dialog = document.getElementById("agrandi");
  var image = document.getElementById("agrandi-img");
  var caption = document.getElementById("agrandi-legende");
  document.querySelectorAll(".vue").forEach(function (button) {
    button.addEventListener("click", function () {
      image.src = button.dataset.src;
      image.alt = button.dataset.legende;
      caption.textContent = button.dataset.legende;
      if (dialog.showModal) dialog.showModal();
    });
  });
  document.getElementById("agrandi-fermer").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });
})();
</script>
`;

writeFileSync(OUT, html);

// Ce qu'il faut pour publier : la page, le dossier racine, et les captures à joindre (chemins relatifs à cette racine).
const fichiers = [];
for (const test of TESTS) for (const [file] of test.shots) if (existsSync(join(DIR, "e2e", file))) fichiers.push({ path: `e2e/${file}` });
console.log(
  JSON.stringify({
    verdict,
    tests: `${played.length - failed.length} réussis sur ${TESTS.length}`,
    controles: totalChecks,
    constats: totalMissed,
    page: join(DIR, "rapport-pw.html"),
    racine: DIR,
    fichiers,
  }),
);
