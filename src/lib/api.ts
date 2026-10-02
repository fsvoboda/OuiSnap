// Appels à l'API PHP servie à côté du site statique (public/api).

export type EventInfo = { title: string; maxPhotos: number | null };

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  // Erreur passagère (réseau coupé, serveur en panne) : l'action peut être retentée telle quelle.
  get temporary() {
    return this.code === "network" || this.status >= 500;
  }
}

const HORS_LIGNE = new ApiError("network", "Connexion impossible. Vérifiez votre réseau.", 0);

async function post(path: string, fields: Record<string, string | Blob>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") body.append(key, value);
    else body.append(key, value, "photo.jpg");
  }
  try {
    return await fetch(`/api/${path}.php`, { method: "POST", body });
  } catch {
    throw HORS_LIGNE;
  }
}

export async function api<T>(path: string, fields: Record<string, string | Blob>): Promise<T> {
  const response = await post(path, fields);
  let data: { ok?: boolean; error?: string; message?: string };
  try {
    data = await response.json();
  } catch {
    throw new ApiError("server", "Le service est momentanément indisponible.", response.status || 500);
  }
  if (!data.ok) {
    throw new ApiError(data.error ?? "server", data.message ?? "Une erreur est survenue.", response.status);
  }
  return data as T;
}

export async function fetchPhoto(token: string, id: number, size: "thumb" | "full"): Promise<Blob> {
  const response = await post("photo", { token, id: String(id), size });
  if (!response.ok) throw new ApiError("photo", "Photo introuvable.", response.status);
  return response.blob();
}
