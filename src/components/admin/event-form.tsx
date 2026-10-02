"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { KINDS, type Kind } from "@/lib/kinds";
import { uploadEventQr } from "@/lib/qr";
import { buttonClass, inputClass, type AdminEvent } from "./types";

// Les champs date du navigateur travaillent en heure locale, l'API en ISO (UTC).
function toInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
const toIso = (value: string) => (value ? new Date(value).toISOString() : "");

// La clôture est une date sans heure : l'album reste accessible jusqu'à la fin de ce jour-là.
const closingDay = (iso: string | null) => toInput(iso).slice(0, 10);
const closingIso = (day: string) =>
  day ? new Date(`${day}T23:59:59`).toISOString() : "";

// Clôture proposée par défaut : deux semaines après le début.
function twoWeeksLater(start: string) {
  const day = new Date(`${start.slice(0, 10)}T12:00`);
  day.setDate(day.getDate() + 14);
  return toInput(day.toISOString()).slice(0, 10);
}

// Révélation proposée par défaut : le lendemain du début à 12h00.
function nextDayNoon(start: string) {
  const day = new Date(`${start.slice(0, 10)}T12:00`);
  day.setDate(day.getDate() + 1);
  return toInput(day.toISOString());
}

export function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event: AdminEvent | null; // null = nouvel album
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState(event?.kind ?? "mariage");
  const [organizerName, setOrganizerName] = useState(
    event?.organizerName ?? "",
  );
  const [organizerEmail, setOrganizerEmail] = useState(
    event?.organizerEmail ?? "",
  );
  const [startsAt, setStartsAt] = useState(toInput(event?.startsAt ?? null));
  const [closesOn, setClosesOn] = useState(closingDay(event?.closesAt ?? null));
  const [closesEdited, setClosesEdited] = useState(Boolean(event));
  const [revealAt, setRevealAt] = useState(toInput(event?.revealAt ?? null));
  const [revealEdited, setRevealEdited] = useState(Boolean(event));
  const [maxGuests, setMaxGuests] = useState(
    event?.maxGuests?.toString() ?? "",
  );
  const [maxPhotos, setMaxPhotos] = useState(
    event?.maxPhotos?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: React.FormEvent) {
    form.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api<{ event: AdminEvent }>("admin-event-save", {
        ...(event ? { id: String(event.id) } : {}),
        title,
        kind,
        organizerName,
        organizerEmail,
        startsAt: toIso(startsAt),
        closesAt: closingIso(closesOn),
        revealAt: toIso(revealAt),
        maxGuests,
        maxPhotos,
      });
      // Le QR code doit être sur le serveur avant l'envoi du message d'ouverture aux organisateurs.
      if (!saved.event.hasQr)
        await uploadEventQr(saved.event.id, saved.event.code).catch(() => {});
      onSaved();
    } catch (reason) {
      setError((reason as ApiError).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <h2 className="font-serif text-4xl">
        {event ? "Modifier l'événement" : "Nouvel événement"}
      </h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="kind" className="libelle text-brume">
          Nature de l&apos;événement
        </label>
        <select
          id="kind"
          value={kind}
          onChange={(change) => setKind(change.target.value)}
          className={inputClass}
        >
          {(Object.keys(KINDS) as Kind[]).map((key) => (
            <option key={key} value={key}>
              {KINDS[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="libelle text-brume">
          Nom de l&apos;album
        </label>
        <input
          id="title"
          required
          maxLength={120}
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          placeholder="Julie & Enzo"
          className={inputClass}
        />
        <p className="text-sm text-brume">
          Affiché aux invités et aux organisateurs.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="organizerName" className="libelle text-brume">
            Nom des organisateurs
          </label>
          <input
            id="organizerName"
            required
            maxLength={80}
            autoComplete="off"
            value={organizerName}
            onChange={(change) => setOrganizerName(change.target.value)}
            placeholder="Julie et Enzo"
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Utilisé pour les saluer dans leurs messages.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="organizerEmail" className="libelle text-brume">
            E-mail des organisateurs
          </label>
          <input
            id="organizerEmail"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={organizerEmail}
            onChange={(change) => setOrganizerEmail(change.target.value)}
            placeholder="julie.enzo@exemple.fr"
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Ils reçoivent un message à l&apos;ouverture, avec le QR code et le
            lien de leur album, puis un autre à la révélation.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="startsAt" className="libelle text-brume">
            Début
          </label>
          <input
            id="startsAt"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(change) => {
              setStartsAt(change.target.value);
              if (!revealEdited && change.target.value)
                setRevealAt(nextDayNoon(change.target.value));
              if (!closesEdited && change.target.value)
                setClosesOn(twoWeeksLater(change.target.value));
            }}
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Les invités peuvent photographier.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="revealAt" className="libelle text-brume">
            Révélation
          </label>
          <input
            id="revealAt"
            type="datetime-local"
            required
            value={revealAt}
            onChange={(change) => {
              setRevealAt(change.target.value);
              setRevealEdited(true);
            }}
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Fin des envois, les photos sont dévoilées.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="closesOn" className="libelle text-brume">
            Clôture
          </label>
          <input
            id="closesOn"
            type="date"
            value={closesOn}
            onChange={(change) => {
              setClosesOn(change.target.value);
              setClosesEdited(true);
            }}
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Dernier jour d&apos;accès à l&apos;album. Vide : jamais.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="maxGuests" className="libelle text-brume">
            Photographes maximum
          </label>
          <input
            id="maxGuests"
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            value={maxGuests}
            onChange={(change) => setMaxGuests(change.target.value)}
            placeholder="Illimité"
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Nombre d&apos;invités pouvant rejoindre l&apos;album.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="maxPhotos" className="libelle text-brume">
            Photos maximum par photographe
          </label>
          <input
            id="maxPhotos"
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            value={maxPhotos}
            onChange={(change) => setMaxPhotos(change.target.value)}
            placeholder="Illimité"
            className={inputClass}
          />
          <p className="text-sm text-brume">
            Laisser vide pour ne pas limiter.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#f0a39e]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className={`${buttonClass} bg-or text-sapin-950`}
        >
          {saving
            ? "Enregistrement…"
            : event
              ? "Enregistrer"
              : "Créer l'événement"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${buttonClass} border border-creme/30`}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
