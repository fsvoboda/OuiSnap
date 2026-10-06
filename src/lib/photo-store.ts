// Photos en attente d'envoi, gardées sur le téléphone (IndexedDB) : elles survivent à la fermeture de la page.
// Deux magasins : « queue » pour les fiches, « bytes » pour les images. À la réouverture, seules les fiches
// sont chargées : quarante photos de 2 Mo en mémoire feraient fermer l'onglet par le téléphone.
// L'image est gardée en ArrayBuffer et non en Blob : sur iPhone, un Blob relu après réouverture peut être vide.

export type QueuedPhoto = {
  seq: number; // clé donnée par la base : l'ordre des seq est l'ordre d'envoi
  id: string; // identifiant envoyé au serveur, qui reconnaît ainsi une photo déjà reçue
  code: string; // code de l'événement
  token: string; // jeton de l'invité au moment de la prise
  createdAt: number;
  bytes: number; // poids de l'image, recontrôlé à la relecture
  attempts: number; // essais qui ont échoué avec une réponse ou un délai dépassé
  state: "waiting" | "failed";
  reason?: string; // code d'erreur d'une fiche « failed » ; « late » = refusée parce qu'elle n'est pas attestée prise avant la révélation (jamais retentée)
};

export type PhotoStore = {
  // Faux dès qu'une photo en attente n'est gardée qu'en mémoire : elle serait perdue à la fermeture de la page.
  readonly durable: boolean;
  list(code: string): Promise<QueuedPhoto[]>;
  add(photo: Omit<QueuedPhoto, "seq">, buffer: ArrayBuffer): Promise<QueuedPhoto>;
  // null : la fiche n'existe plus (envoyée depuis un autre onglet). Rejette si le stockage ne répond pas.
  get(seq: number): Promise<{ photo: QueuedPhoto; buffer: ArrayBuffer | null } | null>;
  update(seq: number, patch: Partial<QueuedPhoto>): Promise<void>;
  remove(seq: number): Promise<void>;
  purge(before: number): Promise<void>; // supprime les fiches créées avant cette date, tous événements confondus
};

const OPEN_TIMEOUT_MS = 3000;
const TRANSACTION_TIMEOUT_MS = 8000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Sur certains Safari, l'ouverture ne répond jamais : passé ce délai, on fait sans.
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      reject(new Error("IndexedDB ne répond pas"));
    }, OPEN_TIMEOUT_MS);
    const failed = (reason: unknown) => {
      clearTimeout(timer);
      reject(reason);
    };
    try {
      const request = indexedDB.open("ouisnap", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("queue", { keyPath: "seq", autoIncrement: true }).createIndex("code", "code");
        request.result.createObjectStore("bytes");
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (late) return request.result.close();
        resolve(request.result);
      };
      request.onerror = () => failed(request.error);
    } catch (reason) {
      // Pas d'IndexedDB du tout, ou accès interdit par le navigateur.
      failed(reason);
    }
  });
}

type Work<T> = (queue: IDBObjectStore, bytes: IDBObjectStore) => () => T;

// Une transaction sur les deux magasins, résolue quand tout est écrit pour de bon.
// « work » lance les demandes et rend de quoi lire leur résultat une fois la transaction terminée.
function transact<T>(database: IDBDatabase, mode: IDBTransactionMode, work: Work<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["queue", "bytes"], mode);
    // Sur iPhone, la base d'une page revenue de l'arrière-plan peut ne plus répondre du tout :
    // sans ce délai, l'écriture d'une photo ne finirait jamais et bloquerait les suivantes.
    const timer = setTimeout(() => {
      reject(new Error("IndexedDB ne répond pas"));
      try {
        transaction.abort();
      } catch {
        // Transaction déjà terminée entre-temps.
      }
    }, TRANSACTION_TIMEOUT_MS);
    const result = work(transaction.objectStore("queue"), transaction.objectStore("bytes"));
    // Une transaction qui aboutit après le délai n'a plus d'effet ici. Si c'était l'écriture d'une photo,
    // sa fiche existe alors en double : elle partira deux fois sous le même identifiant, le serveur n'en garde qu'une.
    transaction.oncomplete = () => {
      clearTimeout(timer);
      resolve(result());
    };
    transaction.onabort = () => {
      clearTimeout(timer);
      reject(transaction.error ?? new Error("Transaction annulée"));
    };
  });
}

