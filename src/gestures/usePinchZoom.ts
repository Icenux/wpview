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
  /** Živý posun panované fotky (px, obrazovkový prostor — viz onPointerMove). 0 mimo pan. */
  translateX: number;
  translateY: number;
  isPinching: boolean;
  isPanning: boolean;
  /** Vrátí scale i pan na výchozí stav (nová fotka). */
  resetZoom: () => void;
  setZoom: (next: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Dvouprsté pinch-to-zoom PLUS jednoprsté panování, jakmile je fotka
 * přiblížená (`scale > 1`) — nezávislé na useSwipe, sdílí jen element ref.
 * Stage si podle stejné podmínky useSwipe VYPÍNÁ (viz `swipeDisabled`), ať
 * si tažení jedním prstem nepřetahují dva handlery najednou: nezoomováno ->
 * useSwipe (navigace/zavření/tap), zoomováno -> tenhle hook (panování).
 */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  { onZoomChange, disabled = false, min = 1, max = 6 }: UsePinchZoomOptions,
): UsePinchZoomResult {
  const [scale, setScaleState] = useState(1);
  const [translate, setTranslateState] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startDistance = useRef(0);
  const startScale = useRef(1);
  const panPointerId = useRef<number | null>(null);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      scaleRef.current = clamped;
      setScaleState(clamped);
      onZoomChange?.(clamped);
    },
    [min, max, onZoomChange],
  );

  const setPan = useCallback((x: number, y: number) => {
    translateRef.current = { x, y };
    setTranslateState({ x, y });
  }, []);

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
        // Druhý prst dorazil uprostřed panování jedním prstem -> přebírá to pinch.
        panPointerId.current = null;
        setIsPanning(false);
        startDistance.current = distance();
        startScale.current = scaleRef.current;
        setIsPinching(true);
      } else if (pointers.current.size === 1 && scaleRef.current > 1) {
        panPointerId.current = e.pointerId;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOrigin.current = translateRef.current;
        setIsPanning(true);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && startDistance.current > 0) {
        const ratio = distance() / startDistance.current;
        setZoom(startScale.current * ratio);
        return;
      }
      if (pointers.current.size === 1 && panPointerId.current === e.pointerId) {
        // translate() is the OUTER transform (see ImageLoader.tsx —
        // `translate(...) scale(...)`), so it operates in already-scaled
        // screen space: a 1px finger move is always a 1px shift on screen,
        // whatever `scale` currently is. No division by scale needed here.
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan(panOrigin.current.x + dx, panOrigin.current.y + dy);
      }
    }

    function endPointer(e: PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) {
        setIsPinching(false);
        startDistance.current = 0;
      }
      if (panPointerId.current === e.pointerId) {
        panPointerId.current = null;
        setIsPanning(false);
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
  }, [ref, disabled, setZoom, setPan]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan(0, 0);
  }, [setZoom, setPan]);

  return {
    scale,
    translateX: translate.x,
    translateY: translate.y,
    isPinching,
    isPanning,
    resetZoom,
    setZoom,
  };
}
