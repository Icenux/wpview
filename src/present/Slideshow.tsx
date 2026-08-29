import { useEffect } from 'react';

interface SlideshowProps {
  active: boolean;
  intervalMs: number;
  /** false = na konci okna bez `hasMore.next` — slideshow se sama ukončí. */
  canAdvance: boolean;
  onAdvance: () => void;
  onExit: () => void;
}

/** Headless: žádný vlastní markup, jen interval řídící auto-advance přes onIndexChange. */
export function Slideshow({ active, intervalMs, canAdvance, onAdvance, onExit }: SlideshowProps) {
  useEffect(() => {
    if (!active) return;
    if (!canAdvance) {
      onExit();
      return;
    }
    const id = window.setInterval(onAdvance, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs, canAdvance, onAdvance, onExit]);

  return null;
}
