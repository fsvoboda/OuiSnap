// Test de bout en bout OuiSnap, joué via le MCP Playwright (browser_run_code_unsafe, paramètre filename = .claude/skills/pw/scripts/e2e-mariage.js).
// Prérequis : `npm run local` (site + API PHP sur SQLite, port 8000, mot de passe admin : admin).
// Parcours : création d'un mariage, ouverture par les mariés, arrivée d'un invité, 5 photos à la caméra,
// suppression de la photo 2 par l'admin, révélation, découverte par les mariés, 3 coups de cœur, ordre des photos chez l'invité.
async (page) => {
  const scenario = async (page) => {
  const BASE = 'http://localhost:8000';
  const SHOTS = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/e2e';
  const log = [];
  const errors = [];
  const step = (name) => log.push(name);
  const expect = (cond, msg) => { if (!cond) throw new Error('ÉCHEC — ' + msg); log.push('  ✓ ' + msg); };
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ascending = (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]);
  const isApi = (name) => (r) => r.url().includes(`/api/${name}`);
  const ctx = page.context();
  const watch = (p, who) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${who}] ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[${who}] ${e.message}`));
  };
  const title = `Léa & Tom E2E ${Date.now().toString().slice(-6)}`;
  let admin, couple, guest;
  try {
    step("1. Admin : création de l'événement");
    admin = await ctx.newPage(); watch(admin, 'admin');
    await admin.goto(`${BASE}/admin/`);
    await admin.locator('#password').fill('admin');
    await admin.getByRole('button', { name: 'Se connecter' }).click();
    await admin.getByRole('button', { name: 'Nouvel événement' }).click();
    await admin.locator('#kind').selectOption('mariage');
    await admin.locator('#title').fill(title);
    await admin.locator('#organizerName').fill('Léa et Tom');
    await admin.locator('#organizerEmail').fill('lea.tom@exemple.fr');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await admin.locator('#startsAt').fill(local(today));
    const defaultReveal = await admin.locator('#revealAt').inputValue();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(12);
    expect(defaultReveal === local(tomorrow), `révélation proposée par défaut le lendemain à 12h (${defaultReveal})`);
    await admin.locator('#maxPhotos').fill('10');
    await admin.getByRole('button', { name: "Créer l'événement" }).click();
    const heading = admin.getByText(title, { exact: true }).first();
    await heading.waitFor({ timeout: 10000 });
    const card = heading.locator('xpath=ancestor::*[.//button[contains(., "QR code et liens")]][1]');
    expect((await card.innerText()).includes('En cours'), "événement listé avec l'état « En cours »");
    await card.getByRole('button', { name: 'QR code et liens' }).click();
    const links = await card.locator('p.select-all').allInnerTexts();
    const guestUrl = links.find((l) => l.includes('/e/'));
    const albumUrl = links.find((l) => l.includes('/album/'));
    expect(Boolean(guestUrl && albumUrl), `liens obtenus (invités : ${guestUrl})`);
    await card.locator('img[alt^="QR code"]').waitFor();
    await admin.screenshot({ path: `${SHOTS}/1-admin-evenement.png` });

    step("2. Mariés : ouverture de l'album avant révélation");
    couple = await ctx.newPage(); watch(couple, 'mariés');
    await couple.setViewportSize({ width: 390, height: 844 });
    await couple.goto(albumUrl);
    await couple.getByRole('heading', { level: 1, name: title }).waitFor();
    expect(await couple.getByText('Votre album se dévoile').isVisible(), 'compte à rebours de révélation affiché');
    expect(await couple.getByText("Aucune photo pour l'instant").isVisible(), "aucune photo pour l'instant");
    await couple.screenshot({ path: `${SHOTS}/2-maries-avant.png`, fullPage: true });

    step('3. Invité : ouverture et enregistrement');
    guest = await ctx.newPage(); watch(guest, 'invité');
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.addInitScript(() => {
      // Caméra factice : un canevas animé remplace la webcam.
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const c = canvas.getContext('2d');
      window.__shot = 0;
      const draw = () => {
        c.fillStyle = `hsl(${window.__shot * 67 % 360}, 55%, 38%)`;
        c.fillRect(0, 0, 1280, 720);
        c.fillStyle = '#fff'; c.textAlign = 'center';
        c.font = 'bold 140px sans-serif'; c.fillText(`Photo ${window.__shot}`, 640, 380);
        c.font = '40px sans-serif'; c.fillText(new Date().toLocaleTimeString('fr-FR'), 640, 470);
      };
      draw(); setInterval(draw, 40);
      window.__gum = 0;
      navigator.mediaDevices.getUserMedia = async () => { window.__gum++; return canvas.captureStream(25); };
    });
    await guest.goto(guestUrl);
    await guest.getByRole('heading', { name: 'Connecté !' }).waitFor();
    expect(await guest.getByText(title, { exact: true }).isVisible(), "écran d'accueil avec le nom de l'album");
    expect(await guest.getByText("jusqu'à 10 photos").isVisible(), 'limite de 10 photos annoncée');
    await guest.screenshot({ path: `${SHOTS}/3-invite-accueil.png` });
    await guest.locator('#name').fill('Camille');
    await guest.getByRole('button', { name: 'Commencer à photographier' }).click();

    step('4. Invité : 5 photos via la caméra');
    const shutter = guest.getByRole('button', { name: 'Prendre la photo' });
    await guest.waitForFunction(() => { const b = document.querySelector('button[aria-label="Prendre la photo"]'); return b && !b.disabled; }, null, { timeout: 10000 });
    expect((await guest.evaluate(() => window.__gum)) >= 1, 'caméra démarrée via getUserMedia');
    for (let i = 1; i <= 5; i++) {
      await guest.evaluate((n) => { window.__shot = n; }, i);
      await guest.waitForTimeout(400);
      const [response] = await Promise.all([
        guest.waitForResponse(isApi('upload'), { timeout: 15000 }),
        shutter.click(),
      ]);
      const body = await response.json();
      expect(response.status() === 200 && body.count === i, `photo ${i} envoyée (compteur serveur : ${body.count})`);
    }
    await guest.getByText('5 / 10 photos').waitFor();
    expect(true, "compteur de l'invité : « 5 / 10 photos »");
    await guest.screenshot({ path: `${SHOTS}/4-invite-camera.png` });
    const [mineResp] = await Promise.all([
      guest.waitForResponse(isApi('photos'), { timeout: 10000 }),
      guest.getByRole('button', { name: 'Voir mes photos' }).click(),
    ]);
    const mine = (await mineResp.json()).photos.map((p) => p.id);
    expect(mine.length === 5 && ascending(mine), `« Mes photos » dans l'ordre de prise de vue (${mine.join(', ')})`);
    await guest.waitForTimeout(1500);
    await guest.screenshot({ path: `${SHOTS}/5-invite-mes-photos.png` });

    step('5. Mariés : compteurs visibles, photos toujours secrètes');
    const [lockedResp] = await Promise.all([couple.waitForResponse(isApi('album.php')), couple.reload()]);
    const locked = await lockedResp.json();
    expect(locked.revealed === false && locked.total === 5 && locked.photos === undefined, 'API : 5 photos comptées, aucune photo transmise avant la révélation');
    await couple.getByText('Camille', { exact: true }).waitFor();
    expect(await couple.getByText('5 photos', { exact: true }).isVisible(), 'liste : Camille, 5 photos');
    expect((await couple.locator('button[aria-label^="Agrandir la photo"]').count()) === 0, 'aucune vignette affichée');
    await couple.screenshot({ path: `${SHOTS}/6-maries-compteurs.png`, fullPage: true });

    step('6. Admin : suppression de la photo 2 avant la révélation');
    await admin.reload();
    const headingDel = admin.getByText(title, { exact: true }).first();
    await headingDel.waitFor();
    await headingDel.locator('xpath=ancestor::*[.//button[contains(., "Voir les photos")]][1]').getByRole('button', { name: 'Voir les photos' }).click();
    await admin.getByText('5 photos, 1 photographe (pas encore révélé)').waitFor({ timeout: 10000 });
    expect(true, "l'admin voit les 5 photos avant la révélation");
    const adminThumbs = admin.locator('button[aria-label="Agrandir la photo de Camille"]');
    await adminThumbs.nth(1).click();
    const adminDialog = admin.getByRole('dialog', { name: 'Photo de Camille' });
    await adminDialog.getByText('2 sur 5').waitFor();
    await admin.waitForFunction(() => { const i = document.querySelector('[role="dialog"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
    await admin.screenshot({ path: `${SHOTS}/6b-admin-photo-2.png` });
    await adminDialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
    const [deleteResp] = await Promise.all([
      admin.waitForResponse(isApi('admin-photo-delete'), { timeout: 10000 }),
      adminDialog.getByRole('button', { name: 'Confirmer la suppression' }).click(),
    ]);
    expect(deleteResp.status() === 200 && deleteResp.request().postData().includes(String(mine[1])), `photo 2 (id ${mine[1]}) supprimée par l'admin`);
    await adminDialog.getByText('2 sur 4').waitFor();
    await adminDialog.getByRole('button', { name: 'Fermer' }).click();
    await admin.getByText('4 photos, 1 photographe (pas encore révélé)').waitFor();
    expect((await adminThumbs.count()) === 4, "il reste 4 photos dans la vue de l'admin");
    await admin.screenshot({ path: `${SHOTS}/6c-admin-apres-suppression.png`, fullPage: true });
    const kept = mine.filter((id, i) => i !== 1); // photos d'origine 1, 3, 4 et 5
    const [lessResp] = await Promise.all([couple.waitForResponse(isApi('album.php')), couple.reload()]);
    const less = await lessResp.json();
    expect(less.total === 4 && less.photos === undefined, 'mariés : le compteur passe à 4 photos, toujours secrètes');
    await couple.getByText('4 photos', { exact: true }).waitFor();
    const [guestLessResp] = await Promise.all([guest.waitForResponse(isApi('photos'), { timeout: 10000 }), guest.reload().then(() => guest.getByRole('button', { name: 'Voir mes photos' }).click())]);
    const guestLess = (await guestLessResp.json()).photos.map((p) => p.id);
    expect(guestLess.join(',') === kept.join(','), "invité : la photo 2 a disparu de « Mes photos », les 4 autres restent dans l'ordre");

    step('7. Admin : révélation avancée à maintenant');
    await admin.getByRole('button', { name: 'Retour à la liste des événements' }).click();
    await admin.reload();
    const heading2 = admin.getByText(title, { exact: true }).first();
    await heading2.waitFor();
    await heading2.locator('xpath=ancestor::*[.//button[contains(., "Modifier")]][1]').getByRole('button', { name: 'Modifier' }).click();
    await admin.locator('#revealAt').fill(local(new Date(Date.now() - 60000)));
    await admin.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const heading3 = admin.getByText(title, { exact: true }).first();
    await heading3.waitFor();
    expect((await heading3.locator('xpath=ancestor::*[.//button[contains(., "Modifier")]][1]').innerText()).includes('Révélé'), "événement passé à l'état « Révélé »");
    await admin.screenshot({ path: `${SHOTS}/7-admin-revele.png` });

    step("8. Mariés : découverte de l'album");
    await couple.setViewportSize({ width: 1200, height: 900 });
    const [openResp] = await Promise.all([couple.waitForResponse(isApi('album.php')), couple.reload()]);
    const albumIds = (await openResp.json()).photos.map((p) => p.id);
    expect(albumIds.join(',') === kept.join(','), "album des mariés : les 4 photos restantes, dans l'ordre de prise de vue");
    const thumbs = couple.locator('button[aria-label="Agrandir la photo de Camille"]');
    await thumbs.first().waitFor({ timeout: 10000 });
    expect((await thumbs.count()) === 4, '4 photos de Camille affichées');
    expect(await couple.getByRole('button', { name: 'Tout télécharger' }).isVisible(), 'bouton « Tout télécharger » présent');
    const thumbsLoaded = () => { const imgs = [...document.querySelectorAll('button[aria-label^="Agrandir"] img')]; return imgs.length === 4 && imgs.every((i) => i.complete && i.naturalWidth > 0); };
    await couple.waitForFunction(thumbsLoaded, null, { timeout: 10000 });
    expect(true, 'les 4 vignettes sont réellement chargées');
    const hearts = couple.locator('button[aria-label^="Agrandir"] [aria-label="Coup de cœur"]');
    expect((await hearts.count()) === 0, 'aucun coup de cœur au départ');
    await couple.screenshot({ path: `${SHOTS}/8-maries-album.png`, fullPage: true });

    step("9. Mariés : coups de cœur sur 3 photos (photos d'origine 1, 3 et 5)");
    await thumbs.first().click();
    const dialog = couple.getByRole('dialog', { name: 'Photo de Camille' });
    await dialog.waitFor();
    await couple.waitForFunction(() => { const i = document.querySelector('[role="dialog"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
    const size = await couple.evaluate(() => { const i = document.querySelector('[role="dialog"] img'); return `${i.naturalWidth}x${i.naturalHeight}`; });
    expect(true, `photo ouverte en grand (${size})`);
    const like = async (rank, n) => {
      await dialog.getByText(`${rank} sur 4`).waitFor();
      const [resp] = await Promise.all([
        couple.waitForResponse(isApi('album-like'), { timeout: 10000 }),
        dialog.getByRole('button', { name: 'Ajouter un coup de cœur' }).click(),
      ]);
      await dialog.getByRole('button', { name: 'Retirer le coup de cœur' }).waitFor();
      expect(resp.status() === 200, `coup de cœur enregistré sur la photo ${n}`);
    };
    const next = () => dialog.getByRole('button', { name: 'Photo suivante' }).click();
    await like(1, 1);
    await couple.screenshot({ path: `${SHOTS}/9-maries-photo.png` });
    await next();
    await like(2, 3);
    await next(); await next();
    await like(4, 5);
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await dialog.waitFor({ state: 'hidden' });
    expect((await hearts.count()) === 3, '3 cœurs affichés dans la grille');
    const [revealedResp] = await Promise.all([couple.waitForResponse(isApi('album.php')), couple.reload()]);
    const revealed = await revealedResp.json();
    const likedRanks = revealed.photos.map((p, i) => (p.liked ? i + 1 : null)).filter(Boolean);
    expect(likedRanks.join(',') === '1,2,4', `après rechargement, l'API renvoie les rangs ${likedRanks.join(', ')} en coup de cœur (photos d'origine 1, 3, 5)`);
    await thumbs.first().waitFor();
    await couple.waitForFunction(thumbsLoaded, null, { timeout: 10000 });
    expect((await hearts.count()) === 3, 'les 3 cœurs sont toujours là après rechargement');
    await couple.screenshot({ path: `${SHOTS}/10-maries-coups-de-coeur.png`, fullPage: true });

    step("9 bis. Admin : les coups de cœur sont visibles dans « Voir les photos »");
    await admin.reload();
    const headingLikes = admin.getByText(title, { exact: true }).first();
    await headingLikes.waitFor();
    await headingLikes.locator('xpath=ancestor::*[.//button[contains(., "Voir les photos")]][1]').getByRole('button', { name: 'Voir les photos' }).click();
    await adminThumbs.first().waitFor({ timeout: 10000 });
    const adminHearts = await admin.evaluate(() => [...document.querySelectorAll('button[aria-label^="Agrandir"]')].map((b) => (b.querySelector('[aria-label="Coup de cœur"]') ? 1 : 0)).join(''));
    expect(adminHearts === '1101', "l'admin voit les cœurs sur les photos d'origine 1, 3 et 5");
    await adminThumbs.first().click();
    expect(await adminDialog.getByText('Coup de cœur des organisateurs').isVisible(), 'mention « Coup de cœur des organisateurs » sous la photo agrandie');
    await admin.screenshot({ path: `${SHOTS}/10b-admin-coups-de-coeur.png` });

    step("10. Invité : album figé, photos dans l'ordre, coups de cœur visibles");
    const [afterResp] = await Promise.all([guest.waitForResponse(isApi('photos'), { timeout: 10000 }), guest.reload()]);
    const after = (await afterResp.json()).photos;
    await guest.getByText("L'album a été dévoilé").waitFor({ timeout: 10000 });
    expect((await guest.locator('button[aria-label="Prendre la photo"]').count()) === 0, "l'appareil photo n'est plus proposé");
    expect(after.map((p) => p.id).join(',') === kept.join(','), "« Mes photos » : 4 photos, toujours dans l'ordre de prise de vue");
    expect(after.map((p) => (p.liked ? 1 : 0)).join('') === '1101', "l'invité reçoit les coups de cœur sur ses photos d'origine 1, 3 et 5");
    await guest.waitForTimeout(1500);
    await guest.screenshot({ path: `${SHOTS}/11-invite-apres.png` });

    return { ok: true, title, guestUrl, albumUrl, log, errors };
  } catch (e) {
    const shots = {};
    for (const [n, p] of Object.entries({ admin, couple, guest })) {
      if (p) { try { await p.screenshot({ path: `${SHOTS}/echec-${n}.png` }); shots[n] = p.url(); } catch {} }
    }
    return { ok: false, title, error: String(e.message || e).slice(0, 1500), log, errors, shots };
  }
};

  // Enregistrement du résultat : ce code tourne dans le serveur Playwright, sans accès direct aux fichiers.
  // Le résultat passe donc par le stockage local d'une page, puis est rangé dans .playwright-mcp/dernier-mariage.json.
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
    test: 'mariage',
    date: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
    debut: heure(debut),
    fin: heure(fin),
  });
  const fichier = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/dernier-mariage.json';
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
    test: 'mariage',
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
