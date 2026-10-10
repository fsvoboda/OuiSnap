"use client";

import { Check } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError, type EventInfo } from "@/lib/api";
import { INVITE_PSEUDO, kindOf } from "@/lib/kinds";
import { countStored } from "@/lib/photo-store";
import { uploadQueue, type QueueSnapshot } from "@/lib/upload-queue";
import { useWakeLock } from "@/lib/wake-lock";
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

function forgetToken(code: string) {
  try {
    localStorage.removeItem(storageKey(code));
  } catch {
    // Rien à oublier si le stockage n'est pas accessible.
  }
}

// Premier contact avec le serveur : délai maximal, puis nouveaux essais automatiques de plus en plus espacés.
const JOIN_TIMEOUT_MS = 30_000;
const JOIN_RETRY_SECONDS = [6, 12, 24, 48, 60];

const plural = (count: number) => (count > 1 ? "photos" : "photo");
const notSent = (count: number) => (count > 1 ? "n'ont pas pu être envoyées" : "n'a pas pu être envoyée");

// Ce que l'invité lit sous l'appareil photo tant que des photos ne sont pas parties.
function sendingStatus({ waiting, restored, blocked, stalled, durable }: QueueSnapshot) {
  const left = `${waiting} ${plural(waiting)} en attente`;
  if (waiting === 0) {
    if (blocked === 0) return null;
    const kept = blocked > 1 ? "Elles restent sur ce téléphone" : "Elle reste sur ce téléphone";
    return durable
      ? `${blocked} ${plural(blocked)} ${notSent(blocked)}. ${kept}, nouvel essai à la prochaine ouverture.`
      : `${blocked} ${plural(blocked)} ${notSent(blocked)}.`;
  }
  if (stalled === "network") {
    return durable
      ? `Réseau indisponible. ${left}, ${waiting > 1 ? "gardées" : "gardée"} sur ce téléphone.`
      : `Réseau indisponible. ${left} : ne fermez pas cette page.`;
  }
  if (stalled === "slow") return `Connexion lente. ${left} : gardez cette page ouverte.`;
  if (stalled) return `Envoi momentanément impossible. ${left}, nouvel essai automatique.`;
  if (!durable) return `${left}. Ne fermez pas cette page : ce navigateur ne ${waiting > 1 ? "les" : "la"} garde pas.`;
  if (restored > 0) {
    return `${restored} ${plural(restored)} ${restored > 1 ? "retrouvées" : "retrouvée"}, envoi en cours…`;
  }
  return `Envoi de ${waiting} ${plural(waiting)}…${waiting >= 3 ? " Gardez cette page ouverte." : ""}`;
}

// Ce que l'invité lit sur « Mes photos » après la révélation, pendant que ses photos prises avant partent encore.
function revealedStatus({ waiting, blocked, refused, sent, stalled, durable }: QueueSnapshot) {
  if (waiting > 0) {
    const many = waiting > 1;
    const left = `${waiting} ${plural(waiting)} ${many ? "prises" : "prise"} avant la révélation`;
    if (stalled === "network")
      return `${left} ${many ? "sont encore" : "est encore"} en attente. ${many ? "Elles partiront" : "Elle partira"} dès que la connexion reviendra.`;
    if (stalled === "slow") return `Connexion lente. ${left} ${many ? "attendent" : "attend"} encore : gardez cette page ouverte.`;
    if (stalled) return `Envoi momentanément impossible. ${left} ${many ? "attendent" : "attend"} encore, nouvel essai automatique.`;
    if (!durable)
      return `${left} ${many ? "partent" : "part"} vers l'album. Ne fermez pas cette page : ce navigateur ne ${many ? "les" : "la"} garde pas.`;
    return `${left} ${many ? "partent" : "part"} vers l'album. Gardez cette page ouverte.`;
  }
  if (blocked > 0) {
    const kept = blocked > 1 ? "Elles restent sur ce téléphone" : "Elle reste sur ce téléphone";
    return `${blocked} ${plural(blocked)} ${notSent(blocked)}. ${kept}, nouvel essai à la prochaine ouverture.`;
  }
  if (refused > 0)
    return `${refused} ${plural(refused)} ${refused > 1 ? "n'ont pas pu rejoindre" : "n'a pas pu rejoindre"} l'album : ${refused > 1 ? "elles n'ont pas été prises" : "elle n'a pas été prise"} avant la révélation.`;
  if (sent > 0)
    return `${sent} ${plural(sent)} ${sent > 1 ? "prises" : "prise"} avant la révélation ${sent > 1 ? "ont rejoint" : "a rejoint"} l'album.`;
  return null;
}

