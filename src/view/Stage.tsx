import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { ViewerItem } from '../contract/types';
import { useSwipe, SWIPE_SETTLE_MS } from '../gestures/useSwipe';
import { usePinchZoom } from '../gestures/usePinchZoom';
import { ImageLoader } from './ImageLoader';

interface StageProps {
  item: ViewerItem;
  /** Vyřešený zdroj — edit blobUrl (viz state/reducer edit slice) nebo item.fullSrc. */
  displaySrc: string;
  /** Sousední položky z okna (viz CONTRACT.md windowing) — pro živý sliding swipe. Chybí na kraji okna/galerie. */
  prevItem?: ViewerItem | undefined;
  nextItem?: ViewerItem | undefined;
  zoomMode: 'fit' | 'actual';
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
 */
export function Stage({
  item,
  displaySrc,
  prevItem,
  nextItem,
  zoomMode,
  doubleTapZoom,
  onSwipeNext,
  onSwipePrev,
  onSwipeDown,
  onTap,
  onContextMenu,
  swipeDisabled = false,
}: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 'actual' renders the photo at native pixel size (object-fit: none) —
  // it overflows the viewport even with no pinch/double-tap zoom, so it
  // must be pannable from scale 1, not just once scale climbs past it.
  const alwaysPannable = zoomMode === 'actual';
  const { scale, translateX, translateY, isPinching, isPanning, resetZoom, setZoom } = usePinchZoom(
    containerRef,
    { alwaysPannable },
  );
  // Zoomed in (either way) -> dragging pans the photo, not the carousel.
  // Without this, a drag while zoomed fired onSwipeNext/onSwipeDown instead
  // of panning — there was no way to see the rest of an enlarged photo.
  const zoomedIn = scale > 1 || alwaysPannable;
  const { dragOffsetX, dragOffsetY, isDragging, suppressTransition } = useSwipe(containerRef, {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    canSwipeNext: !!nextItem,
    canSwipePrev: !!prevItem,
    disabled: swipeDisabled || zoomedIn,
  });

  useEffect(() => {
    resetZoom();
  }, [item.id, resetZoom]);

  // Switching the zoomMode setting itself (Fit <-> Actual size) starts over —
  // a leftover pan offset from one mode makes no sense once the image's
  // rendered size/position changes under it.
  useEffect(() => {
    resetZoom();
  }, [zoomMode, resetZoom]);

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
  const currentOpacity = dragOffsetY > 0 ? Math.max(0.4, 1 - dragOffsetY / 400) : 1;

  const currentStyle: CSSProperties = {
    transform: `translateX(${dragOffsetX}px) translateY(${dragOffsetY}px)`,
    opacity: currentOpacity,
    transition,
  };
  const prevStyle: CSSProperties = {
    transform: `translateX(calc(-100% + ${dragOffsetX}px))`,
    transition,
  };
  const nextStyle: CSSProperties = {
    transform: `translateX(calc(100% + ${dragOffsetX}px))`,
    transition,
  };

  return (
    <div
      ref={containerRef}
      className="wpview-stage"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {prevItem && (
        <div className="wpview-stage__slide" style={prevStyle} aria-hidden="true">
          <ImageLoader src={prevItem.fullSrc} placeholderSrc={prevItem.thumbSrc} alt="" fit={zoomMode} zoom={1} />
        </div>
      )}
      <div className="wpview-stage__slide wpview-stage__slide--current" style={currentStyle}>
        <ImageLoader
          src={displaySrc}
          placeholderSrc={item.thumbSrc}
          alt={typeof item.meta?.['filename'] === 'string' ? (item.meta['filename'] as string) : ''}
          fit={zoomMode}
          zoom={scale}
          panX={translateX}
          panY={translateY}
        />
      </div>
      {nextItem && (
        <div className="wpview-stage__slide" style={nextStyle} aria-hidden="true">
          <ImageLoader src={nextItem.fullSrc} placeholderSrc={nextItem.thumbSrc} alt="" fit={zoomMode} zoom={1} />
        </div>
      )}
    </div>
  );
}
