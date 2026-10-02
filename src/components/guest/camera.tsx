"use client";

import { Camera as CameraIcon, CameraRotate, Images, SquaresFour } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { toJpeg } from "@/lib/image";
import { usePinch } from "@/lib/pinch";
import { playShutter } from "@/lib/shutter";

type Facing = "environment" | "user";

// Heure affichée dans la pastille, comme sur les écrans du teaser.
function subscribeClock(notify: () => void) {
  const timer = setInterval(notify, 15_000);
  return () => clearInterval(timer);
}
const readClock = () =>
  new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function Camera({
  remaining,
  counter,
  status,
  lastShot,
  shots,
  onShots,
  onOpenPhotos,
}: {
  remaining: number | null; // null = illimité
  counter: string;
  status: string | null;
  lastShot: string | null;
  shots: number;
  onShots: (photos: Blob[]) => void;
  onOpenPhotos: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [live, setLive] = useState<boolean | null>(null); // null = démarrage, false = indisponible
  const [busy, setBusy] = useState(false);
  // Zoom relatif (1 = sans zoom). Optique si le téléphone le permet, sinon numérique.
  const [zoom, setZoom] = useState(1);
  const [optical, setOptical] = useState(false);
  // Proportions de l'image fournie par la caméra : elles changent quand le téléphone pivote.
  const [aspect, setAspect] = useState(9 / 16);
  const zoomTrack = useRef<{ track: MediaStreamTrack; base: number; max: number } | null>(null);
  const pinchBase = useRef(1);
  const clock = useSyncExternalStore(subscribeClock, readClock, () => "");
  const full = remaining !== null && remaining <= 0;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("caméra indisponible");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
        const track = stream.getVideoTracks()[0];
        const range = (track.getCapabilities?.() as { zoom?: { max: number } } | undefined)?.zoom;
        const base = (track.getSettings() as { zoom?: number }).zoom ?? 1;
        zoomTrack.current = range && range.max > base ? { track, base, max: range.max } : null;
        setOptical(zoomTrack.current !== null);
        setLive(true);
      } catch {
        if (!cancelled) setLive(false);
      }
    }

    // iOS coupe la caméra quand la page passe en arrière-plan : on la relance au retour.
    function resume() {
      const ended = stream?.getVideoTracks().every((track) => track.readyState === "ended");
      if (document.visibilityState === "visible" && (ended || !stream)) start();
    }

    // Passage portrait/paysage : la caméra livre une image aux nouvelles proportions.
    const video = videoRef.current;
    function resized() {
      if (video?.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
    }

    start();
    document.addEventListener("visibilitychange", resume);
    video?.addEventListener("resize", resized);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resume);
      video?.removeEventListener("resize", resized);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  function changeZoom(value: number) {
    const lens = zoomTrack.current;
    const limit = lens ? Math.min(lens.max / lens.base, 6) : 4;
    const next = Math.min(limit, Math.max(1, value));
    setZoom(next);
    lens?.track
      .applyConstraints({ advanced: [{ zoom: lens.base * next } as MediaTrackConstraintSet] })
      .catch(() => {});
  }

  const pinch = usePinch({
    start: () => (pinchBase.current = zoom),
    pinch: (ratio) => changeZoom(pinchBase.current * ratio),
  });

  async function shoot() {
    const video = videoRef.current;
    if (!video || busy || full) return;
    setBusy(true);
    playShutter();
    try {
      onShots([await toJpeg(video, optical ? 1 : zoom)]);
      navigator.vibrate?.(10);
    } catch {
      // Image pas encore prête : l'invité peut simplement réappuyer.
    } finally {
      setBusy(false);
    }
  }

  async function importFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    const photos: Blob[] = [];
    for (const file of files) {
      try {
        photos.push(await toJpeg(file));
      } catch {
        // Fichier illisible (vidéo, format inconnu) : ignoré.
      }
    }
    setBusy(false);
    if (photos.length > 0) onShots(photos);
  }

  return (
    // En paysage, les commandes passent sur le côté pour laisser toute la hauteur à l'image.
    <div className="fixed inset-0 flex touch-none flex-col bg-sapin-950 text-creme select-none landscape:flex-row">
      <div
        className="relative grid min-h-0 min-w-0 flex-1 place-items-center overflow-hidden [container-type:size]"
        {...pinch}
      >
        {/* Cadre aux proportions exactes de la photo : ce qui est affiché est ce qui sera enregistré. */}
        <div
          className="overflow-hidden"
          style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              // Miroir pour la caméra avant ; agrandissement à l'écran quand le zoom est numérique.
              transform: `scale(${(facing === "user" ? -1 : 1) * (optical ? 1 : zoom)}, ${optical ? 1 : zoom})`,
            }}
            className={`h-full w-full object-cover ${live ? "" : "invisible"}`}
          />
        </div>

        {live === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="font-serif text-2xl italic">
              L&apos;appareil photo n&apos;est pas accessible ici.
            </p>
            <p className="max-w-[34ch] text-sm leading-relaxed text-brume">
              Autorisez l&apos;accès à la caméra dans votre navigateur, ou utilisez
              l&apos;appareil photo de votre téléphone.
            </p>
            <label
              className={`flex h-13 cursor-pointer items-center gap-3 rounded-full bg-or px-7 text-sm font-semibold text-sapin-950 active:scale-[0.98] ${full ? "pointer-events-none opacity-50" : ""}`}
            >
              <CameraIcon size={20} weight="bold" />
              Prendre une photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={full}
                onChange={importFiles}
              />
            </label>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 rounded-full bg-sapin-950/75 px-4 py-1.5">
            <Logo className="text-lg" />
            <span className="text-sm font-medium tabular-nums">{clock}</span>
          </div>
          {live && (
            <button
              type="button"
              aria-label="Changer de caméra"
              onClick={() => {
                setZoom(1);
                setFacing((value) => (value === "user" ? "environment" : "user"));
              }}
              className="grid size-11 place-items-center rounded-full bg-sapin-950/75 active:scale-95"
            >
              <CameraRotate size={22} />
            </button>
          )}
        </div>

        {live && (
          <button
            type="button"
            aria-label={`Zoom ${zoom.toFixed(1).replace(".", ",")}. Appuyer pour ${zoom > 1.05 ? "revenir à 1" : "passer à 2"}`}
            onClick={() => changeZoom(zoom > 1.05 ? 1 : 2)}
            className="absolute bottom-4 left-1/2 h-10 min-w-14 -translate-x-1/2 rounded-full bg-sapin-950/75 px-3 text-sm font-semibold tabular-nums active:scale-95"
          >
            {zoom.toFixed(1).replace(".", ",")}×
          </button>
        )}

        {status && (
          <p className="pointer-events-none absolute bottom-16 left-1/2 hidden max-w-[80%] -translate-x-1/2 rounded-full bg-sapin-950/75 px-4 py-1.5 text-center text-sm landscape:block">
            {status}
          </p>
        )}

        {/* Éclair blanc à chaque déclenchement : confirme que la photo est prise. */}
        <AnimatePresence>
          {shots > 0 && (
            <motion.div
              key={shots}
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-creme"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:justify-center landscape:gap-4 landscape:px-4 landscape:py-3 landscape:pr-[max(1rem,env(safe-area-inset-right))]">
        <p role="status" className="min-h-5 text-center text-sm text-brume landscape:hidden">
          {status}
        </p>
        <div className="grid w-full max-w-sm grid-cols-3 items-center landscape:w-auto landscape:grid-cols-1 landscape:gap-4 landscape:justify-items-center">
          <label
            aria-label="Importer depuis la galerie"
            className={`grid size-13 cursor-pointer place-items-center justify-self-start landscape:justify-self-center rounded-full border border-creme/30 active:scale-95 ${full ? "pointer-events-none opacity-40" : ""}`}
          >
            <Images size={24} />
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={full}
              onChange={importFiles}
            />
          </label>

          <button
            type="button"
            aria-label="Prendre la photo"
            onClick={shoot}
            disabled={!live || busy || full}
            className="grid size-20 place-items-center justify-self-center rounded-full border-4 border-creme transition-transform active:scale-90 disabled:opacity-40"
          >
            <span className="size-15 rounded-full bg-creme" />
          </button>

          <button
            type="button"
            aria-label="Voir mes photos"
            onClick={onOpenPhotos}
            className="relative grid size-13 place-items-center justify-self-end overflow-hidden landscape:justify-self-center rounded-2xl border border-creme/30 bg-sapin-800 active:scale-95"
          >
            {!lastShot && <SquaresFour size={24} />}
            {lastShot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lastShot} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <AnimatePresence>
              {shots > 0 && (
                <motion.span
                  key={shots}
                  className="absolute inset-0 grid place-items-center bg-or text-sm font-semibold text-sapin-950"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, delay: 0.3 }}
                >
                  +1
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
        <p className="libelle text-center text-or-clair landscape:max-w-24">{counter}</p>
      </div>
    </div>
  );
}