export function GuestApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [shots, setShots] = useState(0);
  const [joining, setJoining] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  // Photos restées sur le téléphone parce que l'album a été clôturé avant leur envoi.
  const [lost, setLost] = useState(0);
  // Photos gardées sur le téléphone, comptées quand la page s'ouvre sans réseau.
  const [kept, setKept] = useState(0);
  const maxRef = useRef<number | null>(null);

  // File d'envoi : les photos sont gardées sur le téléphone, partent une à une, et attendent si le réseau tombe.
  const queue = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot, uploadQueue.getServerSnapshot);
  useWakeLock(queue.awake);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let tries = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let listening = false;

    // Page rouverte sans réseau : la connexion à l'album est retentée toute seule, sans attendre « Réessayer ».
    const again = () => {
      if (document.visibilityState === "visible") start();
    };
    function stopRetrying() {
      clearTimeout(retry);
      if (!listening) return;
      listening = false;
      window.removeEventListener("online", start);
      document.removeEventListener("visibilitychange", again);
    }

    async function start() {
      if (busy || cancelled) return;
      busy = true;
      clearTimeout(retry);
      const query = new URLSearchParams(window.location.search);
      const scanned = (query.get("c") ?? "").toUpperCase();
      try {
        if (!scanned) throw new ApiError("event", "Scannez le QR code posé sur votre table pour rejoindre l'album.", 404);
        // Lien personnel reçu par e-mail : il rouvre la session, puis le jeton est retiré de l'adresse.
        const linked = query.get("t") ?? "";
        if (/^[a-f0-9]{48}$/.test(linked)) {
          saveToken(scanned, linked);
          window.history.replaceState(null, "", `${window.location.pathname}?c=${scanned}`);
        }
        const stored = /^[a-f0-9]{48}$/.test(linked) ? linked : readToken(scanned);
        const result = await api<JoinResult>(
          "join",
          stored ? { code: scanned, token: stored } : { code: scanned },
          { timeout: JOIN_TIMEOUT_MS },
        );
        if (cancelled) return;
        stopRetrying();
        setProblem(null);
        setKept(0);
        // Sans l'attendre : les photos restées sur le téléphone repartent pendant que l'écran s'affiche.
        uploadQueue.open(scanned, result.event.state, {
          onCount: setCount,
          onNotice: setNotice,
          onLimit(dropped) {
            if (maxRef.current !== null) setCount(maxRef.current);
            setNotice(
              `Limite de ${maxRef.current} ${plural(maxRef.current ?? 0)} atteinte : ${dropped} ${plural(dropped)} ${dropped > 1 ? "n'ont pas été envoyées" : "n'a pas été envoyée"}.`,
            );
          },
          // L'album vient d'être dévoilé : lecture seule, mais les photos déjà prises partent encore.
          onRevealed() {
            setClosed(true);
          },
          onExpired(count) {
            setLost(count);
            setEvent((current) => current && { ...current, state: "expired" });
          },
          onSessionLost() {
            forgetToken(scanned);
            setToken(null);
            setScreen("welcome");
          },
          onGone: setProblem,
        });
        setCode(scanned);
        setEvent(result.event);
        setClosed(result.event.state === "closed");
        maxRef.current = result.event.maxPhotos;
        if (result.token) {
          uploadQueue.setToken(result.token);
          setToken(result.token);
          setCount(result.count);
          setScreen("camera");
        } else {
          setScreen("welcome");
        }
      } catch (reason) {
        if (cancelled) return;
        const error = reason as ApiError;
        // QR code qui n'est plus reconnu : les photos gardées pour lui ne partiront jamais.
        if (scanned && error.code === "event") {
          uploadQueue.open(scanned, "gone", {
            onCount: setCount,
            onNotice: setNotice,
            onLimit: () => {},
            onRevealed: () => {},
            onExpired: () => {},
            onSessionLost: () => {},
            onGone: setProblem,
          });
        }
        setProblem(error.message);
        // Erreur passagère : nouvel essai au retour du réseau, au retour sur la page, et à intervalles croissants.
        if (error.code === "network" || error.retryable) {
          if (!listening) {
            listening = true;
            window.addEventListener("online", start);
            document.addEventListener("visibilitychange", again);
          }
          retry = setTimeout(start, JOIN_RETRY_SECONDS[Math.min(tries, JOIN_RETRY_SECONDS.length - 1)] * 1000);
          tries += 1;
          countStored(scanned).then((stored) => {
            if (!cancelled && listening) setKept(stored);
          });
        } else {
          stopRetrying();
          setKept(0);
        }
      } finally {
        busy = false;
      }
    }
    start();
    return () => {
      cancelled = true;
      stopRetrying();
    };
  }, []);

  // Évite de fermer la page tant que des photos ne sont pas parties.
  const unsent = queue.waiting > 0;
  useEffect(() => {
    if (!unsent) return;
    const warn = (unload: BeforeUnloadEvent) => unload.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  async function join(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const fields = new FormData(form.currentTarget);
    const name = String(fields.get("name") ?? "").trim();
    const email = String(fields.get("email") ?? "").trim();
    if (!name) return setNameError(kindOf(event?.kind ?? "").nameNeeded);
    setJoining(true);
    setNameError(null);
    try {
      const result = await api<JoinResult>("join", { code, name, email });
      if (!result.token) throw new ApiError("name", "Ce pseudo n'est pas valide.", 422);
      saveToken(code, result.token);
      uploadQueue.setToken(result.token);
      // La limite renvoyée tient compte du bonus accordé pour l'e-mail.
      setEvent(result.event);
      maxRef.current = result.event.maxPhotos;
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
  // Une photo reçue dont la réponse s'est perdue compte deux fois jusqu'à son accusé : d'où le plafond.
  const taken = max === null ? count + queue.waiting : Math.min(max, count + queue.waiting);
  const remaining = max === null ? null : Math.max(0, max - taken);

  function addShots(photos: Blob[]) {
    const accepted = remaining === null ? photos : photos.slice(0, remaining);
    if (accepted.length < photos.length) {
      setNotice(`Limite de ${max} ${plural(max ?? 0)} atteinte : ${accepted.length} sur ${photos.length} ajoutées.`);
    } else {
      setNotice(null);
    }
    if (accepted.length === 0) return;
    uploadQueue.add(accepted);
    setShots((value) => value + 1);
    setLastShot((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(accepted[accepted.length - 1]);
    });
  }

  if (problem) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p role="alert" className="max-w-[30ch] font-serif text-2xl italic">
          {problem}
        </p>
        {kept > 0 && (
          <p role="status" className="max-w-[34ch] text-sm leading-relaxed text-brume">
            {kept > 1
              ? `${kept} photos prises sur ce téléphone sont en attente : elles partiront dès que la connexion reviendra.`
              : "1 photo prise sur ce téléphone est en attente : elle partira dès que la connexion reviendra."}
          </p>
        )}
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
        {lost > 0 && (
          <p role="status" className="max-w-[34ch] text-sm leading-relaxed text-brume">
            {lost} {plural(lost)} {notSent(lost)} : l&apos;album est clôturé.
          </p>
        )}
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
    if (token) {
      return (
        <MyPhotos
          token={token}
          readOnly
          notice={notice ?? revealedStatus(queue)}
          reload={queue.sent}
          onCount={setCount}
        />
      );
    }
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-sapin-900 px-8 text-center text-creme">
        <Logo className="text-4xl" />
        <p className="libelle text-or-clair">{event.title}</p>
        <p className="max-w-[28ch] font-serif text-2xl italic">
          L&apos;album a été dévoilé. Il n&apos;est plus possible de le rejoindre pour photographier.
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
          <p className="text-sm text-sapin-700">{kindOf(event.kind).seenBy}</p>
        </div>

        <form onSubmit={join} className="flex w-full max-w-sm flex-col gap-2">
          <label htmlFor="name" className="libelle text-sapin-700">
            Votre pseudo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={40}
            autoComplete="nickname"
            aria-invalid={Boolean(nameError)}
            aria-describedby="name-aide"
            className="h-13 rounded-full border border-sapin-700/40 bg-white/60 px-6 text-base text-sapin-900 focus:border-sapin-900 focus:outline-none"
          />
          <p
            id="name-aide"
            role={nameError ? "alert" : undefined}
            className={`text-sm ${nameError ? "text-[#a3312c]" : "text-sapin-700"}`}
          >
            {nameError ?? INVITE_PSEUDO}
          </p>
          <label htmlFor="email" className="libelle mt-3 text-sapin-700">
            Votre e-mail (facultatif)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            aria-describedby="email-aide"
            className="h-13 rounded-full border border-sapin-700/40 bg-white/60 px-6 text-base text-sapin-900 focus:border-sapin-900 focus:outline-none"
          />
          <p id="email-aide" className="text-sm text-sapin-700">
            {max !== null && event.emailBonus > 0
              ? `${event.emailBonus} photos supplémentaires offertes si vous laissez votre e-mail. Vous serez aussi prévenu quand l'album sera dévoilé.`
              : "Pour être prévenu quand l'album sera dévoilé. Rien d'autre."}
          </p>
          <button
            type="submit"
            disabled={joining}
            className="mt-3 h-13 rounded-full bg-sapin-900 px-8 text-sm font-semibold tracking-wide text-creme transition-transform active:scale-[0.98] disabled:opacity-70"
          >
            {joining ? "Un instant…" : "Commencer à photographier"}
          </button>
          <p className="mt-2 text-center text-sm text-sapin-700">
            En continuant, vous acceptez les{" "}
            <Link href="/mentions-legales/" target="_blank" className="underline underline-offset-4">
              règles d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite/" target="_blank" className="underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </p>
          {max !== null && (
            <p className="mt-2 text-center text-sm text-sapin-700">
              Vous pouvez envoyer jusqu&apos;à {max} {plural(max)}
              {event.emailBonus > 0 ? `, ou ${max + event.emailBonus} avec votre e-mail` : ""}.
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
    notice ?? sendingStatus(queue) ?? (remaining === 0 ? `Vous avez envoyé vos ${max} photos. Merci !` : null);

  return (
    <Camera
      title={event.title}
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
