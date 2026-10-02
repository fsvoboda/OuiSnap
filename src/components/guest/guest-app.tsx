"use client";

import { Check } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError, type EventInfo } from "@/lib/api";
import { kindOf } from "@/lib/kinds";
import { Camera } from "./camera";
import { MyPhotos } from "./my-photos";

type JoinResult = { token: string | null; name: string | null; event: EventInfo; count: number };
type Screen = "loading" | "welcome" | "camera" | "photos";

// Le jeton de l'invité reste sur son téléphone : il est reconnu s'il rescanne le QR code.
const storageKey = (code: string) => `ouisnap:invite:${code}`;
function readToken(code: string) {
  try {
    return localStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
}
function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(storageKey(code), token);
  } catch {
    // Navigation privée : la session durera le temps de la page.
  }
}

const plural = (count: number) => (count > 1 ? "photos" : "photo");

export function GuestApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [shots, setShots] = useState(0);
  const [joining, setJoining] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  // File d'envoi : les photos partent une à une, et attendent si le réseau tombe.
  const queue = useRef<Blob[]>([]);
  const sending = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const maxRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const scanned = (new URLSearchParams(window.location.search).get("c") ?? "").toUpperCase();
      try {
        if (!scanned) throw new ApiError("event", "Scannez le QR code posé sur votre table pour rejoindre l'album.", 404);
        const stored = readToken(scanned);
        const result = await api<JoinResult>("join", stored ? { code: scanned, token: stored } : { code: scanned });
        if (cancelled) return;
        setCode(scanned);
        setEvent(result.event);
        setClosed(result.event.state === "closed");
        maxRef.current = result.event.maxPhotos;
        if (result.token) {
          tokenRef.current = result.token;
          setToken(result.token);
          setCount(result.count);
          setScreen("camera");
        } else {
          setScreen("welcome");
        }
      } catch (reason) {
        if (!cancelled) setProblem((reason as ApiError).message);
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    while (queue.current.length > 0 && tokenRef.current) {
      try {
        const result = await api<{ count: number }>("upload", {
          token: tokenRef.current,
          photo: queue.current[0],
        });
        queue.current.shift();
        setCount(result.count);
        setStalled(false);
      } catch (reason) {
        const error = reason as ApiError;
        if (error.temporary) {
          setStalled(true);
          break;
        }
        // Refus définitif : la photo est retirée de la file et l'invité prévenu.
        queue.current.shift();
        if (error.code === "limit") {
          queue.current = [];
          if (maxRef.current !== null) setCount(maxRef.current);
        }
        // L'album vient d'être dévoilé : l'appli passe en lecture seule.
        if (error.code === "closed") {
          queue.current = [];
          setClosed(true);
        }
        setNotice(error.message);
      }
      setPending(queue.current.length);
    }
    setPending(queue.current.length);
    sending.current = false;
  }, []);

  // Réseau capricieux : nouvel essai régulier, et dès que la connexion revient.
  useEffect(() => {
    if (!stalled) return;
    const timer = setInterval(send, 6000);
    window.addEventListener("online", send);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", send);
    };
  }, [stalled, send]);

  // Évite de fermer la page tant que des photos ne sont pas parties.
  useEffect(() => {
    if (pending === 0) return;
    const warn = (unload: BeforeUnloadEvent) => unload.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  async function join(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const name = String(new FormData(form.currentTarget).get("name") ?? "").trim();
    if (!name) return setNameError(kindOf(event?.kind ?? "").nameNeeded);
    setJoining(true);
    setNameError(null);
    try {
      const result = await api<JoinResult>("join", { code, name });
      if (!result.token) throw new ApiError("name", "Ce prénom n'est pas valide.", 422);
      saveToken(code, result.token);
      tokenRef.current = result.token;
      setToken(result.token);
      setCount(result.count);
      setScreen("camera");
    } catch (reason) {
      setNameError((reason as ApiError).message);
    } finally {
      setJoining(false);
    }
  }

  const max = event?.maxPhotos ?? null;
  const taken = count + pending;
  const remaining = max === null ? null : Math.max(0, max - taken);

  function addShots(photos: Blob[]) {
    const accepted = remaining === null ? photos : photos.slice(0, remaining);
    if (accepted.length < photos.length) {
      setNotice(`Limite de ${max} photos atteinte : ${accepted.length} sur ${photos.length} ajoutées.`);
    } else {
      setNotice(null);
    }
    if (accepted.length === 0) return;
    queue.current.push(...accepted);
    setPending(queue.current.length);
    setShots((value) => value + 1);
    setLastShot((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(accepted[accepted.length - 1]);
    });
    send();
  }

  if (problem) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p role="alert" className="max-w-[30ch] font-serif text-2xl italic">
          {problem}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-full border border-or/60 px-7 text-sm font-medium text-or-clair active:scale-[0.98]"
        >
          Réessayer
        </button>
      </main>
    );
  }

  if (screen === "loading" || !event) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-sapin-900 text-creme">
        <Logo className="text-4xl" />
        <p role="status" className="libelle animate-pulse text-brume">
          Connexion à l&apos;album
        </p>
      </main>
    );
  }

  if (event.state === "expired") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p className="libelle text-or-clair">{event.title}</p>
        <p className="max-w-[26ch] font-serif text-2xl italic">
          Cet album est clôturé : il n&apos;est plus accessible.
        </p>
      </main>
    );
  }

  if (event.state === "upcoming") {
    const opens = event.opensAt ? new Date(event.opensAt) : null;
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p className="libelle text-or-clair">{event.title}</p>
        <p className="max-w-[26ch] font-serif text-2xl italic">
          L&apos;album n&apos;est pas encore ouvert.
          {opens && (
            <>
              {" "}
              Rendez-vous{" "}
              {opens.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à{" "}
              {opens.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-full border border-or/60 px-7 text-sm font-medium text-or-clair active:scale-[0.98]"
        >
          Réessayer
        </button>
      </main>
    );
  }

  if (closed) {
    if (token) return <MyPhotos token={token} readOnly onCount={setCount} />;
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p className="libelle text-or-clair">{event.title}</p>
        <p className="max-w-[28ch] font-serif text-2xl italic">
          L&apos;album a été dévoilé. Il n&apos;accepte plus de nouvelles photos.
        </p>
      </main>
    );
  }

  if (screen === "welcome") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-creme px-6 py-10 text-sapin-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-[#3f9a5f] text-creme">
            <Check size={44} weight="bold" />
          </span>
          <h1 className="font-serif text-5xl font-semibold leading-[1.1]">Connecté !</h1>
          <p className="libelle text-or-fonce">{kindOf(event.kind).album}</p>
          <p className="font-serif text-2xl italic">{event.title}</p>
        </div>

        <form onSubmit={join} className="flex w-full max-w-sm flex-col gap-2">
          <label htmlFor="name" className="libelle text-sapin-700">
            Votre prénom
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={40}
            autoComplete="given-name"
            aria-invalid={Boolean(nameError)}
            aria-describedby="name-aide"
            className="h-13 rounded-full border border-sapin-700/40 bg-white/60 px-6 text-base text-sapin-900 focus:border-sapin-900 focus:outline-none"
          />
          <p
            id="name-aide"
            role={nameError ? "alert" : undefined}
            className={`text-sm ${nameError ? "text-[#a3312c]" : "text-sapin-700"}`}
          >
            {nameError ?? kindOf(event.kind).seenBy}
          </p>
          <button
            type="submit"
            disabled={joining}
            className="mt-3 h-13 rounded-full bg-sapin-900 px-8 text-sm font-semibold tracking-wide text-creme transition-transform active:scale-[0.98] disabled:opacity-70"
          >
            {joining ? "Un instant…" : "Commencer à photographier"}
          </button>
          {max !== null && (
            <p className="mt-2 text-center text-sm text-sapin-700">
              Vous pouvez envoyer jusqu&apos;à {max} photos.
            </p>
          )}
        </form>
      </main>
    );
  }

  if (screen === "photos" && token) {
    return <MyPhotos token={token} onBack={() => setScreen("camera")} onCount={setCount} />;
  }

  const counter = max === null ? `${taken} ${plural(taken)}` : `${taken} / ${max} photos`;
  const status =
    notice ??
    (stalled
      ? `Réseau indisponible. ${pending} ${plural(pending)} en attente, nouvel essai automatique.`
      : pending > 0
        ? `Envoi de ${pending} ${plural(pending)}…`
        : remaining === 0
          ? `Vous avez envoyé vos ${max} photos. Merci !`
          : null);

  return (
    <Camera
      remaining={remaining}
      counter={counter}
      status={status}
      lastShot={lastShot}
      shots={shots}
      onShots={addShots}
      onOpenPhotos={() => setScreen("photos")}
    />
  );
}
