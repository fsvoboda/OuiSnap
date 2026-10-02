"use client";

import { CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { KINDS, type Kind } from "@/lib/kinds";

type State = { status: "idle" | "pending" | "success" } | { status: "error"; message: string };

const fieldClass =
  "h-13 w-full rounded-2xl border border-creme/30 bg-sapin-950/60 px-5 text-base text-creme placeholder:text-brume/70 focus:border-or-clair focus:outline-none";

// Demande d'un visiteur intéressé : elle arrive par e-mail à OuiSnap.
export function RequestForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "pending" });
    const fields = Object.fromEntries(
      [...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)]),
    );
    try {
      await api("contact", fields);
      setState({ status: "success" });
    } catch (reason) {
      setState({ status: "error", message: (reason as ApiError).message });
    }
  }

  if (state.status === "success") {
    return (
      <p role="status" className="flex items-start gap-3 font-serif text-2xl italic text-or-clair">
        <CheckCircle size={30} weight="fill" className="mt-0.5 shrink-0" />
        Merci, votre demande est envoyée. Nous vous répondons par e-mail.
      </p>
    );
  }

  const pending = state.status === "pending";

  return (
    <form onSubmit={submit} className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="libelle text-brume">
          Votre nom
        </label>
        <input id="name" name="name" required maxLength={80} autoComplete="name" className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="libelle text-brume">
          Votre e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="prenom@exemple.fr"
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="kind" className="libelle text-brume">
          Type d&apos;événement
        </label>
        <select id="kind" name="kind" defaultValue="mariage" className={fieldClass}>
          {(Object.keys(KINDS) as Kind[]).map((key) => (
            <option key={key} value={key}>
              {KINDS[key].label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="date" className="libelle text-brume">
          Date de l&apos;événement
        </label>
        <input id="date" name="date" type="date" className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="message" className="libelle text-brume">
          Votre message (facultatif)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={2000}
          className={`${fieldClass} h-auto py-4`}
        />
      </div>
      {/* Champ piège pour les robots, hors écran et hors tabulation. */}
      <input
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] size-px opacity-0"
      />
      <div className="flex flex-col gap-3 sm:col-span-2">
        {state.status === "error" && (
          <p role="alert" className="text-sm text-[#f0a39e]">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-13 w-fit rounded-full bg-or px-8 text-sm font-semibold tracking-wide text-sapin-950 transition-[transform,background-color] hover:bg-or-clair active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? "Envoi…" : "Envoyer ma demande"}
        </button>
        <p className="text-sm text-brume">
          Vos coordonnées servent uniquement à répondre à votre demande.{" "}
          <Link href="/confidentialite/" className="underline underline-offset-4 hover:text-creme">
            Confidentialité
          </Link>
        </p>
      </div>
    </form>
  );
}
