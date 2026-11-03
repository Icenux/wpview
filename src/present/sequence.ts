import type { Settings, ViewerItem } from '../contract/types';

type SequenceSettings = Pick<Settings, 'slideshowLoop' | 'slideshowShuffle' | 'slideshowContent'>;

/** Další index ve slideshow, `'wait'` (konec okna, ale `hasMore.next` — počkat na další okno) nebo `null` (konec, zastavit). */
export type NextIndex = number | 'wait' | null;

function isEligible(item: ViewerItem, content: Settings['slideshowContent']): boolean {
  if (content === 'all') return true;
  const isVideo = item.type === 'video';
  return content === 'videos' ? isVideo : !isVideo;
}

/**
 * Čistá funkce — pořadí slideshow (sekvenčně / náhodně, filtr foto/video,
 * opakování). Pracuje jen nad oknem `items`, ne nad celou galerií (viz
 * windowing v CONTRACT.md): shuffle i loop se tedy drží v okně.
 */
export function nextSlideshowIndex(
  items: ViewerItem[],
  index: number,
  settings: SequenceSettings,
  hasMoreNext: boolean,
  random: () => number = Math.random,
): NextIndex {
  const eligible: number[] = [];
  items.forEach((item, i) => {
    if (isEligible(item, settings.slideshowContent)) eligible.push(i);
  });
  const others = eligible.filter((i) => i !== index);

  if (settings.slideshowShuffle) {
    if (others.length === 0) return null;
    return others[Math.floor(random() * others.length)]!;
  }

  const after = others.find((i) => i > index);
  if (after !== undefined) return after;
  if (hasMoreNext) return 'wait';
  if (settings.slideshowLoop) return others.find((i) => i < index) ?? null;
  return null;
}
