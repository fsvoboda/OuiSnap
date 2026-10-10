// File d'envoi des photos d'un invité. Chaque photo est d'abord gardée sur le téléphone (photo-store),
// puis envoyée, une à la fois et dans l'ordre. Elle n'est effacée du téléphone qu'après l'accusé du serveur,
// ou sur un refus qui ne changera pas (limite atteinte, fichier invalide, album clôturé).
// Album dévoilé : une photo prise avant la révélation part encore ; sinon elle est gardée sans être renvoyée.
// Tout vit ici, hors de React : l'envoi continue quel que soit l'écran affiché, et reprend à la réouverture.
// Rien ne touche au navigateur à l'import : la page est prérendue en statique.
import { api, ApiError, type EventInfo } from "./api";
import { openStore, type PhotoStore, type QueuedPhoto } from "./photo-store";

// Ce qui retient la file : réseau coupé, connexion trop lente, serveur en défaut, album pas encore ouvert.
type Stalled = null | "network" | "slow" | "server" | "upcoming";

export type QueueSnapshot = {
  waiting: number; // photos à envoyer, celles en cours d'écriture comprises
  restored: number; // parmi elles, celles retrouvées à l'ouverture de la page
  blocked: number; // photos mises de côté après 5 essais : elles repartiront
  refused: number; // photos refusées faute d'être attestées prises avant la révélation : gardées, jamais renvoyées
  sent: number; // photos acquittées par le serveur depuis l'ouverture de la page
  stalled: Stalled;
  durable: boolean; // faux si des photos en attente ne tiennent qu'à la page ouverte
  awake: boolean; // l'envoi avance : l'écran doit rester allumé
};

export type QueueEvents = {
  onCount: (count: number) => void; // nombre de photos de l'invité, donné par le serveur
  onNotice: (message: string) => void;
  onLimit: (dropped: number) => void; // limite atteinte : photos retirées de la file
  onRevealed: () => void; // le serveur annonce un album dévoilé : plus de nouvelles photos
  onExpired: (lost: number) => void; // album clôturé : les photos en attente sont perdues
  onSessionLost: () => void; // l'invité n'est plus reconnu : il doit redonner son pseudo
  onGone: (message: string) => void; // l'événement n'existe plus
};

// « gone » : le QR code n'est plus reconnu, les photos gardées pour lui sont effacées.
type OpenState = EventInfo["state"] | "gone";
// next : passer à la suite ; pause : nouvel essai plus tard ; stop : plus rien ne partira sans action de l'invité.
type Outcome = "next" | "pause" | "stop";

const EMPTY: QueueSnapshot = {
  waiting: 0,
  restored: 0,
  blocked: 0,
  refused: 0,
  sent: 0,
  stalled: null,
  durable: true,
  awake: false,
};
const UNREADABLE = "1 photo en attente était illisible et n'a pas pu être envoyée.";

const KEEP_MS = 7 * 24 * 3600 * 1000; // au-delà, une photo jamais partie est effacée du téléphone
const MAX_ATTEMPTS = 5;
const RETRY_SECONDS = [6, 12, 24, 48, 60];
const UPCOMING_RETRY_SECONDS = 60;
const HIDDEN_ABORT_MS = 10_000;
const AWAKE_MS = 3 * 60 * 1000;
const JOIN_TIMEOUT_MS = 30_000;

// Délai maximal d'un envoi : 60 s, plus 30 s par Mo, plafonné à 3 minutes.
const uploadTimeout = (bytes: number) => Math.min(180_000, 60_000 + (30_000 * bytes) / (1024 * 1024));

// Même forme que les noms de fichier du serveur : 32 caractères hexadécimaux.
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Une image relue du téléphone est envoyée seulement si elle est entière et commence comme un JPEG.
function intact(buffer: ArrayBuffer | null, bytes: number): buffer is ArrayBuffer {
  if (!buffer || buffer.byteLength !== bytes || bytes < 2) return false;
  const start = new Uint8Array(buffer, 0, 2);
  return start[0] === 0xff && start[1] === 0xd8;
}

