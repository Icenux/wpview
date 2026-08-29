import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface UseFullscreenResult {
  isFullscreen: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

/** Tenký wrapper nad Fullscreen API. Selhání (chybějící gesto, nepodporováno) je tiché no-op. */
export function useFullscreen(ref: RefObject<HTMLElement | null>): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === ref.current);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  const enter = useCallback(() => {
    const el = ref.current;
    if (!el || document.fullscreenElement) return;
    el.requestFullscreen().catch(() => {
      // Bez uživatelského gesta nebo v nepodporovaném prohlížeči — zůstane v okně.
    });
  }, [ref]);

  const exit = useCallback(() => {
    if (!document.fullscreenElement) return;
    document.exitFullscreen().catch(() => {
      // no-op
    });
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}