// Nombre de photos gardées pour un événement, lu sans ouvrir la file d'envoi. 0 si le stockage ne répond pas.
export async function countStored(code: string): Promise<number> {
  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase();
    return await transact(database, "readonly", (queue) => {
      const request = queue.index("code").count(code);
      return () => request.result;
    });
  } catch {
    return 0;
  } finally {
    database?.close();
  }
}

// Ne rejette jamais : sans IndexedDB (ou s'il ne répond pas), les photos sont gardées en mémoire.
export async function openStore(): Promise<PhotoStore> {
  let database: IDBDatabase | null = null;
  let available = true;
  try {
    database = await openDatabase();
  } catch {
    available = false;
  }

  // Photos que le téléphone n'a pas pu enregistrer. Leurs seq sont négatifs, pour ne pas croiser ceux de la base.
  const memory = new Map<number, { photo: QueuedPhoto; buffer: ArrayBuffer }>();
  let lastMemorySeq = 0;

  // Le téléphone peut fermer la base d'une page restée en arrière-plan : une réouverture, un second essai.
  async function run<T>(mode: IDBTransactionMode, work: Work<T>): Promise<T> {
    if (!available) throw new Error("IndexedDB indisponible");
    try {
      database ??= await openDatabase();
      return await transact(database, mode, work);
    } catch {
      database?.close();
      database = null;
      database = await openDatabase();
      return transact(database, mode, work);
    }
  }

  return {
    get durable() {
      return available && memory.size === 0;
    },

    async list(code) {
      let saved: QueuedPhoto[] = [];
      try {
        saved = await run("readonly", (queue) => {
          const request = queue.index("code").getAll(code);
          return () => request.result as QueuedPhoto[];
        });
      } catch {
        // Stockage illisible : les photos qu'il contient seront retrouvées à une prochaine ouverture.
      }
      const kept = [...memory.values()].map((entry) => entry.photo).filter((photo) => photo.code === code);
      return [...saved, ...kept];
    },

    async add(photo, buffer) {
      try {
        return await run("readwrite", (queue, bytes) => {
          const request = queue.add(photo);
          request.onsuccess = () => bytes.put(buffer, request.result);
          return () => ({ ...photo, seq: request.result as number });
        });
      } catch {
        // Stockage plein ou refusé : la photo reste en mémoire, elle partira tant que la page est ouverte.
        lastMemorySeq -= 1;
        const kept = { ...photo, seq: lastMemorySeq };
        memory.set(kept.seq, { photo: kept, buffer });
        return kept;
      }
    },

    async get(seq) {
      if (seq < 0) return memory.get(seq) ?? null;
      return run("readonly", (queue, bytes) => {
        const photo = queue.get(seq);
        const buffer = bytes.get(seq);
        return () =>
          photo.result
            ? { photo: photo.result as QueuedPhoto, buffer: buffer.result instanceof ArrayBuffer ? buffer.result : null }
            : null;
      });
    },

    // Les trois écritures qui suivent n'échouent jamais aux yeux de l'appelant. Au pire, une fiche
    // qui aurait dû disparaître repart à la prochaine ouverture, et le serveur reconnaît la photo.
    async update(seq, patch) {
      const kept = memory.get(seq);
      if (kept) kept.photo = { ...kept.photo, ...patch };
      if (seq < 0) return;
      try {
        await run("readwrite", (queue) => {
          const request = queue.get(seq);
          request.onsuccess = () => {
            if (request.result) queue.put({ ...request.result, ...patch });
          };
          return () => undefined;
        });
      } catch {}
    },

    async remove(seq) {
      if (seq < 0) {
        memory.delete(seq);
        return;
      }
      try {
        await run("readwrite", (queue, bytes) => {
          queue.delete(seq);
          bytes.delete(seq);
          return () => undefined;
        });
      } catch {}
    },

    async purge(before) {
      try {
        await run("readwrite", (queue, bytes) => {
          const request = queue.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            if ((cursor.value as QueuedPhoto).createdAt < before) {
              bytes.delete(cursor.primaryKey);
              cursor.delete();
            }
            cursor.continue();
          };
          return () => undefined;
        });
      } catch {}
    },
  };
}
