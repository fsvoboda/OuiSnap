// Test de bout en bout OuiSnap, joué via le MCP Playwright (browser_run_code_unsafe, paramètre filename = .claude/skills/pw/scripts/e2e-reprise.js).
// Prérequis : `npm run local` (site + API PHP sur SQLite, port 8000, mot de passe admin : admin).
// Parcours : reprise de l'envoi des photos d'un invité. Photos gardées sur le téléphone (IndexedDB) quand le réseau tombe,
// reprise à la réouverture de la page, anti-doublon du serveur (client_id), stockage indisponible, limite atteinte,
// album dévoilé avant l'envoi. Dix étapes, voir research_notes/PWA et envoi fiable OuiSnap/plan_implementation.md, section 9.
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ctx = page.context();
  let CODE = '';
  const dialogs = [];
  const watch = (p, who) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${who}] ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[${who}] ${e.message}`));
    // Fermer ou recharger une page qui a des photos en attente ouvre une boîte « beforeunload » : on l'accepte.
    p.on('dialog', (d) => { dialogs.push(`${who}: ${d.type()}`); d.accept().catch(() => {}); });
  };
  // Attend qu'une condition devienne vraie (sondage toutes les 150 ms).
  const until = async (fn, what, ms = 15000) => {
    const t0 = Date.now();
    for (;;) {
      let v; try { v = await fn(); } catch { v = false; }
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error('ÉCHEC — délai dépassé : ' + what);
      await sleep(150);
    }
  };
  // Contenu d'IndexedDB (base « ouisnap ») : fiches de « queue » et nombre d'enregistrements de « bytes ».
  const idb = (p) => p.evaluate(async (code) => {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'ouisnap' }];
    if (!dbs.some((d) => d.name === 'ouisnap')) return { queue: [], bytes: 0, absent: true };
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ouisnap'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = await new Promise((res) => {
      const tx = db.transaction(['queue', 'bytes'], 'readonly');
      const q = tx.objectStore('queue').getAll();
      const k = tx.objectStore('bytes').getAllKeys();
      tx.oncomplete = () => {
        const mine = q.result.filter((f) => f.code === code); // la base est commune à tous les événements du navigateur
        const seqs = new Set(mine.map((f) => f.seq));
        res({ queue: mine.map(({ seq, id, state, attempts, reason, bytes }) => ({ seq, id, state, attempts, reason, bytes })), bytes: k.result.filter((x) => seqs.has(x)).length });
      };
    });
    db.close();
    return out;
  }, CODE);
  const idbCount = async (p) => (await idb(p)).queue.length;
  const statusOf = (p) => p.evaluate(() => [...document.querySelectorAll('p[role="status"]')].map((e) => e.textContent).join(' | '));
  const waitStatus = (p, re, ms = 15000) => p.waitForFunction(([src]) => [...document.querySelectorAll('p[role="status"]')].some((e) => new RegExp(src).test(e.textContent)), [re.source], { timeout: ms }).catch(async () => { throw new Error(`ÉCHEC — message attendu ${re} ; affiché : « ${await statusOf(p)} »`); });
  const ready = (p) => p.waitForFunction(() => { const b = document.querySelector('button[aria-label="Prendre la photo"]'); return b && !b.disabled; }, null, { timeout: 15000 });
  const shoot = async (p, n) => {
    await ready(p);
    await p.evaluate((v) => { window.__shot = v; }, n);
    await p.waitForTimeout(400);
    await p.getByRole('button', { name: 'Prendre la photo' }).click();
  };
  const online = (p) => p.evaluate(() => window.dispatchEvent(new Event('online')));
  const cidOf = (req) => { const b = req.postDataBuffer(); const m = b && b.toString('latin1').match(/name="client_id"\r\n\r\n([a-f0-9]{32})/); return m ? m[1] : null; };
  // Passe-plat sur l'envoi d'une page : pass (laisse passer, avec délai éventuel), abort (coupe), hold (retient), dup (le serveur reçoit, la page ne le sait pas).
  const mk = (p) => {
    const s = { mode: 'pass', delay: 0, held: [], cids: [], resps: [], dup: null };
    p.on('response', async (r) => {
      if (!r.url().includes('/api/upload.php')) return;
      let body = null; try { body = await r.json(); } catch {}
      s.resps.push({ status: r.status(), body, cid: cidOf(r.request()) });
    });
    return p.route('**/api/upload.php', async (route) => {
      const cid = cidOf(route.request());
      s.cids.push(cid);
      if (s.mode === 'abort') return route.abort('connectionreset');
      if (s.mode === 'hold') { s.held.push(route); return; }
      if (s.mode === 'dup') {
        s.mode = 'pass';
        const r = await route.fetch();
        s.dup = { status: r.status(), body: await r.json(), cid };
        return route.abort('connectionreset');
      }
      if (s.delay) await sleep(s.delay);
      return route.continue();
    }).then(() => s);
  };

  const title = `Test reprise E2E ${Date.now().toString().slice(-6)}`;
  let admin, guest, guest2, guest3, guest4;
  try {
    // Le navigateur de test garde ses données d'un passage à l'autre : on repart d'une base IndexedDB vierge.
    const nettoyage = await ctx.newPage();
    await nettoyage.goto(`${BASE}/mentions-legales/`);
    await nettoyage.evaluate(() => new Promise((res) => { const r = indexedDB.deleteDatabase('ouisnap'); r.onsuccess = r.onerror = r.onblocked = () => res(); setTimeout(res, 3000); }));
    await nettoyage.close();
    step("1. Admin : création de l'événement (type « autre », limite de 8 photos)");
    admin = await ctx.newPage(); watch(admin, 'admin');
    await admin.goto(`${BASE}/admin/`);
    await admin.locator('#password').fill('admin');
    await admin.getByRole('button', { name: 'Se connecter' }).click();
    await admin.getByRole('button', { name: 'Nouvel événement' }).click();
    await admin.locator('#kind').selectOption('autre');
    await admin.locator('#title').fill(title);
    await admin.locator('#organizerName').fill('Test reprise');
    await admin.locator('#organizerEmail').fill('reprise@exemple.fr');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await admin.locator('#startsAt').fill(local(today));
    await admin.locator('#maxPhotos').fill('8');
    await admin.getByRole('button', { name: "Créer l'événement" }).click();
    const heading = admin.getByText(title, { exact: true }).first();
    await heading.waitFor({ timeout: 10000 });
    const card = heading.locator('xpath=ancestor::*[.//button[contains(., "QR code et liens")]][1]');
    await card.getByRole('button', { name: 'QR code et liens' }).click();
    const links = await card.locator('p.select-all').allInnerTexts();
    const guestUrl = links.find((l) => l.includes('/e/'));
    expect(Boolean(guestUrl), `lien invité obtenu (${guestUrl})`);
    CODE = (new URL(guestUrl).searchParams.get('c') || '').toUpperCase();
    expect(/^[A-Z0-9]{4,}$/.test(CODE), `code de l'événement lu dans le lien (${CODE})`);

    // Caméra factice pour toutes les pages du contexte, y compris celles ouvertes plus tard (réouvertures).
    await ctx.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 720;
      const c = canvas.getContext('2d');
      window.__shot = 0;
      const draw = () => {
        c.fillStyle = `hsl(${window.__shot * 67 % 360}, 55%, 38%)`;
        c.fillRect(0, 0, 1280, 720);
        c.fillStyle = '#fff'; c.textAlign = 'center';
        c.font = 'bold 140px sans-serif'; c.fillText(`Photo ${window.__shot}`, 640, 380);
      };
      draw(); setInterval(draw, 40);
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(25);
    });
    // Appels directs à l'API depuis la page admin (la route de la page invité ne les voit pas).
    let TOKEN = '';
    const direct = (path, fields) => admin.evaluate(async ({ path, fields }) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) {
        if (v === '__jpeg__') {
          const cv = document.createElement('canvas'); cv.width = 240; cv.height = 160;
          const g = cv.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 240, 160);
          fd.append(k, await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.8)), 'photo.jpg');
        } else fd.append(k, v);
      }
      const r = await fetch(`/api/${path}.php`, { method: 'POST', body: fd });
      return { status: r.status, body: await r.json() };
    }, { path, fields });
    const serverPhotos = async () => (await direct('photos', { token: TOKEN })).body.photos.map((p) => p.id);

    step("2. Invité : inscription, 1 photo en ligne");
    guest = await ctx.newPage(); watch(guest, 'invité');
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.goto(guestUrl);
    await guest.getByRole('heading', { name: 'Connecté !' }).waitFor();
    await guest.locator('#name').fill('Camille');
    await guest.getByRole('button', { name: 'Commencer à photographier' }).click();
    await ready(guest);
    TOKEN = await guest.evaluate((c) => localStorage.getItem('ouisnap:invite:' + c), CODE);
    expect(/^[a-f0-9]{48}$/.test(TOKEN || ''), "jeton de l'invité gardé sur son téléphone");
    await shoot(guest, 1);
    await guest.getByText('1 / 8 photos').waitFor({ timeout: 15000 });
    expect(true, "compteur de l'invité : « 1 / 8 photos »");
    await until(async () => (await idb(guest)).queue.length === 0, 'IndexedDB vide après la première photo').catch(async (e) => {
      throw new Error(`${e.message} — état : ${JSON.stringify(await idb(guest).catch((x) => String(x)))} ; message affiché : « ${await statusOf(guest)} » ; serveur : ${JSON.stringify(await serverPhotos().catch((x) => String(x)))}`);
    });
    const s2 = await idb(guest);
    expect(s2.queue.length === 0 && s2.bytes === 0, 'IndexedDB vide : la photo envoyée a été effacée du téléphone (fiche et octets)');
    expect((await serverPhotos()).length === 1, 'le serveur a 1 photo');

    step('3. Invité : réseau coupé, 3 photos');
    await ctx.setOffline(true);
    for (let i = 2; i <= 4; i++) await shoot(guest, i);
    await waitStatus(guest, /Réseau indisponible\. 3 photos en attente, gardées sur ce téléphone\./);
    expect(true, 'message « Réseau indisponible. 3 photos en attente, gardées sur ce téléphone. »');
    await guest.getByText('4 / 8 photos').waitFor({ timeout: 5000 });
    expect(true, "compteur de l'invité : « 4 / 8 photos »");
    await until(async () => (await idbCount(guest)) === 3, 'trois fiches dans IndexedDB');
    const kept = await idb(guest);
    const keptIds = kept.queue.map((f) => f.id);
    expect(kept.queue.length === 3 && kept.bytes === 3, `IndexedDB : 3 fiches et 3 images (seq ${kept.queue.map((f) => f.seq).join(', ')})`);
    expect(kept.queue.every((f) => f.state === 'waiting' && f.attempts === 0 && /^[a-f0-9]{32}$/.test(f.id) && f.bytes > 1000), 'fiches « waiting », aucun essai compté, identifiant de 32 caractères hexadécimaux');
    expect(kept.queue.every((f, i) => i === 0 || f.seq > kept.queue[i - 1].seq), "les seq croissent dans l'ordre de prise de vue");
    // (le réseau coupé vaut pour tout le navigateur, la page admin comprise : le serveur ne se contrôle qu'au rétablissement)
    await guest.screenshot({ path: `${SHOTS}/reprise-3-hors-ligne.png` });

    step('4. Invité : page fermée, réseau rétabli, nouvelle page');
    await guest.close({ runBeforeUnload: true });
    await ctx.setOffline(false);
    guest2 = await ctx.newPage(); watch(guest2, 'invité 2');
    await guest2.setViewportSize({ width: 390, height: 844 });
    const r2 = await mk(guest2); r2.delay = 1500;
    await guest2.goto(guestUrl);
    await waitStatus(guest2, /3 photos retrouvées, envoi en cours…/, 10000);
    expect(true, 'message « 3 photos retrouvées, envoi en cours… »');
    expect((await guest2.getByRole('heading', { name: 'Connecté !' }).count()) === 0, "pas d'écran « Connecté ! » : l'invité est reconnu");
    await guest2.screenshot({ path: `${SHOTS}/reprise-4-retrouvees.png` });
    await until(() => r2.resps.length >= 3, 'trois envois reçus', 20000);
    expect(r2.cids.slice(0, 3).join(',') === keptIds.join(','), "les 3 envois partent dans l'ordre des seq (mêmes identifiants que les fiches)");
    expect(r2.resps.slice(0, 3).every((r) => r.status === 200 && !r.body.duplicate), 'trois réponses 200, aucun doublon');
    expect(r2.resps.slice(0, 3).map((r) => r.body.count).join(',') === '2,3,4', 'compteurs du serveur : 2, 3, 4');
    await guest2.getByText('4 / 8 photos').waitFor({ timeout: 5000 });
    await until(async () => (await idbCount(guest2)) === 0, 'IndexedDB vide après la reprise');
    const s4 = await idb(guest2);
    expect(s4.queue.length === 0 && s4.bytes === 0, 'IndexedDB vide après la reprise (fiches et images effacées)');
    r2.delay = 0;

    step('5. Invité : envoi coupé, 1 photo, rechargement de la page');
    r2.mode = 'abort';
    await shoot(guest2, 5);
    await waitStatus(guest2, /Réseau indisponible\. 1 photo en attente/);
    await until(async () => (await idbCount(guest2)) === 1, 'une fiche dans IndexedDB');
    const kept5 = (await idb(guest2)).queue[0];
    r2.mode = 'hold';
    await guest2.reload();
    await waitStatus(guest2, /1 photo retrouvée, envoi en cours…/, 10000);
    expect(true, 'après rechargement : « 1 photo retrouvée, envoi en cours… »');
    await until(() => r2.held.length >= 1, "l'envoi de la photo retrouvée part", 10000);
    expect(r2.cids[r2.cids.length - 1] === kept5.id, 'elle repart sous le même identifiant que sa fiche');
    const before5 = r2.resps.length;
    r2.mode = 'pass';
    for (const route of r2.held) await route.continue();
    await until(() => r2.resps.length > before5, 'réponse du serveur pour la photo retrouvée');
    const last5 = r2.resps[r2.resps.length - 1];
    expect(last5.status === 200 && last5.body.count === 5, `photo retrouvée envoyée (compteur serveur : ${last5.body.count})`);
    await guest2.getByText('5 / 8 photos').waitFor({ timeout: 5000 });
    await until(async () => (await idbCount(guest2)) === 0, 'IndexedDB vide');
    expect(true, 'IndexedDB vide, compteur « 5 / 8 photos »');

    step('6. Invité : réponse perdue, anti-doublon du serveur');
    r2.mode = 'dup';
    await shoot(guest2, 6);
    await until(() => r2.dup, 'le serveur reçoit la photo, la réponse est coupée');
    expect(r2.dup.status === 200 && r2.dup.body.count === 6 && !r2.dup.body.duplicate, `premier envoi reçu par le serveur (id ${r2.dup.body.id}, compteur ${r2.dup.body.count}), réponse jamais arrivée à la page`);
    await waitStatus(guest2, /Réseau indisponible\. 1 photo en attente/);
    expect((await idbCount(guest2)) === 1, 'la page garde la fiche, faute d\'accusé');
    const before6 = r2.resps.length;
    await online(guest2);
    await until(() => r2.resps.length > before6, 'second envoi de la même photo');
    const last6 = r2.resps[r2.resps.length - 1];
    expect(last6.cid === r2.dup.cid, 'second envoi sous le même identifiant');
    expect(last6.status === 200 && last6.body.duplicate === true && last6.body.id === r2.dup.body.id, `le serveur répond « duplicate: true » avec le même id (${last6.body.id})`);
    expect(last6.body.count === 6, 'compteur du serveur : 6');
    await until(async () => (await idbCount(guest2)) === 0, 'IndexedDB vide après le doublon');
    await guest2.getByText('6 / 8 photos').waitFor({ timeout: 5000 });
    const ids6 = await serverPhotos();
    expect(ids6.length === 6, `le serveur n'a que 6 photos (pas de doublon) : ${ids6.join(', ')}`);
    await guest2.screenshot({ path: `${SHOTS}/reprise-6-doublon.png` });

    step('7. Invité : navigateur sans stockage (IndexedDB neutralisé)');
    await guest2.close({ runBeforeUnload: true });
    guest3 = await ctx.newPage(); watch(guest3, 'invité 3');
    await guest3.setViewportSize({ width: 390, height: 844 });
    await guest3.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
    const r3 = await mk(guest3);
    r3.mode = 'abort';
    await guest3.goto(guestUrl);
    expect((await guest3.evaluate(() => typeof indexedDB)) === 'undefined', 'IndexedDB est bien absent de cette page');
    await shoot(guest3, 7);
    await waitStatus(guest3, /ne fermez pas cette page/);
    expect(true, `message « ne fermez pas cette page » (« ${(await statusOf(guest3)).split(' | ')[0]} »)`);
    await guest3.screenshot({ path: `${SHOTS}/reprise-7-sans-stockage.png` });
    r3.mode = 'pass';
    await online(guest3);
    await until(() => r3.resps.length >= 1, 'la photo gardée en mémoire est envoyée');
    expect(r3.resps[0].status === 200 && r3.resps[0].body.count === 7, `photo envoyée malgré l'absence de stockage (compteur serveur : ${r3.resps[0].body.count})`);
    await guest3.getByText('7 / 8 photos').waitFor({ timeout: 5000 });
    expect(true, "compteur de l'invité : « 7 / 8 photos »");

    step('8. Invité : limite atteinte pendant une coupure');
    await guest3.close({ runBeforeUnload: true });
    guest4 = await ctx.newPage(); watch(guest4, 'invité 4');
    await guest4.setViewportSize({ width: 390, height: 844 });
    const r4 = await mk(guest4);
    r4.mode = 'abort';
    await guest4.goto(guestUrl);
    await shoot(guest4, 8);
    await waitStatus(guest4, /Réseau indisponible\. 1 photo en attente/);
    await guest4.getByText('8 / 8 photos').waitFor({ timeout: 5000 });
    await until(async () => (await idbCount(guest4)) === 1, 'une fiche dans IndexedDB');
    const sent8 = await direct('upload', { token: TOKEN, photo: '__jpeg__' });
    expect(sent8.status === 200 && sent8.body.count === 8 && sent8.body.duplicate === undefined, `envoi direct sans client_id accepté (compteur ${sent8.body.count}) : ancienne page tolérée`);
    r4.mode = 'pass';
    await online(guest4);
    await until(() => r4.resps.length >= 1, 'la photo de la page part');
    const l8 = r4.resps[0];
    expect(l8.status === 409 && l8.body.error === 'limit', `le serveur refuse : 409 « ${l8.body.error} »`);
    await waitStatus(guest4, /Limite de 8 photos atteinte : 1 photo n'a pas été envoyée\./);
    expect(true, "message « Limite de 8 photos atteinte : 1 photo n'a pas été envoyée. »");
    await until(async () => (await idbCount(guest4)) === 0, 'IndexedDB vide après le refus');
    expect((await idb(guest4)).bytes === 0, 'IndexedDB vide : la photo refusée est effacée');
    const ids8 = await serverPhotos();
    expect(ids8.length === 8, `le serveur a 8 photos : ${ids8.join(', ')}`);
    await guest4.screenshot({ path: `${SHOTS}/reprise-8-limite.png` });

    step("9. Direct : doublon avant la limite, identifiant mal formé");
    const dup9 = await direct('upload', { token: TOKEN, client_id: r2.dup.cid, photo: '__jpeg__' });
    expect(dup9.status === 200 && dup9.body.duplicate === true && dup9.body.id === r2.dup.body.id, `identifiant connu renvoyé alors que la limite est atteinte : 200 « duplicate », même id (${dup9.body.id})`);
    const bad9 = await direct('upload', { token: TOKEN, client_id: 'zzz', photo: '__jpeg__' });
    expect(bad9.status === 400 && bad9.body.error === 'client_id', `identifiant mal formé refusé : 400 « ${bad9.body.error} »`);
    expect((await serverPhotos()).length === 8, 'toujours 8 photos au serveur');

    step("10. Album dévoilé avant l'envoi : photos gardées, lecture seule");
    const toDelete = ids8.slice(0, 2);
    for (const id of toDelete) {
      const d = await direct('admin-photo-delete', { id: String(id) });
      expect(d.status === 200, `photo ${id} supprimée par l'API admin`);
    }
    expect((await serverPhotos()).length === 6, 'le serveur a 6 photos');
    r4.mode = 'abort';
    await guest4.reload();
    await guest4.getByText('6 / 8 photos').waitFor({ timeout: 15000 });
    await shoot(guest4, 9);
    await guest4.waitForTimeout(500);
    await shoot(guest4, 10);
    await waitStatus(guest4, /Réseau indisponible\. 2 photos en attente/);
    await guest4.getByText('8 / 8 photos').waitFor({ timeout: 5000 });
    await until(async () => (await idbCount(guest4)) === 2, 'deux fiches dans IndexedDB');
    expect(true, '2 photos prises hors ligne, gardées (« 8 / 8 photos »)');
    await admin.reload();
    const h10 = admin.getByText(title, { exact: true }).first();
    await h10.waitFor();
    await h10.locator('xpath=ancestor::*[.//button[contains(., "Modifier")]][1]').getByRole('button', { name: 'Modifier' }).click();
    await admin.locator('#revealAt').fill(local(new Date(Date.now() - 60000)));
    await admin.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const h10b = admin.getByText(title, { exact: true }).first();
    await h10b.waitFor();
    expect((await h10b.locator('xpath=ancestor::*[.//button[contains(., "Modifier")]][1]').innerText()).includes('Révélé'), "l'admin a dévoilé l'album : état « Révélé »");
    const before10 = r4.resps.length;
    r4.mode = 'pass';
    await online(guest4);
    await until(() => r4.resps.length > before10, "l'envoi est refusé par le serveur");
    const c10 = r4.resps[r4.resps.length - 1];
    expect(c10.status === 403 && c10.body.error === 'closed', `le serveur refuse : 403 « ${c10.body.error} »`);
    await guest4.getByText(/2 photos prises sur ce téléphone n'ont pas pu être envoyées avant que l'album soit dévoilé\./).waitFor({ timeout: 10000 });
    expect(true, "message sur « Mes photos » : « 2 photos prises sur ce téléphone n'ont pas pu être envoyées avant que l'album soit dévoilé. »");
    expect((await guest4.locator('button[aria-label="Prendre la photo"]').count()) === 0, "l'appareil photo n'est plus proposé (lecture seule)");
    const k10 = await idb(guest4);
    expect(k10.queue.length === 2 && k10.queue.every((f) => f.state === 'failed' && f.reason === 'closed'), 'les 2 fiches sont gardées, marquées « failed / closed »');
    expect((await serverPhotos()).length === 6, 'le serveur a toujours 6 photos');
    await guest4.screenshot({ path: `${SHOTS}/reprise-10-album-devoile.png` });
    const sentBefore = r4.cids.length;
    await guest4.reload();
    await guest4.getByText(/2 photos prises sur ce téléphone n'ont pas pu être envoyées avant que l'album soit dévoilé\./).waitFor({ timeout: 10000 });
    await guest4.waitForTimeout(2500);
    expect(r4.cids.length === sentBefore, 'après rechargement : aucun nouvel envoi, le message des 2 photos est affiché de nouveau');
    expect((await idbCount(guest4)) === 2, 'les 2 fiches sont toujours gardées (jusqu\'à 7 jours)');

    expect(dialogs.length > 0, `boîte « beforeunload » ouverte puis acceptée quand des photos étaient en attente (${dialogs.join(' ; ')})`);
    return { ok: true, title, guestUrl, log, errors, dialogs };
  } catch (e) {
    const shots = {};
    for (const [n, p] of Object.entries({ admin, guest, guest2, guest3, guest4 })) {
      if (p && !p.isClosed()) { try { await p.screenshot({ path: `${SHOTS}/echec-reprise-${n}.png` }); shots[n] = p.url(); } catch {} }
    }
    try { await ctx.setOffline(false); } catch {}
    return { ok: false, title, error: String(e.message || e).slice(0, 1500), log, errors, shots, dialogs };
  }
};

  // Enregistrement du résultat : ce code tourne dans le serveur Playwright, sans accès direct aux fichiers.
  // Le résultat passe donc par le stockage local d'une page, puis est rangé dans .playwright-mcp/dernier-reprise.json.
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
    test: 'reprise',
    date: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
    debut: heure(debut),
    fin: heure(fin),
  });
  const fichier = '/Volumes/Mac500/DEV/OuiSnap-1/.playwright-mcp/dernier-reprise.json';
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
    test: 'reprise',
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
