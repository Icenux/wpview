import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UsePinchZoomOptions {
  onZoomChange?: (scale: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

interface UsePinchZoomResult {
  scale: number;
  isPinching: boolean;
  resetZoom: () => void;
  setZoom: (next: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Dvouprsté pinch přes Pointer Events. Nezávislé na useSwipe, sdílí jen element ref. */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  { onZoomChange, disabled = false, min = 1, max = 6 }: UsePinchZoomOptions,
): UsePinchZoomResult {
  const [scale, setScaleState] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const scaleRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startDistance = useRef(0);
  const startScale = useRef(1);

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      scaleRef.current = clamped;
      setScaleState(clamped);
      onZoomChange?.(clamped);
    },
    [min, max, onZoomChange],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    function distance(): number {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return 0;
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(e: PointerEvent) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        startDistance.current = distance();
        startScale.current = scaleRef.current;
        setIsPinching(true);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && startDistance.current > 0) {
        const ratio = distance() / startDistance.current;
        setZoom(startScale.current * ratio);
      }
    }

    function endPointer(e: PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) {
        setIsPinching(false);
        startDistance.current = 0;
      }
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
    };
  }, [ref, disabled, setZoom]);

  const resetZoom = useCallback(() => setZoom(1), [setZoom]);

  return { scale, isPinching, resetZoom, setZoom };
}
