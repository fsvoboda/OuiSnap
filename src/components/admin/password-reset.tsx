"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { buttonClass, inputClass } from "./types";

const TOKEN = /^[a-f0-9]{48}$/;
const INVALID_LINK = "Ce lien n'est plus valable : il a expiré ou a déjà servi.";

// Choix d'un nouveau mot de passe depuis le lien reçu par e-mail.
export function PasswordReset({
  token,
  onDone,
  onBack,
}: {
  token: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"checking" | "form" | "invalid" | "done">("checking");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const check = useCallback(async () => {
    if (!TOKEN.test(token)) {
      setStep("invalid");
      return;
    }
    setError(null);
    try {
      await api("admin-reset", { token });
      setStep("form");
    } catch (reason) {
      const failure = reason as ApiError;
      if (failure.temporary) {
        setError(failure.message);
        setStep("checking");
      } else setStep("invalid");
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(check, 0);
    return () => clearTimeout(first);
  }, [check]);

  async function save(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const data = new FormData(form.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setSaving(true);
    setError(null);
    try {
      await api("admin-reset", { token, password, confirm });
      setStep("done");
      onDone();
    } catch (reason) {
      const failure = reason as ApiError;
      if (failure.code === "link") setStep("invalid");
      else setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2">
        <Logo className="text-4xl" />
        <p className="libelle text-or-clair">Administration</p>
      </div>

      {step === "checking" && !error && (
        <p role="status" className="libelle animate-pulse text-brume">
          Vérification du lien
        </p>
      )}

      {step === "checking" && error && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <p role="alert" className="text-sm text-[#f0a39e]">
            {error}
          </p>
          <button type="button" onClick={check} className={`${buttonClass} border border-creme/30`}>
            Réessayer
          </button>
        </div>
      )}

      {step === "form" && (
        <form onSubmit={save} className="flex w-full max-w-sm flex-col gap-2">
          <h1 className="mb-2 font-serif text-3xl">Nouveau mot de passe</h1>
          <label htmlFor="new-password" className="libelle text-brume">
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            aria-describedby="new-password-help"
            autoFocus
            className={inputClass}
          />
          <p id="new-password-help" className="text-sm text-brume">
            10 caractères au minimum.
          </p>
          <label htmlFor="confirm-password" className="libelle mt-2 text-brume">
            Confirmez le mot de passe
          </label>
          <input
            id="confirm-password"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "confirm-password-error" : undefined}
            className={inputClass}
          />
          {mismatch && (
            <p id="confirm-password-error" role="alert" className="text-sm text-[#f0a39e]">
              Les deux mots de passe ne sont pas identiques.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-[#f0a39e]">
              {error}
            </p>
          )}
          <button type="submit" disabled={saving} className={`${buttonClass} mt-3 bg-or text-sapin-950`}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}

      {step === "invalid" && (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <p role="alert" className="leading-relaxed">
            {INVALID_LINK}
          </p>
          <button type="button" onClick={onBack} className={`${buttonClass} border border-creme/30`}>
            Retour à la connexion
          </button>
        </div>
      )}
    </main>
  );
}
