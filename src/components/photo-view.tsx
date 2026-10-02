"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPhoto, type PhotoEndpoint } from "@/lib/api";
import { usePinch } from "@/lib/pinch";

type Source = { endpoint: PhotoEndpoint; token: string; id: number };

// Image protégée : chargée avec le jeton (invité ou mariés), puis affichée depuis la mémoire.
export function PhotoImage({
  endpoint,
  token,
  id,
  size,
  className,
}: Source & { size: "thumb" | "full"; className: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchPhoto(endpoint, token, id, size)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, token, id, size]);

  if (!url) return <div className={`animate-pulse bg-sapin-800 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}

// Vignette chargée seulement quand elle approche de l'écran : un album peut compter des centaines de photos.
export function LazyThumb({ endpoint, token, id }: Source) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full bg-sapin-800">
      {near && (
        <PhotoImage endpoint={endpoint} token={token} id={id} size="thumb" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

// Photo agrandie : pincer pour zoomer, glisser pour se déplacer dans l'image.
export function ZoomablePhoto({ endpoint, token, id }: Source) {
  const frame = useRef<HTMLDivElement>(null);
  const base = useRef(1);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  // Garde l'image dans le cadre : on ne peut pas la faire glisser hors de l'écran.
  function clamp(scale: number, x: number, y: number) {
    const maxX = ((frame.current?.clientWidth ?? 0) * (scale - 1)) / 2;
    const maxY = ((frame.current?.clientHeight ?? 0) * (scale - 1)) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  const pinch = usePinch({
    start: () => (base.current = view.scale),
    pinch: (ratio) =>
      setView((current) => clamp(Math.min(5, Math.max(1, base.current * ratio)), current.x, current.y)),
    pan: (dx, dy) => setView((current) => clamp(current.scale, current.x + dx, current.y + dy)),
  });

  return (
    <div ref={frame} className="h-full w-full touch-none overflow-hidden rounded-lg" {...pinch}>
      <div
        className="h-full w-full"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <PhotoImage endpoint={endpoint} token={token} id={id} size="full" className="h-full w-full object-contain" />
      </div>
    </div>
  );
}
