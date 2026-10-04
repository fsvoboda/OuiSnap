// Test de bout en bout OuiSnap : « mot de passe oublié » de l'administration.
// Joué via le MCP Playwright (browser_run_code_unsafe, paramètre filename = .claude/skills/pw/scripts/e2e-mot-de-passe.js).
// Prérequis : `npm run local` (port 8000), mot de passe local « admin », aucun lien en attente.
// Avant ET après chaque passage, remettre la base locale à zéro (le test change le mot de passe et épuise le plafond) :
//   sqlite3 .local/dev.sqlite "DELETE FROM settings; DELETE FROM admin_password_resets; DELETE FROM admin_login_attempts;"
// En local aucun e-mail ne part : le message est écrit dans .local/, le test l'ouvre comme une page et clique son bouton.
async (page) => {
  const scenario = async (page) => {
  const BASE = 'http://localhost:8000';
  const ROOT = '/Volumes/Mac500/DEV/OuiSnap-1';
  const SHOTS = `${ROOT}/.playwright-mcp/e2e`;
  const MAIL = `file://${ROOT}/.local/mails.log.admin-exemple-fr.html`;
  const NEW_PASSWORD = 'MotDePasse-2026';
  const log = [];
  const errors = [];
  const step = (name) => log.push(name);
  const expect = (cond, msg) => { if (!cond) throw new Error('ÉCHEC — ' + msg); log.push('  ✓ ' + msg); };
  const isApi = (name) => (r) => r.url().includes(`/api/${name}`);
  const ctx = page.context();
  let admin, mail;
  try {
    admin = await ctx.newPage();
    // Les 401 et 429 attendus par le scénario ne sont pas des anomalies : on ne garde que les autres erreurs.
    admin.on('console', (m) => { if (m.type() === 'error' && !/status of (401|410|422|429)/.test(m.text())) errors.push(m.text()); });
    admin.on('pageerror', (e) => errors.push(e.message));
    await admin.setViewportSize({ width: 390, height: 844 });
    const forgot = admin.getByRole('button', { name: 'Mot de passe oublié ?' });
    const login = async (password) => {
      await admin.locator('#password').fill(password);
      const [resp] = await Promise.all([
        admin.waitForResponse(isApi('admin-login'), { timeout: 10000 }),
        admin.getByRole('button', { name: 'Se connecter' }).click(),
      ]);
      return resp.status();
    };

    step('1. Session ouverte avec le mot de passe actuel');
    await ctx.clearCookies();
    await admin.goto(`${BASE}/admin/`);
    await forgot.waitFor({ timeout: 10000 });
    expect((await login('admin')) === 200, 'connexion avec « admin »');
    await admin.getByRole('heading', { name: 'Événements' }).waitFor({ timeout: 10000 });
    const oldSession = await ctx.cookies(BASE);
    expect(oldSession.some((c) => c.name === 'ouisnap_admin'), 'cookie de session obtenu (gardé pour la suite)');

    step('2. Demande du lien depuis l\'écran de connexion');
    await ctx.clearCookies(); // comme un autre navigateur : l'admin qui a oublié son mot de passe n'est pas connecté
    await admin.goto(`${BASE}/admin/`);
    await forgot.waitFor({ timeout: 10000 });
    await admin.screenshot({ path: `${SHOTS}/mdp-1-connexion.png` });
    const [forgotResp] = await Promise.all([admin.waitForResponse(isApi('admin-forgot'), { timeout: 10000 }), forgot.click()]);
    const forgotBody = await forgotResp.json();
    expect(forgotResp.status() === 200 && forgotBody.sentTo.length === 2, `lien envoyé à deux adresses (${forgotBody.sentTo.join(', ')})`);
    expect(forgotBody.sentTo.every((a) => /^.…@/.test(a)) && !JSON.stringify(forgotBody).match(/[a-f0-9]{48}/), 'la réponse ne contient ni adresse complète ni jeton');
    const notice = admin.getByRole('status').filter({ hasText: 'lien de réinitialisation' });
    await notice.waitFor();
    expect((await notice.innerText()).includes('valable une heure'), 'message de confirmation affiché');
    expect(await forgot.isDisabled(), 'bouton désactivé après l\'envoi');
    await admin.screenshot({ path: `${SHOTS}/mdp-2-envoye.png` });

    step('3. E-mail HTML reçu');
    mail = await ctx.newPage();
    await mail.setViewportSize({ width: 700, height: 900 });
    await mail.goto(MAIL);
    expect((await mail.title()).includes('réinitialisation du mot de passe'), `objet : ${await mail.title()}`);
    expect(await mail.getByText('Choisissez un nouveau mot de passe').isVisible(), 'titre du message');
    expect(await mail.getByText('valable une heure').isVisible(), 'durée de validité annoncée');
    const button = mail.getByRole('link', { name: 'Choisir un nouveau mot de passe' });
    const href = await button.getAttribute('href');
    expect(/^http:\/\/localhost:8000\/admin\/#reset=[a-f0-9]{48}$/.test(href || ''), 'bouton vers /admin/#reset=<jeton de 48 caractères>');
    const token = href.split('=')[1];
    expect((await mail.locator(`a[href="${href}"]`).count()) === 2, 'lien en clair identique sous le bouton');
    await mail.screenshot({ path: `${SHOTS}/mdp-3-mail.png`, fullPage: true });
    await mail.close();

    step('4. Ouverture du lien');
    const urls = [];
    admin.on('request', (r) => urls.push(r.url()));
    await admin.goto('about:blank');
    await admin.goto(href);
    await admin.getByRole('heading', { name: 'Nouveau mot de passe' }).waitFor({ timeout: 10000 });
    expect(admin.url() === `${BASE}/admin/`, 'jeton retiré de la barre d\'adresse');
    expect(!urls.some((u) => u.includes(token)), 'le jeton n\'apparaît dans aucune adresse de requête');
    expect((await admin.evaluate(() => document.activeElement && document.activeElement.id)) === 'new-password', 'focus sur le premier champ');

    step('5. Saisies refusées, sans consommer le lien');
    await admin.locator('#new-password').fill(NEW_PASSWORD);
    await admin.locator('#confirm-password').fill('AutreChose-2026');
    await admin.getByRole('button', { name: 'Enregistrer' }).click();
    await admin.getByRole('alert').filter({ hasText: 'pas identiques' }).waitFor();
    expect(true, 'deux mots de passe différents refusés');
    await admin.screenshot({ path: `${SHOTS}/mdp-4-formulaire.png` });
    const short = await admin.evaluate(async (t) => {
      const body = new URLSearchParams({ token: t, password: 'court', confirm: 'court' });
      const r = await fetch('/api/admin-reset.php', { method: 'POST', body });
      return { status: r.status, message: (await r.json()).message };
    }, token);
    expect(short.status === 422 && short.message.includes('10 caractères'), `mot de passe trop court refusé par le serveur (${short.message})`);

    step('6. Nouveau mot de passe enregistré');
    await admin.locator('#confirm-password').fill(NEW_PASSWORD);
    const [resetResp] = await Promise.all([
      admin.waitForResponse((r) => isApi('admin-reset')(r) && (r.request().postData() || '').includes('password'), { timeout: 10000 }),
      admin.getByRole('button', { name: 'Enregistrer' }).click(),
    ]);
    expect(resetResp.status() === 200, 'le lien a survécu aux saisies refusées, le mot de passe est enregistré');
    await admin.getByRole('status').filter({ hasText: 'Mot de passe modifié' }).waitFor({ timeout: 10000 });
    expect(true, 'retour à la connexion avec « Mot de passe modifié »');
    await admin.screenshot({ path: `${SHOTS}/mdp-5-modifie.png` });

    step('7. Ancien mot de passe et ancienne session refusés');
    expect((await login('admin')) === 401, 'ancien mot de passe « admin » refusé');
    await ctx.addCookies(oldSession);
    const stale = await admin.evaluate(async () => (await fetch('/api/admin-events.php', { method: 'POST' })).status);
    expect(stale === 401, 'la session ouverte avant le changement est déconnectée');
    await ctx.clearCookies();

    step('8. Connexion avec le nouveau mot de passe');
    expect((await login(NEW_PASSWORD)) === 200, 'nouveau mot de passe accepté');
    await admin.getByRole('heading', { name: 'Événements' }).waitFor({ timeout: 10000 });
    expect(true, 'liste des événements affichée');

    step('9. Lien à usage unique, lien mal formé');
    await admin.goto('about:blank');
    await admin.goto(href);
    await admin.getByRole('alert').filter({ hasText: "n'est plus valable" }).waitFor({ timeout: 10000 });
    expect(true, 'le lien déjà utilisé est refusé');
    await admin.screenshot({ path: `${SHOTS}/mdp-6-lien-invalide.png` });
    await admin.goto('about:blank');
    urls.length = 0;
    await admin.goto(`${BASE}/admin/#reset=abc`);
    await admin.getByRole('alert').filter({ hasText: "n'est plus valable" }).waitFor({ timeout: 10000 });
    expect(!urls.some((u) => u.includes('admin-reset')), 'lien mal formé refusé sans appel au serveur');

    step('10. Plafond de demandes');
    await ctx.clearCookies();
    const ask = async () => {
      await admin.goto('about:blank');
      await admin.goto(`${BASE}/admin/`);
      await forgot.waitFor({ timeout: 10000 });
      const [resp] = await Promise.all([admin.waitForResponse(isApi('admin-forgot'), { timeout: 10000 }), forgot.click()]);
      return resp.status();
    };
    expect((await ask()) === 200, '2e demande de l\'heure acceptée');
    expect((await ask()) === 200, '3e demande de l\'heure acceptée');
    expect((await ask()) === 429, '4e demande de l\'heure refusée');
    await admin.getByRole('alert').filter({ hasText: 'Trop de demandes' }).waitFor();
    expect(!(await forgot.isDisabled()), 'message « Trop de demandes » affiché, bouton de nouveau utilisable');
    await admin.screenshot({ path: `${SHOTS}/mdp-7-plafond.png` });

    return { ok: true, log, errors };
  } catch (e) {
    const where = {};
    for (const [n, p] of Object.entries({ admin, mail })) {
      if (p && !p.isClosed()) { try { await p.screenshot({ path: `${SHOTS}/mdp-echec-${n}.png` }); where[n] = p.url().replace(/[a-f0-9]{48}/, '<jeton>'); } catch {} }
    }
    return { ok: false, error: String(e.message || e).slice(0, 1500), log, errors, where };
  } finally {
    await ctx.clearCookies();
  }
};

  // Enregistrement du résultat : ce code tourne dans le serveur Playwright, sans accès direct aux fichiers.
  // Le résultat passe donc par le stockage local d'une page, puis est rangé dans .playwright-mcp/dernier-mot-de-passe.json.
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
    test: 'mot-de-passe',
    date: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
    debut: heure(debut),
    fin: heure(fin),
  });
  const fichier = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/dernier-mot-de-passe.json';
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
    test: 'mot-de-passe',
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
