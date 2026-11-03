import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  slideshowMs: 4000,
  slideshowTransition: 'fade',
  slideshowLoop: false,
  slideshowShuffle: false,
  slideshowContent: 'all',
  autoplaySlideshow: false,
  autoplayVideo: false,
  doubleTapZoom: 2,
  theme: 'system',
};

export const SETTINGS_STORAGE_PREFIX = 'wpview:';

/** Práh (počet položek od kraje okna), kdy wpview žádá o víc přes onRequestMore. */
export const WINDOW_EDGE_THRESHOLD = 2;
