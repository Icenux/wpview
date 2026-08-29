import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseSwipeOptions {
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  disabled?: boolean;
  /** px potřebné k rozhodnutí o swipe, default 60. */
  threshold?: number;
}

interface UseSwipeResult {
  /** Živý horizontální posun během tažení — pro optický posun Stage. 0 mimo drag. */
  dragOffsetX: number;
  isDragging: boolean;
}

/**
 * Nízkoúrovňové Pointer Events, žádná knihovna (wpview je dep-light).
 * Ignoruje gesto, jakmile přibude druhý prst — to je práce usePinchZoom.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  { onSwipeNext, onSwipePrev, disabled = false, threshold = 60 }: UseSwipeOptions,
): UseSwipeResult {
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const activePointerCount = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    function onPointerDown(e: PointerEvent) {
      activePointerCount.current += 1;
      if (activePointerCount.current > 1) {
        // Druhý prst dorazil uprostřed gesta -> vzdáváme se ve prospěch pinche.
        activePointerId.current = null;
        setIsDragging(false);
        setDragOffsetX(0);
        return;
      }
      activePointerId.current = e.pointerId;
      startX.current = e.clientX;
      setIsDragging(true);
      el?.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (activePointerId.current !== e.pointerId) return;
      setDragOffsetX(e.clientX - startX.current);
    }

    function endDrag(e: PointerEvent) {
      if (activePointerCount.current > 0) activePointerCount.current -= 1;
      if (activePointerId.current !== e.pointerId) return;
      const finalOffset = e.clientX - startX.current;
      activePointerId.current = null;
      setIsDragging(false);
      setDragOffsetX(0);
      if (finalOffset <= -threshold) onSwipeNext?.();
      else if (finalOffset >= threshold) onSwipePrev?.();
    }

    function cancelDrag(e: PointerEvent) {
      if (activePointerCount.current > 0) activePointerCount.current -= 1;
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;
      setIsDragging(false);
      setDragOffsetX(0);
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', cancelDrag);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', cancelDrag);
    };
  }, [ref, disabled, onSwipeNext, onSwipePrev, threshold]);

  return { dragOffsetX, isDragging };
}
