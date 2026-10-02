"use client";

import { Images, PencilSimple, Plus, QrCode, SignOut } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { kindOf } from "@/lib/kinds";
import { AlbumView } from "./album-view";
import { EventForm } from "./event-form";
import { EventLinks } from "./event-links";
import { buttonClass, formatDate, formatDay, inputClass, type AdminEvent } from "./types";

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

export function AdminApp() {
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [links, setLinks] = useState<number | null>(null); // album dont les liens sont dépliés
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ events: AdminEvent[] }>("admin-events", {});
      setEvents(result.events);
      setAuth("in");
      setError(null);
    } catch (reason) {
      const failure = reason as ApiError;
      if (failure.status === 401) setAuth("out");
      else setError(failure.message);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function login(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    setLoggingIn(true);
    setError(null);
    try {
      await api("admin-login", {
        password: String(new FormData(form.currentTarget).get("password") ?? ""),
      });
      await load();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await api("admin-logout", {}).catch(() => {});
    setEvents([]);
    setView({ kind: "list" });
    setAuth("out");
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
        </form>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col gap-8 px-4 pb-16 md:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-creme/15 py-4">
        <div className="flex items-baseline gap-4">
          <Logo className="text-3xl" />
          <p className="libelle text-or-clair">Administration</p>
        </div>
        <button type="button" onClick={logout} className={`${buttonClass} border border-creme/30`}>
          <SignOut size={18} />
          Déconnexion
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
                    <dd className="tabular-nums">{event.maxPhotos ?? "illimité"}</dd>
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
                </div>

                {links === event.id && <EventLinks event={event} />}
              </li>
            ))}
          </ul>
        </main>
      )}
    </div>
  );
}
