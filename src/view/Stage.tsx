import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { ViewerItem } from '../contract/types';
import { useSwipe, SWIPE_SETTLE_MS } from '../gestures/useSwipe';
import { usePinchZoom } from '../gestures/usePinchZoom';
import { ImageLoader } from './ImageLoader';

/** Musí sedět s CSS transition duration na fade overlay níž. */
export const FADE_MS = 400;

export interface StageHandle {
  /**
   * Programové přehození o jednu fotku se zvoleným typem přechodu — volá
   * Slideshow.tsx přes WpView.tsx (viz `settings.slideshowTransition`).
   * 'none' sem vůbec nechodí, to WpView řeší rovnou (goNext/goPrev), bez
   * animace není co ve Stage dělat.
   */
  advance(direction: 'next' | 'prev', transition: 'fade' | 'slide'): void;
}

interface StageProps {
  item: ViewerItem;
  /** Vyřešený zdroj — edit blobUrl (viz state/reducer edit slice) nebo item.fullSrc. */
  displaySrc: string;
  /** Sousední položky z okna (viz CONTRACT.md windowing) — pro živý sliding swipe. Chybí na kraji okna/galerie. */
  prevItem?: ViewerItem | undefined;
  nextItem?: ViewerItem | undefined;
  doubleTapZoom: number;
  onSwipeNext?: (() => void) | undefined;
  onSwipePrev?: (() => void) | undefined;
  onSwipeDown?: (() => void) | undefined;
  /** Klik/ťuknutí na fotku bez tažení — typicky toggle viditelnosti ovládání. */
  onTap?: (() => void) | undefined;
  onContextMenu?: ((x: number, y: number) => void) | undefined;
  swipeDisabled?: boolean;
}

/**
 * Skládá gesta (swipe + pinch) nad jedním containerem a vykresluje aktuální
 * fotku PLUS sousední dvě v odsunutých slotech (-100%/0/+100%), ať je vidět
 * plynulý swipe mezi fotkami, ne jen posun a skoková náhrada. `dragOffsetX`
 * (živé tažení i dojíždějící swipe po puštění — viz useSwipe) se přičítá ke
 * všem třem slotům stejně; funguje, protože se sousední fotka po dojetí
 * přehodí na "current" ve STEJNÉM tiku, kdy offset skočí zpátky na 0 (matika
 * v komentářích níž) — vizuálně navazuje beze švu.
 *
 * `ref` (StageHandle.advance) dává WpView/Slideshow programový přístup ke
 * stejné dojíždějící swipe animaci ('slide') nebo k samostatnému cross-fade
 * ('fade') — auto-advance bez prstu na spouštěči.
 */