function createUploadQueue() {
  let store: PhotoStore | null = null;
  let opened: Promise<void> | null = null;
  let code = "";
  let token: string | null = null;
  let events: QueueEvents | null = null;

  let photos: QueuedPhoto[] = []; // fiches de l'événement, dans l'ordre d'envoi
  let unsaved = 0; // photos ajoutées dont l'écriture n'est pas terminée
  let sent = 0; // photos acquittées par le serveur depuis l'ouverture de la page
  const found = new Set<number>(); // fiches retrouvées à l'ouverture
  const dead = new Set<string>(); // jetons que le serveur ne reconnaît plus
  let writes = Promise.resolve();

  let stalled: Stalled = null;
  let running = false;
  let flight: AbortController | null = null; // envoi en vol
  let vanished = false; // une fiche a disparu : un autre onglet l'a envoyée
  let timer: ReturnType<typeof setTimeout> | undefined; // prochain essai programmé, undefined s'il n'y en a pas
  let step = 0; // rang dans RETRY_SECONDS
  let hiddenAt = 0;
  let progressAt = 0;
  let awakeTimer: ReturnType<typeof setTimeout> | undefined;

  let snapshot = EMPTY;
  const listeners = new Set<() => void>();

  const waiting = () => photos.filter((photo) => photo.state === "waiting");

  // L'instantané est remplacé, jamais modifié : React compare les références.
  function emit() {
    const pending = waiting();
    const count = pending.length + unsaved;
    const refused = photos.filter((photo) => photo.state === "failed" && photo.reason === "late").length;
    const next: QueueSnapshot = {
      waiting: count,
      restored: pending.filter((photo) => found.has(photo.seq)).length,
      blocked: photos.length - pending.length - refused,
      refused,
      sent,
      stalled: count > 0 ? stalled : null,
      durable: store?.durable ?? true,
      awake: count > 0 && Date.now() - progressAt < AWAKE_MS,
    };
    if ((Object.keys(next) as (keyof QueueSnapshot)[]).every((key) => next[key] === snapshot[key])) return;
    snapshot = next;
    listeners.forEach((notify) => notify());
  }

  // Ajout, accusé ou reprise : l'écran reste allumé trois minutes de plus.
  function progress() {
    progressAt = Date.now();
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(emit, AWAKE_MS + 100);
  }

  const drop = (gone: QueuedPhoto[]) => {
    photos = photos.filter((photo) => !gone.includes(photo));
    return Promise.all(gone.map((photo) => store!.remove(photo.seq)));
  };

  const change = (photo: QueuedPhoto, patch: Partial<QueuedPhoto>) => {
    Object.assign(photo, patch);
    return store!.update(photo.seq, patch);
  };

  // Échec qui ne dit rien de la photo : compté, et au cinquième elle est mise de côté pour laisser passer les suivantes.
  async function failure(photo: QueuedPhoto, reason: string): Promise<Outcome> {
    if (photo.attempts + 1 >= MAX_ATTEMPTS) {
      await change(photo, { attempts: photo.attempts + 1, state: "failed", reason });
      stalled = null;
      return "next";
    }
    await change(photo, { attempts: photo.attempts + 1 });
    stalled = reason === "timeout" ? "slow" : "server";
    return "pause";
  }

  // L'événement a été supprimé : plus rien ne partira, les photos gardées pour lui sont effacées.
  async function gone(error: ApiError): Promise<Outcome> {
    await drop(photos);
    events?.onGone(error.message);
    return "stop";
  }

  // Album pas encore ouvert : on demande son état au serveur (quelques octets) plutôt que de renvoyer la photo
  // entière à chaque essai. Rend null quand la photo peut repartir.
  async function stillUpcoming(photo: QueuedPhoto): Promise<Outcome | null> {
    try {
      const result = await api<{ event: EventInfo }>(
        "join",
        { code, token: photo.token },
        { timeout: JOIN_TIMEOUT_MS },
      );
      return result.event.state === "upcoming" ? "pause" : null;
    } catch (reason) {
      const error = reason as ApiError;
      return error.code === "event" ? gone(error) : "pause";
    }
  }

  // « Session expirée » peut cacher un envoi trop gros pour le serveur, qui n'a alors rien pu lire :
  // on demande au serveur s'il connaît encore l'invité avant de conclure.
  async function checkSession(photo: QueuedPhoto): Promise<Outcome> {
    let known: boolean;
    try {
      const result = await api<{ token: string | null }>(
        "join",
        { code, token: photo.token },
        { timeout: JOIN_TIMEOUT_MS },
      );
      known = result.token !== null;
    } catch (reason) {
      const error = reason as ApiError;
      if (error.code === "event") return gone(error);
      stalled = error.code === "network" ? "network" : error.code === "timeout" ? "slow" : "server";
      return "pause";
    }
    if (known) return failure(photo, "session");
    dead.add(photo.token);
    // L'invité s'est réinscrit depuis : la photo partira sous son nouveau jeton.
    if (token && token !== photo.token) return "next";
    token = null;
    events?.onSessionLost();
    return "stop";
  }

  async function sendOne(photo: QueuedPhoto): Promise<Outcome> {
    if (stalled === "upcoming") {
      const wait = await stillUpcoming(photo);
      if (wait) return wait;
    }
    if (token && dead.has(photo.token)) await change(photo, { token });

    // Relecture juste avant l'envoi : l'image n'est en mémoire que le temps de partir.
    let record: Awaited<ReturnType<PhotoStore["get"]>>;
    try {
      record = await store!.get(photo.seq);
    } catch {
      stalled = "server";
      return "pause";
    }
    if (!record) {
      photos = photos.filter((other) => other !== photo);
      vanished = true;
      return "next";
    }
    if (!intact(record.buffer, photo.bytes)) {
      await drop([photo]);
      events?.onNotice(UNREADABLE);
      return "next";
    }

    flight = new AbortController();
    try {
      const result = await api<{ count: number; state?: string }>(
        "upload",
        {
          token: photo.token,
          client_id: photo.id,
          // Date de prise : elle permet à une photo prise avant la révélation de partir encore après.
          taken_at: String(photo.createdAt),
          photo: new Blob([record.buffer], { type: "image/jpeg" }),
        },
        { timeout: uploadTimeout(photo.bytes), signal: flight.signal },
      );
      await drop([photo]);
      sent += 1;
      stalled = null;
      step = 0;
      progress();
      // Le compteur du serveur est celui de l'invité qui a pris la photo, pas forcément celui de la session.
      if (photo.token === token) events?.onCount(result.count);
      // Le serveur dit l'état de l'album : s'il est dévoilé, l'appareil photo n'est plus proposé.
      if (result.state === "closed") events?.onRevealed();
      // Les photos mises de côté retentent leur chance, après celles qui attendent. Pas celles refusées (« late »).
      const aside = photos.filter((other) => other.state === "failed" && other.reason !== "late");
      if (aside.length > 0) {
        await Promise.all(aside.map((other) => change(other, { state: "waiting", attempts: 0, reason: undefined })));
        photos = [...photos.filter((other) => !aside.includes(other)), ...aside];
      }
      return "next";
    } catch (reason) {
      const error = reason as ApiError;
      // Envoi gelé pendant que la page était masquée : il repart, sans compter d'essai
      if (error.code === "aborted") return "next";
      if (error.code === "network") {
        stalled = "network";
        return "pause";
      }
      // Délai dépassé, serveur en défaut, réponse d'un intermédiaire : rien ne dit que la photo est refusée.
      if (error.retryable) return failure(photo, error.code);
      switch (error.code) {
        case "upcoming":
          stalled = "upcoming";
          return "pause";
        case "limit": {
          // La limite est celle de l'invité qui a pris la photo : les fiches d'un autre jeton ne sont pas concernées.
          const dropped = waiting().filter((other) => other.token === photo.token);
          await drop(dropped);
          if (photo.token === token) events?.onLimit(dropped.length);
          return "next";
        }
        case "closed":
          // Album dévoilé et photo non attestée prise avant la révélation : elle ne partira pas.
          // Gardée quand même (une horloge mal réglée ne doit pas faire perdre une photo), jamais renvoyée.
          await change(photo, { state: "failed", reason: "late" });
          events?.onRevealed();
          return "next";
        case "expired": {
          const lost = photos.length;
          await drop(photos);
          events?.onExpired(lost);
          return "stop";
        }
        case "session":
          return checkSession(photo);
        case "size":
        case "format":
          await drop([photo]);
          events?.onNotice(error.message);
          return "next";
        default: // refus inattendu : dans le doute, la photo est gardée
          return failure(photo, error.code);
      }
    } finally {
      flight = null;
    }
  }

  // Une photo envoyée par un autre onglet : le compteur est redemandé au serveur.
  async function recount() {
    if (!token) return;
    try {
      const result = await api<{ count: number }>("join", { code, token }, { timeout: JOIN_TIMEOUT_MS });
      events?.onCount(result.count);
    } catch {
      // Compteur non rafraîchi : il le sera au prochain envoi.
    }
  }

  async function run() {
    if (running || !store || !token) return;
    running = true;
    clearTimeout(timer);
    timer = undefined;
    let outcome: Outcome = "next";
    try {
      while (outcome === "next" && token) {
        const photo = photos.find((item) => item.state === "waiting");
        if (!photo) {
          stalled = null;
          break;
        }
        outcome = await sendOne(photo);
        emit();
      }
    } catch {
      // Erreur imprévue : traitée comme un défaut passager, la photo reste sur le téléphone.
      stalled = "server";
      outcome = "pause";
    }
    running = false;
    if (outcome === "pause") {
      const seconds =
        stalled === "upcoming" ? UPCOMING_RETRY_SECONDS : RETRY_SECONDS[Math.min(step, RETRY_SECONDS.length - 1)];
      step += 1;
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, seconds * 1000);
    }
    if (vanished) {
      vanished = false;
      recount();
    }
    emit();
  }

  // Un déclencheur (photo ajoutée, réseau revenu, page de retour) : nouvel essai tout de suite, délais remis à zéro.
  // Sauf quand le serveur est en défaut ou la connexion trop lente : chaque essai est compté, et cinq photos prises
  // coup sur coup pendant une panne épuiseraient les essais en quelques secondes. L'essai déjà programmé suffit.
  // « force » : le réseau vient de revenir, c'est le moment de réessayer.
  function kick(force = false) {
    if (!force && timer !== undefined && (stalled === "server" || stalled === "slow")) return;
    step = 0;
    run();
  }

  function resume() {
    // Au retour d'une longue mise en veille, l'envoi en vol est sans doute mort sans le dire : il est relancé.
    if (flight && hiddenAt && Date.now() - hiddenAt > HIDDEN_ABORT_MS) flight.abort();
    hiddenAt = 0;
    progress();
    emit();
    kick();
  }

  async function start(state: OpenState) {
    store = await openStore();
    await store.purge(Date.now() - KEEP_MS);
    const saved = await store.list(code);

    if (state === "expired" || state === "gone") {
      await Promise.all(saved.map((photo) => store!.remove(photo.seq)));
      if (state === "expired" && saved.length > 0) events?.onExpired(saved.length);
    } else {
      // Album dévoilé compris : les photos prises avant la révélation peuvent encore rejoindre l'album.
      photos = saved;
      // Nouvelle ouverture : les photos mises de côté retentent leur chance. Celles qu'une ancienne version
      // avait bloquées (reason « closed ») repartent aussi : c'est tout l'objet du changement.
      await Promise.all(
        photos
          .filter((photo) => photo.state === "failed" && photo.reason !== "late")
          .map((photo) => change(photo, { state: "waiting", attempts: 0, reason: undefined })),
      );
      photos.forEach((photo) => found.add(photo.seq));
    }

    // Écouteurs posés une fois pour toute la vie de la page, comme la file elle-même.
    window.addEventListener("online", () => kick(true));
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) resume();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resume();
      else hiddenAt = Date.now();
    });

    if (photos.length > 0) progress();
    emit();
    kick();
  }

  return {
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,

    // À appeler une fois la réponse de « join » connue. Un second appel ne fait que remplacer les réactions.
    open(eventCode: string, state: OpenState, reactions: QueueEvents) {
      events = reactions;
      if (!opened) {
        code = eventCode;
        opened = start(state);
      }
      return opened;
    },

    // null : l'invité n'est pas (ou plus) inscrit, rien ne part.
    setToken(value: string | null) {
      token = value;
      if (value) kick();
    },

    // Les photos comptent tout de suite dans l'instantané ; elles sont écrites puis envoyées à la suite.
    add(blobs: Blob[]) {
      unsaved += blobs.length;
      progress();
      emit();
      for (const blob of blobs) {
        writes = writes.then(async () => {
          try {
            await opened;
            const buffer = await blob.arrayBuffer();
            const photo = await store!.add(
              { id: newId(), code, token: token ?? "", createdAt: Date.now(), bytes: buffer.byteLength, attempts: 0, state: "waiting" },
              buffer,
            );
            photos = [...photos, photo];
          } catch {
            events?.onNotice(UNREADABLE);
          }
          unsaved -= 1;
          emit();
          kick();
        });
      }
    },

    kick: () => kick(),
  };
}

export const uploadQueue = createUploadQueue();
