import { useEffect, useRef } from 'react';

interface SlideshowProps {
  active: boolean;
  intervalMs: number;
  /** true = aktuální položka je video — nečasuje se, čeká se na jeho konec (WpView volá advance z `onVideoEnded`). */
  holdForVideo: boolean;
  /** Vrací false => není kam postoupit, slideshow se sama ukončí. */
  onAdvance: () => boolean;
  onExit: () => void;
}

/** Headless: žádný vlastní markup, jen interval řídící auto-advance přes onIndexChange. */
export function Slideshow({ active, intervalMs, holdForVideo, onAdvance, onExit }: SlideshowProps) {
  // Callbacky se mění s každým indexem; přes ref se interval kvůli nim nerestartuje.
  const advanceRef = useRef(onAdvance);
  const exitRef = useRef(onExit);
  advanceRef.current = onAdvance;
  exitRef.current = onExit;

  useEffect(() => {
    if (!active || holdForVideo) return;
    const id = window.setInterval(() => {
      if (!advanceRef.current()) exitRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs, holdForVideo]);

  return null;
}
