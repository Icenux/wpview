import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { hitsVideoControls } from './videoControls';

interface UseSwipeOptions {
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  /** Tažení dolů přes downThreshold — typicky zavření prohlížeče. */
  onSwipeDown?: () => void;
  /** Gesto skončilo bez tažení přes tapThreshold — klik/ťuknutí. */
  onTap?: () => void;
  /** Je po ruce další/předchozí fotka? Bez ní swipe jen odpruží zpět (konec okna). */
  canSwipeNext?: boolean;
  canSwipePrev?: boolean;
  disabled?: boolean;
  /** px potřebné k rozhodnutí o horizontálním swipe, default 60. */
  threshold?: number;
  /** px potřebné k rozhodnutí o swipe-down, default 100. */
  downThreshold?: number;
  /** px, pod kterým se gesto považuje za tap, ne drag, default 8. */
  tapThreshold?: number;
}

interface UseSwipeResult {
  /** Živý horizontální posun během tažení NEBO dojíždění swipe po puštění — pro optický posun Stage. 0 mimo obojí. */
  dragOffsetX: number;
  /** Živý posun dolů během swipe-down gesta. 0 mimo drag/nahoru. */
  dragOffsetY: number;
  isDragging: boolean;
  /** Když true, Stage MUSÍ vypnout CSS transition na tenhle jeden render — používá se přesně na snímek, kdy se po dojetí swipe přehazuje index a offset skáče zpátky na 0 (viz settle). Bez toho by se to jedno přeřazení vizuálně "vrátilo". */
  suppressTransition: boolean;
  /**
   * Spustí STEJNOU dojíždějící animaci jako dokončený swipe, ale bez prstu —
   * pro programové přehození (slideshow s transitionType: 'slide', viz
   * Stage.tsx). Bez `canSwipeNext`/`onSwipeNext` (podle směru) nic neudělá.
   */
  triggerAdvance: (direction: 'next' | 'prev') => void;
}

type Axis = 'horizontal' | 'vertical' | null;

/** Musí sedět s transition duration v Stage.tsx (`transform 0.2s ease`). Jediné místo pravdy pro obě strany. */
export const SWIPE_SETTLE_MS = 200;

/**
 * Nízkoúrovňové Pointer Events, žádná knihovna (wpview je dep-light).
 * Ignoruje gesto, jakmile přibude druhý prst — to je práce usePinchZoom.
 * Osa (horizontální/vertikální) se zamyká při prvním překročení tapThreshold,
 * ať 1px chvění na startu nerozhodne o špatném směru. Gesto, které tapThreshold
 * nikdy nepřekročí, je tap — swipe nahoru nic nedělá (jen dolů zavírá).
 *
 * Committed horizontální swipe nezavolá onSwipeNext/Prev hned: nejdřív dojede
 * (`settle`) do plně odsunuté pozice (živě navazuje na tažení prstem, ne skok),
 * a teprve PO dojetí zavolá consumer callback a current/prev/next role se v
 * Stage přehodí. Bez tohohle by fotka jen "poskočila a nahradila se" — přesně
 * tohle bylo nahlášeno jako bug.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    canSwipeNext = true,
    canSwipePrev = true,
    disabled = false,
    threshold = 60,
    downThreshold = 100,
    tapThreshold = 8,
  }: UseSwipeOptions,
): UseSwipeResult {
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [suppressTransition, setSuppressTransition] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<Axis>(null);
  const activePointerId = useRef<number | null>(null);
  const activePointerCount = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Options tažené přes ref, ne přes effect deps — settle() běží v setTimeoutu
  // založeném uvnitř starého effect closure; kdyby se effect kvůli změně
  // `canSwipeNext` apod. znovu spustil, listener by se odpojil a znovu
  // připojil uprostřed gesta.
  const optsRef = useRef({ onSwipeNext, onSwipePrev, onSwipeDown, onTap, canSwipeNext, canSwipePrev, threshold, downThreshold, tapThreshold });
  optsRef.current = { onSwipeNext, onSwipePrev, onSwipeDown, onTap, canSwipeNext, canSwipePrev, threshold, downThreshold, tapThreshold };

  // Dojede z aktuální živé pozice do `target` (±šířka stage, tj. fotka úplně
  // mimo) se zapnutou CSS transition (isDragging=false ji povolí), pak zavolá
  // `after` (obvykle onSwipeNext/Prev — přehodí index u consumera) a ve
  // STEJNÉM tiku odskočí offset zpátky na 0 s dočasně vypnutou transition
  // (suppressTransition), ať se nově přeřazená "current" dlaždice neanimuje
  // ze své staré pozice do 0 — matematicky sedí přesně tam, kde právě
  // "dojela" (viz Stage.tsx transformy). Nezávislé na pointer efektu níž —
  // volá ji jak endDrag (prst), tak triggerAdvance (slideshow, bez prstu).
  const settle = useCallback((target: number, after: () => void) => {
    activePointerId.current = null;
    axis.current = null;
    setIsDragging(false);
    setDragOffsetX(target);
    settleTimer.current = setTimeout(() => {
      after();
      setSuppressTransition(true);
      setDragOffsetX(0);
      setDragOffsetY(0);
      // Dva rAF: první doručí prohlížeči snímek s transition:none, teprve
      // druhý ji zase povolí — jeden rAF někdy stihne oboje sloučit do
      // jednoho commitu a transition by se na příštím tažení nevypnula.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSuppressTransition(false));
      });
    }, SWIPE_SETTLE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    };
  }, []);

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
      if (hitsVideoControls(e)) return;
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
      const { tapThreshold: tapT } = optsRef.current;

      if (axis.current === null) {
        if (Math.abs(dx) < tapT && Math.abs(dy) < tapT) return;
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
      const {
        onSwipeNext: next,
        onSwipePrev: prev,
        onSwipeDown: down,
        onTap: tap,
        canSwipeNext: hasNext,
        canSwipePrev: hasPrev,
        threshold: t,
        downThreshold: dt,
      } = optsRef.current;

      if (finishedAxis === 'horizontal') {
        const width = el?.clientWidth || 1;
        if (dx <= -t && hasNext && next) {
          settle(-width, next);
          return;
        }
        if (dx >= t && hasPrev && prev) {
          settle(width, prev);
          return;
        }
        reset();
        return;
      }

      reset();
      if (finishedAxis === null) {
        tap?.();
      } else if (dy >= dt) {
        down?.();
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
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    };
    // optsRef carries the latest callbacks/flags — only re-attach listeners
    // when the element or disabled-ness actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, disabled, settle]);

  const triggerAdvance = useCallback(
    (direction: 'next' | 'prev') => {
      const el = ref.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const { onSwipeNext: next, onSwipePrev: prev, canSwipeNext: hasNext, canSwipePrev: hasPrev } = optsRef.current;
      if (direction === 'next' && hasNext && next) settle(-width, next);
      else if (direction === 'prev' && hasPrev && prev) settle(width, prev);
    },
    [ref, settle],
  );

  return { dragOffsetX, dragOffsetY, isDragging, suppressTransition, triggerAdvance };
}
