import { useEffect } from 'react';
import type { ViewerItem } from '../contract/types';

/** Warmuje prohlížečovou cache pro sousední fotky, ať swipe/šipka necekne prázdno. */
export function usePreload(items: ViewerItem[], index: number, radius = 1): void {
  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      if (offset === 0) continue;
      const item = items[index + offset];
      if (!item) continue;
      const img = new Image();
      img.src = item.type === 'video' ? item.thumbSrc : item.fullSrc;
      images.push(img);
    }
    return () => {
      for (const img of images) img.src = '';
    };
  }, [items, index, radius]);
}
