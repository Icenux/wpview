import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ViewerItem } from '../contract/types';
import { useSwipe } from '../gestures/useSwipe';
import { usePinchZoom } from '../gestures/usePinchZoom';
import { ImageLoader } from './ImageLoader';

interface StageProps {
  item: ViewerItem;
  /** Vyřešený zdroj — edit blobUrl (viz state/reducer edit slice) nebo item.fullSrc. */
  displaySrc: string;
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

/** Skládá gesta (swipe + pinch) nad jedním containerem a vykresluje aktuální fotku. */
export function Stage({
  item,
  displaySrc,
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
  const { dragOffsetX, dragOffsetY, isDragging } = useSwipe(containerRef, {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    disabled: swipeDisabled,
  });
  const { scale, isPinching, resetZoom, setZoom } = usePinchZoom(containerRef, {});

  useEffect(() => {
    resetZoom();
  }, [item.id, resetZoom]);

  const handleDoubleClick = useCallback(() => {
    setZoom(scale > 1 ? 1 : doubleTapZoom);
  }, [scale, doubleTapZoom, setZoom]);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!onContextMenu) return;
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    },
    [onContextMenu],
  );

  const transform =
    dragOffsetX !== 0
      ? `translateX(${dragOffsetX}px)`
      : dragOffsetY !== 0
        ? `translateY(${dragOffsetY}px)`
        : undefined;
  // Táhnutí dolů (swipe-to-close) bledne úměrně vzdálenosti — vizuální signál,
  // že puštění zavře. Nikdy pod 0.4, ať fotka úplně nezmizí před release.
  const opacity = dragOffsetY > 0 ? Math.max(0.4, 1 - dragOffsetY / 400) : 1;

  return (
    <div
      ref={containerRef}
      className="wpview-stage"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        transform,
        opacity,
        transition: isDragging || isPinching ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
      }}
    >
      <ImageLoader
        src={displaySrc}
        placeholderSrc={item.thumbSrc}
        alt={typeof item.meta?.['filename'] === 'string' ? (item.meta['filename'] as string) : ''}
        fit={zoomMode}
        zoom={scale}
      />
    </div>
  );
}
