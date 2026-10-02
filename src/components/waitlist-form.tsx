"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useState } from "react";

type State =
  | { status: "idle" | "pending" | "success" }
  | { status: "error"; message: string };

const ECHEC = "L'inscription a échoué. Réessayez dans un instant.";

export function WaitlistForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "pending" });
    try {
      // Script PHP servi par l'hébergement, à côté du site statique.
      const response = await fetch("/api/waitlist.php", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result: { ok: boolean; message?: string } = await response.json();
      setState(
        result.ok
          ? { status: "success" }
          : { status: "error", message: result.message ?? ECHEC },
      );
    } catch {
      setState({ status: "error", message: ECHEC });
    }
  }

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="flex items-center gap-3 font-serif text-2xl italic text-or-clair"
      >
        <CheckCircle size={28} weight="fill" className="shrink-0" />
        C&apos;est noté. Nous vous écrirons au lancement.
      </p>
    );
  }

  const pending = state.status === "pending";

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl flex-col gap-2">
      <label htmlFor="email" className="libelle text-brume">
        Votre adresse e-mail
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="prenom@exemple.fr"
          aria-invalid={state.status === "error"}
          aria-describedby="email-aide"
          className="h-13 w-full shrink-0 rounded-full border border-creme/30 bg-sapin-950/60 px-6 text-base text-creme placeholder:text-brume/70 focus:border-or-clair focus:outline-none sm:w-auto sm:flex-1"
        />
        {/* Champ piège pour les robots, hors écran et hors tabulation. */}
        <input
          type="text"
          name="site"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] size-px opacity-0"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-13 shrink-0 whitespace-nowrap rounded-full bg-or px-8 text-sm font-semibold tracking-wide text-sapin-950 transition-[transform,background-color] hover:bg-or-clair active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? "Inscription…" : "Rejoindre la liste"}
        </button>
      </div>
      <p
        id="email-aide"
        role={state.status === "error" ? "alert" : undefined}
        className={`text-sm ${state.status === "error" ? "text-[#f0a39e]" : "text-brume"}`}
      >
        {state.status === "error"
          ? state.message
          : "Votre e-mail sert uniquement à vous prévenir du lancement."}
      </p>
    </form>
  );
}
