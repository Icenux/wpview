import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { SlideshowTransition, ViewerItem } from '../contract/types';
import { getFilename } from './filename';
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
  advance(direction: 'next' | 'prev', transition: Exclude<SlideshowTransition, 'none'>): void;
  /**
   * Přechod na libovolnou (i nesousední) položku — shuffle/loop/přeskakování
   * filtrem. 'slide' se tu degraduje na 'fade' (carousel umí jen sousedy).
   * `commit` se zavolá až PO animaci (stejné pravidlo jako u swipe).
   */
  jumpTo(target: ViewerItem, transition: Exclude<SlideshowTransition, 'none'>, commit: () => void): void;
}

type OverlayType = Exclude<SlideshowTransition, 'none' | 'slide'>;

const PERSPECTIVE = 'perspective(1200px)';

/**
 * Počáteční (`progressing: false`) a cílový stav obou vrstev přechodu.
 * `cur` = odcházející fotka, `incoming` = nastupující. Obě dostanou CSS
 * `transition` na transform/opacity/filter, takže stačí přepnout `progressing`.
 */
function overlayStyles(
  type: OverlayType,
  direction: 'next' | 'prev',
  progressing: boolean,
): { cur: CSSProperties; incoming: CSSProperties } {
  const sign = direction === 'next' ? 1 : -1;
  switch (type) {
    case 'zoom':
      return {
        cur: { transform: progressing ? 'scale(1.3)' : 'scale(1)', opacity: progressing ? 0 : 1 },
        incoming: { transform: progressing ? 'scale(1)' : 'scale(0.75)', opacity: progressing ? 1 : 0 },
      };
    case 'flip':
      return {
        cur: {
          transform: `${PERSPECTIVE} rotateY(${progressing ? -90 * sign : 0}deg)`,
          opacity: progressing ? 0 : 1,
        },
        incoming: {
          transform: `${PERSPECTIVE} rotateY(${progressing ? 0 : 90 * sign}deg)`,
          opacity: progressing ? 1 : 0,
        },
      };
    case 'blur':
      return {
        cur: { filter: progressing ? 'blur(24px)' : 'blur(0px)', opacity: progressing ? 0 : 1 },
        incoming: { filter: progressing ? 'blur(0px)' : 'blur(24px)', opacity: progressing ? 1 : 0 },
      };
    case 'fade':
    default:
      return {
        cur: { opacity: progressing ? 0 : 1 },
        incoming: { opacity: progressing ? 1 : 0 },
      };
  }
}

