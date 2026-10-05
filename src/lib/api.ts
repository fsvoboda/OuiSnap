// Appels à l'API PHP servie à côté du site statique (public/api).

// upcoming : pas encore ouvert ; open : les invités photographient ;
// closed : album dévoilé, plus d'ajout ni de suppression ; expired : album clôturé, plus accessible.
export type EventInfo = {
  title: string;
  kind: string;
  maxPhotos: number | null; // limite de l'invité, bonus e-mail compris s'il l'a obtenu
  emailBonus: number; // photos offertes à qui laisse son e-mail (0 si l'album est illimité)
  state: "upcoming" | "open" | "closed" | "expired";
  opensAt: string | null;
};

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly foreign = false, // la réponse n'était pas du JSON : elle ne vient pas de l'API
  ) {
    super(message);
  }

  // Erreur passagère (réseau coupé, serveur en panne) : l'action peut être retentée telle quelle.
  get temporary() {
    return this.code === "network" || this.status >= 500;
  }

  // Pour la file d'envoi des photos : rien ne dit que le serveur a refusé, l'envoi peut repartir.
  // L'API répond toujours en JSON, refus compris : une page HTML vient d'un intermédiaire (portail Wi-Fi).
  get retryable() {
    return this.temporary || this.foreign || this.status === 429 || this.status === 408 || this.code === "timeout";
  }
}

const HORS_LIGNE = new ApiError("network", "Connexion impossible. Vérifiez votre réseau.", 0);

async function post(path: string, fields: Record<string, string | Blob>, signal?: AbortSignal) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") body.append(key, value);
    else body.append(key, value, "photo.jpg");
  }
  try {
    return await fetch(`/api/${path}.php`, { method: "POST", body, signal });
  } catch {
    throw HORS_LIGNE;
  }
}

// timeout : délai maximal en millisecondes, lecture de la réponse comprise ; signal : annulation par l'appelant.
// Sans option, l'appel dure aussi longtemps que le navigateur le laisse durer.
export async function api<T>(
  path: string,
  fields: Record<string, string | Blob>,
  options: { timeout?: number; signal?: AbortSignal } = {},
): Promise<T> {
  // AbortSignal.timeout et AbortSignal.any sont trop récents sur Safari : une minuterie et un seul contrôleur.
  const controller = new AbortController();
  let stopped = null as ApiError | null;
  const stop = (error: ApiError) => {
    stopped ??= error;
    controller.abort();
  };
  const cancel = () => stop(new ApiError("aborted", "", 0));
  const timer = options.timeout
    ? setTimeout(() => stop(new ApiError("timeout", "Connexion trop lente.", 0)), options.timeout)
    : undefined;
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel);

  try {
    const response = await post(path, fields, controller.signal);
    let data: { ok?: boolean; error?: string; message?: string };
    try {
      data = await response.json();
    } catch {
      throw new ApiError("server", "Le service est momentanément indisponible.", response.status || 500, true);
    }
    if (!data.ok) {
      throw new ApiError(data.error ?? "server", data.message ?? "Une erreur est survenue.", response.status);
    }
    return data as T;
  } catch (reason) {
    // Un appel interrompu échoue comme une coupure réseau : c'est la cause de l'interruption qui compte.
    throw stopped ?? reason;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

// "photo" : photo de l'invité connecté ; "album-photo" : photo de l'album, pour les mariés ;
// "admin-photo" : n'importe quelle photo, pour l'administrateur (session par cookie, jeton vide).
export type PhotoEndpoint = "photo" | "album-photo" | "admin-photo";

export async function fetchPhoto(
  endpoint: PhotoEndpoint,
  token: string,
  id: number,
  size: "thumb" | "full",
): Promise<Blob> {
  const response = await post(endpoint, { token, id: String(id), size });
  if (!response.ok) throw new ApiError("photo", "Photo introuvable.", response.status);
  return response.blob();
}
