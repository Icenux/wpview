import { useCallback, useEffect, useRef } from 'react';
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
  swipeDisabled = false,
}: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { dragOffsetX, isDragging } = useSwipe(containerRef, {
    onSwipeNext,
    onSwipePrev,
    disabled: swipeDisabled,
  });
  const { scale, isPinching, resetZoom, setZoom } = usePinchZoom(containerRef, {});

  useEffect(() => {
    resetZoom();
  }, [item.id, resetZoom]);

  const handleDoubleClick = useCallback(() => {
    setZoom(scale > 1 ? 1 : doubleTapZoom);
  }, [scale, doubleTapZoom, setZoom]);

  return (
    <div
      ref={containerRef}
      className="wpview-stage"
      onDoubleClick={handleDoubleClick}
      style={{
        transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined,
        transition: isDragging || isPinching ? 'none' : 'transform 0.2s ease',
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