export const Stage = forwardRef<StageHandle, StageProps>(function Stage(
  {
    item,
    displaySrc,
    prevItem,
    nextItem,
    doubleTapZoom,
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    onContextMenu,
    swipeDisabled = false,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, translateX, translateY, isPinching, isPanning, resetZoom, setZoom } =
    usePinchZoom(containerRef, {});
  // Zoomed in (pinch or double-tap) -> dragging pans the photo, not the
  // carousel. Without this, a drag while zoomed fired onSwipeNext/
  // onSwipeDown instead of panning — there was no way to see the rest of
  // an enlarged photo.
  const zoomedIn = scale > 1;
  const { dragOffsetX, dragOffsetY, isDragging, suppressTransition, triggerAdvance } = useSwipe(containerRef, {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    canSwipeNext: !!nextItem,
    canSwipePrev: !!prevItem,
    disabled: swipeDisabled || zoomedIn,
  });

  // Cross-fade auto-advance (transitionType: 'fade') — nezávislé na useSwipe,
  // ta řeší jen pozici (translateX), tohle jen opacity dvou překrývajících
  // se vrstev na stejném místě. `progressing` začíná false (overlay
  // namountovaný na opacity 0, current na 1), o snímek později (2x rAF, ať
  // to prohlížeč stihne vykreslit před zapnutím transition — stejný trik
  // jako suppressTransition v useSwipe.ts) skočí na true, což s CSS
  // `transition: opacity` na obou vrstvách rozjede skutečný cross-fade.
  const [fadeTransition, setFadeTransition] = useState<{ direction: 'next' | 'prev'; progressing: boolean } | null>(
    null,
  );
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    };
  }, []);

  const runFade = useCallback(
    (direction: 'next' | 'prev') => {
      const target = direction === 'next' ? nextItem : prevItem;
      const after = direction === 'next' ? onSwipeNext : onSwipePrev;
      if (!target || !after) return;
      setFadeTransition({ direction, progressing: false });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFadeTransition((cur) => (cur ? { ...cur, progressing: true } : cur));
        });
      });
      fadeTimer.current = setTimeout(() => {
        after();
        setFadeTransition(null);
      }, FADE_MS);
    },
    [nextItem, prevItem, onSwipeNext, onSwipePrev],
  );

  useImperativeHandle(
    ref,
    () => ({
      advance(direction, transition) {
        if (transition === 'slide') triggerAdvance(direction);
        else runFade(direction);
      },
    }),
    [triggerAdvance, runFade],
  );

  useEffect(() => {
    resetZoom();
  }, [item.id, resetZoom]);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setZoom(doubleTapZoom);
    }
  }, [scale, doubleTapZoom, setZoom, resetZoom]);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!onContextMenu) return;
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    },
    [onContextMenu],
  );

  // suppressTransition vyhrává vždy — je to přesně ten jeden snímek, kdy
  // offset skáče zpátky na 0 po přehození indexu a NESMÍ se to animovat
  // (viz useSwipe.ts settle()), i kdyby isDragging/isPinching zrovna byly
  // false (jsou, v tu chvíli gesto už skončilo).
  const transition = suppressTransition
    ? 'none'
    : isDragging || isPinching || isPanning
      ? 'none'
      : `transform ${SWIPE_SETTLE_MS}ms ease, opacity ${SWIPE_SETTLE_MS}ms ease`;

  // Táhnutí dolů (swipe-to-close) bledne úměrně vzdálenosti — vizuální signál,
  // že puštění zavře. Nikdy pod 0.4, ať fotka úplně nezmizí před release.
  // Cross-fade auto-advance má přednost — fadeTransition.progressing řídí
  // opacity current dlaždice symetricky k overlay níž.
  const currentOpacity = fadeTransition
    ? fadeTransition.progressing
      ? 0
      : 1
    : dragOffsetY > 0
      ? Math.max(0.4, 1 - dragOffsetY / 400)
      : 1;

  const currentStyle: CSSProperties = {
    transform: `translateX(${dragOffsetX}px) translateY(${dragOffsetY}px)`,
    opacity: currentOpacity,
    transition: fadeTransition ? `opacity ${FADE_MS}ms ease` : transition,
  };
  const prevStyle: CSSProperties = {
    transform: `translateX(calc(-100% + ${dragOffsetX}px))`,
    transition,
  };
  const nextStyle: CSSProperties = {
    transform: `translateX(calc(100% + ${dragOffsetX}px))`,
    transition,
  };

  const fadeItem = fadeTransition && (fadeTransition.direction === 'next' ? nextItem : prevItem);

  return (
    <div
      ref={containerRef}
      className="wpview-stage"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {prevItem && (
        <div className="wpview-stage__slide" style={prevStyle} aria-hidden="true">
          <ImageLoader src={prevItem.fullSrc} placeholderSrc={prevItem.thumbSrc} alt="" zoom={1} />
        </div>
      )}
      <div className="wpview-stage__slide wpview-stage__slide--current" style={currentStyle}>
        <ImageLoader
          src={displaySrc}
          placeholderSrc={item.thumbSrc}
          alt={typeof item.meta?.['filename'] === 'string' ? (item.meta['filename'] as string) : ''}
          zoom={scale}
          panX={translateX}
          panY={translateY}
        />
      </div>
      {nextItem && (
        <div className="wpview-stage__slide" style={nextStyle} aria-hidden="true">
          <ImageLoader src={nextItem.fullSrc} placeholderSrc={nextItem.thumbSrc} alt="" zoom={1} />
        </div>
      )}
      {fadeItem && (
        <div
          className="wpview-stage__slide"
          style={{ opacity: fadeTransition?.progressing ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
          aria-hidden="true"
        >
          <ImageLoader src={fadeItem.fullSrc} placeholderSrc={fadeItem.thumbSrc} alt="" zoom={1} />
        </div>
      )}
    </div>
  );
});