/** U videa se v carouselu/přechodech ukazuje poster, ne přehrávač. */
function stillSrc(item: ViewerItem): string {
  return item.type === 'video' ? item.thumbSrc : item.fullSrc;
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
  /** Video se po zobrazení samo spustí (settings.autoplayVideo, nebo běží slideshow). */
  autoplayVideo?: boolean;
  /** Slideshow autoplay videa musí být muted, jinak ho prohlížeč zablokuje. */
  muteVideo?: boolean;
  onVideoEnded?: (() => void) | undefined;
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
    autoplayVideo = false,
    muteVideo = false,
    onVideoEnded,
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
  const [overlay, setOverlay] = useState<{
    target: ViewerItem;
    direction: 'next' | 'prev';
    type: OverlayType;
    progressing: boolean;
  } | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayBusy = useRef(false);

  useEffect(() => {
    return () => {
      if (overlayTimer.current !== null) clearTimeout(overlayTimer.current);
    };
  }, []);

  const runOverlay = useCallback(
    (target: ViewerItem, direction: 'next' | 'prev', type: OverlayType, commit: () => void) => {
      if (overlayBusy.current) return;
      overlayBusy.current = true;
      setOverlay({ target, direction, type, progressing: false });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOverlay((cur) => (cur ? { ...cur, progressing: true } : cur));
        });
      });
      overlayTimer.current = setTimeout(() => {
        commit();
        setOverlay(null);
        overlayBusy.current = false;
      }, FADE_MS);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      advance(direction, transition) {
        if (transition === 'slide') {
          triggerAdvance(direction);
          return;
        }
        const target = direction === 'next' ? nextItem : prevItem;
        const after = direction === 'next' ? onSwipeNext : onSwipePrev;
        if (target && after) runOverlay(target, direction, transition, after);
      },
      jumpTo(target, transition, commit) {
        runOverlay(target, 'next', transition === 'slide' ? 'fade' : transition, commit);
      },
    }),
    [triggerAdvance, runOverlay, nextItem, prevItem, onSwipeNext, onSwipePrev],
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
  // Overlay přechod (slideshow) má přednost — jeho styly řídí odcházející i
  // nastupující vrstvu symetricky.
  const overlayStyle = overlay ? overlayStyles(overlay.type, overlay.direction, overlay.progressing) : null;
  const overlayTransition = `transform ${FADE_MS}ms ease, opacity ${FADE_MS}ms ease, filter ${FADE_MS}ms ease`;
  const dragOpacity = dragOffsetY > 0 ? Math.max(0.4, 1 - dragOffsetY / 400) : 1;

  const baseTransform = `translateX(${dragOffsetX}px) translateY(${dragOffsetY}px)`;
  const currentStyle: CSSProperties = overlayStyle
    ? {
        ...overlayStyle.cur,
        transform: `${baseTransform} ${overlayStyle.cur.transform ?? ''}`.trim(),
        transition: overlayTransition,
      }
    : { transform: baseTransform, opacity: dragOpacity, transition };
  const prevStyle: CSSProperties = {
    transform: `translateX(calc(-100% + ${dragOffsetX}px))`,
    transition,
  };
  const nextStyle: CSSProperties = {
    transform: `translateX(calc(100% + ${dragOffsetX}px))`,
    transition,
  };

  const isVideo = item.type === 'video' && displaySrc === item.fullSrc;

  // Atribut autoPlay se uplatní jen při vložení elementu — start slideshow
  // nebo zapnutí nastavení na už zobrazeném videu by ho nespustilo. Zablokované
  // přehrání ve slideshow se bere jako "video skončilo", ať slideshow nezamrzne.
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(onVideoEnded);
  endedRef.current = onVideoEnded;
  useEffect(() => {
    const video = videoRef.current;
    if (!isVideo || !autoplayVideo || !video) return;
    void Promise.resolve(video.play()).catch(() => {
      if (muteVideo) endedRef.current?.();
    });
  }, [isVideo, autoplayVideo, muteVideo, item.id]);

  return (
    <div
      ref={containerRef}
      className="wpview-stage"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {prevItem && (
        <div className="wpview-stage__slide" style={prevStyle} aria-hidden="true">
          <ImageLoader src={stillSrc(prevItem)} placeholderSrc={prevItem.thumbSrc} alt="" zoom={1} />
        </div>
      )}
      <div className="wpview-stage__slide wpview-stage__slide--current" style={currentStyle}>
        {isVideo ? (
          <video
            key={item.id}
            ref={videoRef}
            className="wpview-stage__video"
            src={item.fullSrc}
            poster={item.thumbSrc}
            controls
            playsInline
            autoPlay={autoplayVideo}
            muted={muteVideo}
            onEnded={onVideoEnded}
          />
        ) : (
          <ImageLoader
            src={displaySrc}
            placeholderSrc={item.thumbSrc}
            alt={getFilename(item)}
            zoom={scale}
            panX={translateX}
            panY={translateY}
          />
        )}
      </div>
      {nextItem && (
        <div className="wpview-stage__slide" style={nextStyle} aria-hidden="true">
          <ImageLoader src={stillSrc(nextItem)} placeholderSrc={nextItem.thumbSrc} alt="" zoom={1} />
        </div>
      )}
      {overlay && overlayStyle && (
        <div
          className="wpview-stage__slide"
          style={{ ...overlayStyle.incoming, transition: overlayTransition }}
          aria-hidden="true"
        >
          <ImageLoader src={stillSrc(overlay.target)} placeholderSrc={overlay.target.thumbSrc} alt="" zoom={1} />
        </div>
      )}
    </div>
  );
});
