// Gestes tactiles : pincement à deux doigts et glissement à un doigt.
// L'élément qui reçoit ces propriétés doit porter la classe touch-none,
// sinon le navigateur zoome la page entière à la place.
import { useRef, type PointerEvent } from "react";

export function usePinch(on: {
  start?: () => void;
  pinch: (ratio: number) => void; // écart actuel des doigts / écart au départ
  pan?: (dx: number, dy: number) => void;
}) {
  const points = useRef(new Map<number, { x: number; y: number }>());
  const distance = useRef(0);

  const spread = () => {
    const [a, b] = [...points.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const release = (event: PointerEvent) => {
    points.current.delete(event.pointerId);
    distance.current = 0;
  };

  return {
    onPointerDown(event: PointerEvent) {
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.current.size === 2) {
        distance.current = spread();
        on.start?.();
      }
    },
    onPointerMove(event: PointerEvent) {
      const previous = points.current.get(event.pointerId);
      if (!previous) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.current.size === 2 && distance.current > 0) {
        on.pinch(spread() / distance.current);
      } else if (points.current.size === 1) {
        on.pan?.(event.clientX - previous.x, event.clientY - previous.y);
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
  };
}
