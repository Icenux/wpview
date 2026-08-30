import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseSwipeOptions {
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  /** Tažení dolů přes downThreshold — typicky zavření prohlížeče. */
  onSwipeDown?: () => void;
  /** Gesto skončilo bez tažení přes tapThreshold — klik/ťuknutí. */
  onTap?: () => void;
  disabled?: boolean;
  /** px potřebné k rozhodnutí o horizontálním swipe, default 60. */
  threshold?: number;
  /** px potřebné k rozhodnutí o swipe-down, default 100. */
  downThreshold?: number;
  /** px, pod kterým se gesto považuje za tap, ne drag, default 8. */
  tapThreshold?: number;
}

interface UseSwipeResult {
  /** Živý horizontální posun během tažení — pro optický posun Stage. 0 mimo drag. */
  dragOffsetX: number;
  /** Živý posun dolů během swipe-down gesta. 0 mimo drag/nahoru. */
  dragOffsetY: number;
  isDragging: boolean;
}

type Axis = 'horizontal' | 'vertical' | null;

/**
 * Nízkoúrovňové Pointer Events, žádná knihovna (wpview je dep-light).
 * Ignoruje gesto, jakmile přibude druhý prst — to je práce usePinchZoom.
 * Osa (horizontální/vertikální) se zamyká při prvním překročení tapThreshold,
 * ať 1px chvění na startu nerozhodne o špatném směru. Gesto, které tapThreshold
 * nikdy nepřekročí, je tap — swipe nahoru nic nedělá (jen dolů zavírá).
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    disabled = false,
    threshold = 60,
    downThreshold = 100,
    tapThreshold = 8,
  }: UseSwipeOptions,
): UseSwipeResult {
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<Axis>(null);
  const activePointerId = useRef<number | null>(null);
  const activePointerCount = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    function reset() {
      activePointerId.current = null;
      axis.current = null;
      setIsDragging(false);
      setDragOffsetX(0);
      setDragOffsetY(0);
    }

    function onPointerDown(e: PointerEvent) {
      activePointerCount.current += 1;
      if (activePointerCount.current > 1) {
        // Druhý prst dorazil uprostřed gesta -> vzdáváme se ve prospěch pinche.
        reset();
        return;
      }
      activePointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      axis.current = null;
      el?.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (activePointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (axis.current === null) {
        if (Math.abs(dx) < tapThreshold && Math.abs(dy) < tapThreshold) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
        setIsDragging(true);
      }

      if (axis.current === 'horizontal') {
        setDragOffsetX(dx);
      } else if (dy > 0) {
        setDragOffsetY(dy);
      }
    }

    function endDrag(e: PointerEvent) {
      if (activePointerCount.current > 0) activePointerCount.current -= 1;
      if (activePointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      const finishedAxis = axis.current;
      reset();

      if (finishedAxis === null) {
        onTap?.();
      } else if (finishedAxis === 'horizontal') {
        if (dx <= -threshold) onSwipeNext?.();
        else if (dx >= threshold) onSwipePrev?.();
      } else if (dy >= downThreshold) {
        onSwipeDown?.();
      }
    }

    function cancelDrag(e: PointerEvent) {
      if (activePointerCount.current > 0) activePointerCount.current -= 1;
      if (activePointerId.current !== e.pointerId) return;
      reset();
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
  }, [
    ref,
    disabled,
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    threshold,
    downThreshold,
    tapThreshold,
  ]);

  return { dragOffsetX, dragOffsetY, isDragging };
}
