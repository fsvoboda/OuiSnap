"use client";

import { Images, PencilSimple, Plus, QrCode, SignOut, Trash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { kindOf } from "@/lib/kinds";
import { uploadEventQr } from "@/lib/qr";
import { AlbumView } from "./album-view";
import { EventForm } from "./event-form";
import { EventLinks } from "./event-links";
import { PasswordReset } from "./password-reset";
import { buttonClass, formatDate, formatDay, inputClass, type AdminEvent, type AdminStatus } from "./types";

type View =
  | { kind: "list" }
  | { kind: "form"; event: AdminEvent | null }
  | { kind: "album"; event: AdminEvent };

function stateLabel(event: AdminEvent) {
  if (event.expired) return "Clôturé";
  if (event.revealed) return "Révélé";
  if (event.state === "upcoming") return "À venir";
  return "En cours";
}

const megabytes = (bytes: number) =>
  `${(bytes / 1_048_576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

// « 12 minutes », « 5 heures », « 3 jours ».
function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} heure${hours > 1 ? "s" : ""}`;
  return `${Math.floor(hours / 24)} jours`;
}

const CRON_WARNING =
  "Les e-mails d'ouverture et de révélation ne partent qu'à la visite du site.";

// Passage de la tâche planifiée (attendue chaque heure) et e-mails restés en file.
function MailStatus({ status }: { status: AdminStatus }) {
  const late = status.cronAge === null || status.cronAge > 2 * 3600;
  const plural = (count: number) => (count > 1 ? "s" : "");
  return (
    <div role="status" className="flex flex-col gap-1 text-sm leading-relaxed text-brume">
      {status.cronAge === null ? (
        <p className="text-[#f0a39e]">Tâche planifiée : aucun passage enregistré. {CRON_WARNING}</p>
      ) : late ? (
        <p className="text-[#f0a39e]">
          Tâche planifiée : aucun passage depuis {duration(status.cronAge)}. {CRON_WARNING}
        </p>
      ) : (
        <p>
          Tâche planifiée : dernier passage il y a {duration(status.cronAge)}
          {status.cronMode === "web" ? ", par un appel web" : ""}.
        </p>
      )}
      {status.mailsPending > 0 && (
        <p className="text-or-clair">
          {status.mailsPending} e-mail{plural(status.mailsPending)} en attente de nouvel essai
        </p>
      )}
      {status.mailsAbandoned > 0 && (
        <p className="text-[#f0a39e]">
          {status.mailsAbandoned} e-mail{plural(status.mailsAbandoned)} abandonné
          {plural(status.mailsAbandoned)}
        </p>
      )}
    </div>
  );
}

