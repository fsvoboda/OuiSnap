// Garde l'écran allumé pendant l'envoi des photos : un téléphone qui se verrouille suspend la page.
// Sans effet sur les navigateurs qui ne le permettent pas, ou si le téléphone refuse (batterie faible).
import { useEffect } from "react";

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    // Le téléphone relâche le verrou dès que la page est masquée : il est redemandé à chaque retour.
    async function request() {
      if (document.visibilityState !== "visible") return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) return sentinel.release().catch(() => {});
        // Deux demandes peuvent se chevaucher : l'ancien verrou est relâché, pas oublié.
        lock?.release().catch(() => {});
        lock = sentinel;
      } catch {
        // Refus du téléphone : l'envoi continue, l'écran s'éteindra comme d'habitude.
      }
    }

    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
