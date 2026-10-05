// Test de bout en bout OuiSnap, joué via le MCP Playwright (browser_run_code_unsafe, paramètre filename = .claude/skills/pw/scripts/e2e-types.js).
// Prérequis : `npm run local` (site + API PHP sur SQLite, port 8000, mot de passe admin : admin).
// Parcours : pour chaque type (mariage, baptême, anniversaire, autre) : création par l'admin, album des organisateurs avant révélation,
// page invité (accueil, prénom vide, 1 photo, « Mes photos »), QR plein écran, révélation, album après, album vide. Les textes non adaptés sont des « constats ».
async (page) => {
  const scenario = async (page) => {
  const BASE = 'http://localhost:8000';
  const SHOTS = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/e2e';
  const log = [];
  const errors = [];
  const constats = [];
  let stepName = '';
  const step = (name) => { stepName = name; log.push(name); };
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const isApi = (name) => (r) => r.url().includes(`/api/${name}`);
  const ctx = page.context();
  const watch = (p, who) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${who}] ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[${who}] ${e.message}`));
  };
  // Table de référence recopiée de src/lib/kinds.ts (KINDS) : label, album, seenBy, nameNeeded.
  const KINDS = {
    mariage: { label: 'Mariage', album: 'Album des mariés', seenBy: 'Les mariés verront qui a pris des photos.', nameNeeded: 'Indiquez votre prénom pour que les mariés sachent qui a photographié.', org: 'Léa et Tom' },
    bapteme: { label: 'Baptême', album: 'Album du baptême', seenBy: 'La famille verra qui a pris des photos.', nameNeeded: 'Indiquez votre prénom pour que la famille sache qui a photographié.', org: 'Sophie et Marc' },
    anniversaire: { label: 'Anniversaire', album: "Album d'anniversaire", seenBy: 'Les organisateurs verront qui a pris des photos.', nameNeeded: 'Indiquez votre prénom pour que les organisateurs sachent qui a photographié.', org: 'Julie' },
    autre: { label: 'Autre événement', album: "Album de l'événement", seenBy: 'Les organisateurs verront qui a pris des photos.', nameNeeded: 'Indiquez votre prénom pour que les organisateurs sachent qui a photographié.', org: 'Association Les Amis' },
  };
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const snippet = (s, i) => norm(s).slice(Math.max(0, i - 40), i + 60);
  // (innerText applique le text-transform CSS : les comparaisons ignorent la casse.)
  // Contrôle non fatal : ✓ si satisfait, sinon ✗ + constat.
  const check = (type, ecran, attendu, ok, trouve) => {
    if (ok) { log.push('  ✓ ' + `[${type}] ${ecran} : ${attendu}`); return; }
    log.push('  ✗ ' + `[${type}] ${ecran} : ${attendu} (trouvé : ${trouve})`);
    constats.push({ type, ecran, attendu, trouve: String(trouve) });
  };
  const must = (cond, msg) => { if (!cond) throw new Error('ÉCHEC — ' + msg); log.push('  ✓ ' + msg); };
  const has = (type, ecran, text, expected) => check(type, ecran, `contient « ${expected} »`, norm(text).toLowerCase().includes(norm(expected).toLowerCase()), snippet(text, 0));
  // Aucun texte propre au mariage hors titre de l'événement (types autres que mariage).
  const noWedding = (type, ecran, text, title, extra) => {
    if (type === 'mariage') return;
    let t = norm(text).split(norm(title)).join(' ');
    if (extra) t = t.split(extra).join(' ');
    const m = /mari[ée]s?|mariage/i.exec(t);
    check(type, ecran, 'aucun texte propre au mariage (« mariés », « mariage »)', !m, m ? snippet(t, m.index) : '');
  };
  const bodyText = (p) => p.evaluate(() => document.body.innerText);
  const shot = (p, type, n, ecran, full) => p.screenshot({ path: `${SHOTS}/types-${type}-${n}-${ecran}.png`, fullPage: Boolean(full) && !ecran.startsWith('admin') });
  let admin, album, guest, qr;
  const cardOf = (title, btn) => admin.getByText(title, { exact: true }).first().locator(`xpath=ancestor::*[.//button[contains(., "${btn}")]][1]`);
  const ensureAdmin = async () => {
    await admin.goto(`${BASE}/admin/`);
    const pw = admin.locator('#password');
    const nouvel = admin.getByRole('button', { name: 'Nouvel événement' });
    await pw.or(nouvel).first().waitFor({ timeout: 10000 });
    if (await pw.isVisible()) {
      await pw.fill('admin');
      await admin.getByRole('button', { name: 'Se connecter' }).click();
      await nouvel.waitFor({ timeout: 10000 });
    }
  };
  let n = 0;
  try {
    admin = await ctx.newPage(); watch(admin, 'admin');
    album = await ctx.newPage(); watch(album, 'album');
    await album.setViewportSize({ width: 390, height: 844 });
    guest = await ctx.newPage(); watch(guest, 'invité');
    await guest.setViewportSize({ width: 390, height: 844 });
    qr = await ctx.newPage(); watch(qr, 'qr');
    await qr.setViewportSize({ width: 390, height: 844 });
    await guest.addInitScript(() => {
      // Caméra factice : un canevas animé remplace la webcam.
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const c = canvas.getContext('2d');
      const draw = () => {
        c.fillStyle = 'hsl(200, 55%, 38%)'; c.fillRect(0, 0, 1280, 720);
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 140px sans-serif'; c.fillText('Photo', 640, 380);
      };
      draw(); setInterval(draw, 40);
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(25);
    });

    for (const type of ['mariage', 'bapteme', 'anniversaire', 'autre']) {
      const K = KINDS[type];
      const title = `Test ${type} E2E ${Date.now().toString().slice(-6)}`;
      const T = `[${type}] `;

      step(`${++n}. ${type} — Admin : création de l'événement`);
      await ensureAdmin();
      await admin.getByRole('button', { name: 'Nouvel événement' }).click();
      await admin.locator('#kind').selectOption(type);
      const selectedLabel = await admin.locator('#kind option:checked').innerText();
      check(type, 'admin formulaire', `type choisi affiché « ${K.label} »`, selectedLabel === K.label, selectedLabel);
      await admin.locator('#title').fill(title);
      await admin.locator('#organizerName').fill(K.org);
      await admin.locator('#organizerEmail').fill(`organisateur.${type}@exemple.fr`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      await admin.locator('#startsAt').fill(local(today));
      await admin.locator('#maxPhotos').fill('10');
      await admin.getByRole('button', { name: "Créer l'événement" }).click();
      await admin.getByText(title, { exact: true }).first().waitFor({ timeout: 10000 });
      const card = cardOf(title, 'QR code et liens');
      const cardText = await card.innerText();
      check(type, 'admin liste', `carte de l'événement avec « ${K.label}, code »`, norm(cardText).includes(`${K.label}, code`), snippet(cardText, 0));
      await card.getByRole('button', { name: 'QR code et liens' }).click();
      const links = await card.locator('p.select-all').allInnerTexts();
      const guestUrl = links.find((l) => l.includes('/e/'));
      const albumUrl = links.find((l) => l.includes('/album/'));
      must(Boolean(guestUrl && albumUrl), `liens obtenus (invités : ${guestUrl})`);
      await card.locator('img[alt^="QR code"]').first().waitFor();
      const linksText = await card.innerText();
      noWedding(type, 'admin carte + QR code et liens', linksText, title, null);
      check(type, 'admin QR code et liens', "pas de texte dépendant du type dans le bloc (libellés neutres : « Lien des invités », « Lien privé de l'album »)", /lien privé de l'album/i.test(linksText) && /lien des invités/i.test(linksText), snippet(linksText, 0));
      await shot(admin, type, 1, 'admin-evenement', true);
      const code = (/[?&]c=([A-Za-z0-9]+)/.exec(guestUrl) || [])[1];
      must(Boolean(code), `code du QR obtenu (${code})`);

      step(`${++n}. ${type} — Album des organisateurs avant révélation`);
      await album.goto(albumUrl);
      await album.getByRole('heading', { level: 1, name: title }).waitFor();
      let t = await bodyText(album);
      has(type, 'album avant', t, K.album);
      has(type, 'album avant', t, 'Votre album se dévoile');
      const docTitleA = await album.title();
      noWedding(type, 'album avant (onglet)', docTitleA, title, null);
      noWedding(type, 'album avant', t, title, null);
      await shot(album, type, 2, 'album-avant', true);

      step(`${++n}. ${type} — Invité : accueil, prénom vide, inscription, 1 photo, « Mes photos »`);
      await guest.goto(guestUrl);
      await guest.getByRole('heading', { name: 'Connecté !' }).waitFor();
      t = await bodyText(guest);
      has(type, 'invité accueil', t, K.album);
      has(type, 'invité accueil', t, K.seenBy);
      noWedding(type, 'invité accueil', t, title, null);
      const docTitleG = await guest.title();
      noWedding(type, 'invité accueil (onglet)', docTitleG, title, null);
      await guest.getByRole('button', { name: 'Commencer à photographier' }).click();
      await guest.locator('#name-aide[role="alert"]').waitFor({ timeout: 5000 });
      t = await bodyText(guest);
      has(type, 'invité prénom vide', t, K.nameNeeded);
      noWedding(type, 'invité prénom vide', t, title, null);
      await shot(guest, type, 3, 'invite-prenom-vide', false);
      await guest.locator('#name').fill('Camille');
      await guest.getByRole('button', { name: 'Commencer à photographier' }).click();
      await guest.waitForFunction(() => { const b = document.querySelector('button[aria-label="Prendre la photo"]'); return b && !b.disabled; }, null, { timeout: 10000 });
      t = await bodyText(guest);
      noWedding(type, 'invité appareil photo', t, title, null);
      const [resp] = await Promise.all([
        guest.waitForResponse(isApi('upload'), { timeout: 15000 }),
        guest.getByRole('button', { name: 'Prendre la photo' }).click(),
      ]);
      must(resp.status() === 200, 'photo envoyée par la caméra factice');
      await guest.getByText('1 / 10 photos').waitFor({ timeout: 10000 });
      await guest.getByRole('button', { name: 'Voir mes photos' }).click();
      await guest.getByText('Mes photos').first().waitFor({ timeout: 10000 });
      await guest.waitForTimeout(600);
      t = await bodyText(guest);
      noWedding(type, 'invité « Mes photos »', t, title, null);

      step(`${++n}. ${type} — Page du QR code plein écran`);
      await qr.goto(`${BASE}/qr/?c=${code}`);
      await qr.getByText(title, { exact: true }).waitFor({ timeout: 10000 });
      t = await bodyText(qr);
      has(type, 'QR plein écran', t, K.album);
      noWedding(type, 'QR plein écran', t, title, null);
      noWedding(type, 'QR plein écran (onglet)', await qr.title(), title, null);
      await shot(qr, type, 4, 'qr-plein-ecran', false);

      step(`${++n}. ${type} — Admin : révélation avancée à maintenant`);
      await ensureAdmin();
      await cardOf(title, 'Modifier').getByRole('button', { name: 'Modifier' }).click();
      await admin.locator('#revealAt').fill(local(new Date(Date.now() - 60000)));
      await admin.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await admin.getByText(title, { exact: true }).first().waitFor();
      const revText = await cardOf(title, 'Modifier').innerText();
      must(revText.includes('Révélé'), "événement passé à l'état « Révélé »");
      noWedding(type, 'admin carte révélée', revText, title, null);

      step(`${++n}. ${type} — Album après révélation et invité figé`);
      await album.reload();
      await album.getByRole('button', { name: 'Tout télécharger' }).waitFor({ timeout: 10000 });
      t = await bodyText(album);
      has(type, 'album après', t, K.album);
      noWedding(type, 'album après', t, title, null);
      await guest.reload();
      await guest.getByText("L'album a été dévoilé").waitFor({ timeout: 10000 });
      t = await bodyText(guest);
      noWedding(type, 'invité figé', t, title, null);

      step(`${++n}. ${type} — Album vide après suppression de la photo par l'admin`);
      await admin.reload();
      await cardOf(title, 'Voir les photos').getByRole('button', { name: 'Voir les photos' }).click();
      const thumb = admin.locator('button[aria-label="Agrandir la photo de Camille"]').first();
      await thumb.waitFor({ timeout: 10000 });
      await thumb.click();
      const dialog = admin.getByRole('dialog', { name: 'Photo de Camille' });
      await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
      await Promise.all([
        admin.waitForResponse(isApi('admin-photo-delete'), { timeout: 10000 }),
        dialog.getByRole('button', { name: 'Confirmer la suppression' }).click(),
      ]);
      await album.reload();
      await album.getByText(/Aucune photo/).waitFor({ timeout: 10000 });
      t = await bodyText(album);
      check(type, 'album vide', 'message d\'état vide « Aucune photo n\'a été envoyée pour … » présent', /aucune photo n'a été envoyée pour/i.test(t), snippet(t, 0));
      noWedding(type, 'album vide', t, title, null);
      await shot(album, type, 5, 'album-vide', true);
    }

    return { ok: constats.length === 0, log, errors, constats };
  } catch (e) {
    const shots = {};
    for (const [nom, p] of Object.entries({ admin, album, guest, qr })) {
      if (p) { try { await p.screenshot({ path: `${SHOTS}/types-echec-${nom}.png` }); shots[nom] = p.url(); } catch {} }
    }
    return { ok: false, error: String(e.message || e).slice(0, 1500), etape: stepName, log, errors, constats, shots };
  }
};

  // Enregistrement du résultat : ce code tourne dans le serveur Playwright, sans accès direct aux fichiers.
  // Le résultat passe donc par le stockage local d'une page, puis est rangé dans .playwright-mcp/dernier-types.json.
  const heure = (d) => [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  const debut = new Date();
  let resultat;
  try {
    resultat = await scenario(page);
  } catch (e) {
    resultat = { ok: false, error: String(e.message || e).slice(0, 1500), log: [], errors: [] };
  }
  const fin = new Date();
  Object.assign(resultat, {
    test: 'types',
    date: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
    debut: heure(debut),
    fin: heure(fin),
  });
  const fichier = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/dernier-types.json';
  let enregistre = fichier;
  const feuille = await page.context().newPage();
  try {
    // Le résultat est posé dans le stockage local d'une page du site, puis Playwright écrit l'état du navigateur dans le fichier.
    await feuille.goto('http://localhost:8000/mentions-legales/');
    await feuille.evaluate((texte) => localStorage.setItem('pw-resultat', texte), JSON.stringify(resultat));
    await page.context().clearCookies();
    await page.context().storageState({ path: fichier });
    await feuille.evaluate(() => localStorage.removeItem('pw-resultat'));
  } catch (e) {
    enregistre = 'ÉCHEC de l\'enregistrement : ' + String(e.message || e).slice(0, 200);
  }
  for (const onglet of page.context().pages()) if (onglet !== page) await onglet.close().catch(() => {});
  // Réponse volontairement courte : le détail est dans le fichier enregistré.
  const lignes = resultat.log || [];
  return {
    test: 'types',
    ok: resultat.ok === true,
    debut: resultat.debut,
    fin: resultat.fin,
    etapes: lignes.filter((l) => !l.startsWith('  ')).length,
    controles: lignes.filter((l) => /^\s*✓/.test(l)).length,
    constats: lignes.filter((l) => /^\s*✗/.test(l)),
    error: resultat.error || null,
    derniereEtape: lignes.filter((l) => !l.startsWith('  ')).pop() || null,
    errors: resultat.errors || [],
    enregistre,
  };
}
