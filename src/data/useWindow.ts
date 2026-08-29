import { useEffect, useRef } from 'react';
import { WINDOW_EDGE_THRESHOLD } from '../contract/defaults';

interface UseWindowArgs {
  index: number;
  itemsLength: number;
  hasMore?: { prev: boolean; next: boolean } | undefined;
  onRequestMore?: ((dir: 'prev' | 'next') => void) | undefined;
  threshold?: number;
}

/**
 * `items` je jen okno kolem `index` (viz CONTRACT.md „Windowing"). Na kraji
 * okna zavolá `onRequestMore(dir)` — nejvýš jednou za daný `index`, ať
 * re-render bez posunu indexu nespamuje consumera opakovanými požadavky.
 */
export function useWindow({
  index,
  itemsLength,
  hasMore,
  onRequestMore,
  threshold = WINDOW_EDGE_THRESHOLD,
}: UseWindowArgs): void {
  const requestedAt = useRef<{ prev: number | null; next: number | null }>({
    prev: null,
    next: null,
  });

  useEffect(() => {
    if (!onRequestMore || itemsLength === 0) return;

    const nearStart = index <= threshold;
    const nearEnd = index >= itemsLength - 1 - threshold;

    if (nearStart && hasMore?.prev !== false && requestedAt.current.prev !== index) {
      requestedAt.current.prev = index;
      onRequestMore('prev');
    }
    if (nearEnd && hasMore?.next !== false && requestedAt.current.next !== index) {
      requestedAt.current.next = index;
      onRequestMore('next');
    }
  }, [index, itemsLength, hasMore?.prev, hasMore?.next, onRequestMore, threshold]);
}