export function AdminApp() {
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [links, setLinks] = useState<number | null>(null); // album dont les liens sont dépliés
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null); // album dont la suppression attend confirmation
  const [deleting, setDeleting] = useState(false);
  const [reset, setReset] = useState<string | null>(null); // jeton du lien « mot de passe oublié » reçu par e-mail
  const [forgot, setForgot] = useState<"idle" | "sending" | "sent">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  async function remove(event: AdminEvent) {
    setDeleting(true);
    setError(null);
    try {
      await api("admin-event-delete", { id: String(event.id) });
      setRemoving(null);
      await load();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setDeleting(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const result = await api<{ events: AdminEvent[]; status?: AdminStatus }>("admin-events", {});
      setEvents(result.events);
      setStatus(result.status ?? null);
      setAuth("in");
      setError(null);
      // Événements sans image de QR code sur le serveur (créés avant cette fonction) : on la dépose.
      for (const event of result.events) {
        if (!event.hasQr) uploadEventQr(event.id, event.code).catch(() => {});
      }
    } catch (reason) {
      const failure = reason as ApiError;
      if (failure.status === 401) setAuth("out");
      else setError(failure.message);
    }
  }, []);

  useEffect(() => {
    // Le jeton du lien (#reset=<jeton>) est retiré de la barre d'adresse dès qu'il est lu.
    const readToken = () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("reset");
      if (token !== null) {
        setReset(token);
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    const first = setTimeout(() => {
      readToken();
      load();
    }, 0);
    // Page déjà ouverte : le clic sur le lien du mail ne recharge pas, seul le fragment change.
    window.addEventListener("hashchange", readToken);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", readToken);
    };
  }, [load]);

  async function login(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    setLoggingIn(true);
    setError(null);
    try {
      await api("admin-login", {
        password: String(new FormData(form.currentTarget).get("password") ?? ""),
      });
      setNotice(null);
      await load();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function forgotPassword() {
    setForgot("sending");
    setError(null);
    try {
      const result = await api<{ sentTo: string[] }>("admin-forgot", {});
      setNotice(
        `Un lien de réinitialisation vient d'être envoyé à ${result.sentTo.join(" et ")}. Il est valable une heure. Pensez à regarder dans les courriers indésirables.`,
      );
      setForgot("sent");
    } catch (reason) {
      setError((reason as ApiError).message);
      setForgot("idle");
    }
  }

  async function logout() {
    await api("admin-logout", {}).catch(() => {});
    setEvents([]);
    setView({ kind: "list" });
    setAuth("out");
  }

  if (reset !== null) {
    return (
      <PasswordReset
        token={reset}
        onBack={() => setReset(null)}
        onDone={() => {
          setReset(null);
          setEvents([]);
          setView({ kind: "list" });
          setAuth("out");
          setError(null);
          setNotice("Mot de passe modifié. Connectez-vous avec le nouveau.");
        }}
      />
    );
  }

  if (auth === "checking" && !error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p role="status" className="libelle animate-pulse text-brume">
          Chargement
        </p>
      </main>
    );
  }

  if (auth !== "in") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-2">
          <Logo className="text-4xl" />
          <p className="libelle text-or-clair">Administration</p>
        </div>
        <form onSubmit={login} className="flex w-full max-w-sm flex-col gap-2">
          {notice && (
            <p role="status" className="text-sm text-or-clair">
              {notice}
            </p>
          )}
          <label htmlFor="password" className="libelle text-brume">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            className={inputClass}
          />
          {error && (
            <p role="alert" className="text-sm text-[#f0a39e]">
              {error}
            </p>
          )}
          <button type="submit" disabled={loggingIn} className={`${buttonClass} mt-3 bg-or text-sapin-950`}>
            {loggingIn ? "Connexion…" : "Se connecter"}
          </button>
          <button
            type="button"
            onClick={forgotPassword}
            disabled={forgot !== "idle"}
            className="min-h-11 text-sm text-or-clair underline underline-offset-4 disabled:opacity-60"
          >
            {forgot === "sending" ? "Envoi…" : "Mot de passe oublié ?"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col gap-8 px-4 pb-16 md:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-creme/15 py-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <Logo className="text-3xl" />
          <p className="libelle text-or-clair">Administration</p>
        </div>
        <button type="button" onClick={logout} aria-label="Déconnexion"
          className={`${buttonClass} shrink-0 border border-creme/30`}>
          <SignOut size={18} />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </header>

      {view.kind === "form" && (
        <EventForm
          key={view.event?.id ?? "new"}
          event={view.event}
          onCancel={() => setView({ kind: "list" })}
          onSaved={() => {
            setView({ kind: "list" });
            load();
          }}
        />
      )}

      {view.kind === "album" && (
        <AlbumView
          event={view.event}
          onBack={() => {
            setView({ kind: "list" });
            load();
          }}
        />
      )}

      {view.kind === "list" && (
        <main className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-serif text-4xl">Événements</h1>
            <button
              type="button"
              onClick={() => setView({ kind: "form", event: null })}
              className={`${buttonClass} bg-or text-sapin-950`}
            >
              <Plus size={18} weight="bold" />
              Nouvel événement
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#f0a39e]">
              {error}
            </p>
          )}

          {status && <MailStatus status={status} />}

          {events.length === 0 && (
            <p className="py-10 text-center text-brume">
              Aucun événement pour l&apos;instant. Créez le premier avec « Nouvel événement ».
            </p>
          )}

          <ul className="flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-5 rounded-3xl bg-sapin-800 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-3xl leading-[1.1]">{event.title}</h2>
                    <p className="mt-1 text-sm text-brume">
                      {kindOf(event.kind).label}, code {event.code}
                    </p>
                  </div>
                  <p className="rounded-full border border-or/50 px-3 py-1 text-sm text-or-clair">
                    {stateLabel(event)}
                  </p>
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-brume">Début</dt>
                    <dd>{formatDate(event.startsAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-brume">Révélation</dt>
                    <dd>{formatDate(event.revealAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-brume">Clôture</dt>
                    <dd>{event.closesAt ? `${formatDay(event.closesAt)} au soir` : "aucune"}</dd>
                  </div>
                  <div>
                    <dt className="text-brume">Photographes</dt>
                    <dd className="tabular-nums">
                      {event.guests}
                      {event.maxGuests !== null ? ` sur ${event.maxGuests}` : " (illimité)"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-brume">Photos</dt>
                    <dd className="tabular-nums">
                      {event.photos} ({megabytes(event.bytes)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-brume">Maximum par photographe</dt>
                    <dd className="tabular-nums">
                      {event.maxPhotos === null ? "illimité" : `${event.maxPhotos} (+5 avec e-mail)`}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-brume">Organisateurs</dt>
                    <dd className="break-all">
                      {[event.organizerName, event.organizerEmail].filter(Boolean).join(", ") || "non renseignés"}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-brume">Message de révélation</dt>
                    <dd>
                      {event.emails} adresse{event.emails > 1 ? "s" : ""} e-mail recueillie
                      {event.emails > 1 ? "s" : ""},{" "}
                      {event.mailSentAt
                        ? `envoi fait le ${formatDate(event.mailSentAt)}`
                        : "envoi à la révélation"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setView({ kind: "album", event })}
                    className={`${buttonClass} border border-creme/30`}
                  >
                    <Images size={18} />
                    Voir les photos
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinks(links === event.id ? null : event.id)}
                    aria-expanded={links === event.id}
                    className={`${buttonClass} border border-creme/30`}
                  >
                    <QrCode size={18} />
                    QR code et liens
                  </button>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "form", event })}
                    className={`${buttonClass} border border-creme/30`}
                  >
                    <PencilSimple size={18} />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(event.id)}
                    aria-label={`Supprimer ${event.title}`}
                    title="Supprimer"
                    className="ml-auto grid size-11 place-items-center rounded-full border border-corail/60 text-[#f0a39e] transition-transform active:scale-95"
                  >
                    <Trash size={18} />
                  </button>
                </div>

                {removing === event.id && (
                  <div
                    role="alertdialog"
                    aria-label={`Supprimer ${event.title}`}
                    className="flex flex-col gap-4 rounded-2xl border border-corail/60 p-4"
                  >
                    <p className="leading-relaxed">
                      Supprimer définitivement « {event.title} » ?{" "}
                      {event.photos > 0
                        ? `Ses ${event.photos} photo${event.photos > 1 ? "s" : ""} seront effacées du serveur.`
                        : "Il ne contient aucune photo."}{" "}
                      Le QR code et le lien de l&apos;album ne fonctionneront plus. Cette action est
                      irréversible.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => remove(event)}
                        className={`${buttonClass} bg-corail text-sapin-950`}
                      >
                        <Trash size={18} weight="bold" />
                        {deleting ? "Suppression…" : "Supprimer définitivement"}
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setRemoving(null)}
                        className={`${buttonClass} border border-creme/30`}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {links === event.id && <EventLinks event={event} />}
              </li>
            ))}
          </ul>
        </main>
      )}
    </div>
  );
}
