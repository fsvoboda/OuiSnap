"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function TeaserVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [muted, setMuted] = useState(true);

  // Lecture automatique seulement si l'utilisateur n'a pas demandé moins d'animations.
  useEffect(() => {
    const video = ref.current;
    if (!video || reduce) return;
    video.play().catch(() => {});
    return () => video.pause();
  }, [reduce]);

  return (
    <div className="relative mx-auto aspect-[9/16] h-[min(70dvh,620px)] overflow-hidden rounded-3xl border border-or/50 bg-sapin-950 shadow-[0_30px_80px_-30px_rgba(8,14,11,0.9)]">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        src="/media/ouisnap-teaser.mp4"
        poster="/media/ouisnap-teaser-poster.jpg"
        muted={muted}
        loop
        playsInline
        preload="metadata"
        controls={Boolean(reduce)}
        aria-label="Présentation de OuiSnap en trois étapes : scanner le QR code, photographier, partager aux mariés"
      />
      {!reduce && (
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-sapin-950/80 text-creme transition-transform active:scale-95"
        >
          {muted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}
        </button>
      )}
    </div>
  );
}
