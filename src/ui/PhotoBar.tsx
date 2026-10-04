import { useEffect, useRef } from 'react';
import type { ViewerItem } from '../contract/types';

interface PhotoBarProps {
  items: ViewerItem[];
  index: number;
  onSelect: (index: number) => void;
}

/** Kolik miniatur na každou stranu od aktuální se vykresluje (okno může být velké). */
const RADIUS = 12;

/**
 * Pás miniatur pod hlavní fotkou: aktuální uprostřed (větší), předchozí
 * vlevo a následující vpravo. Dumb komponenta — výběr jen hlásí nahoru.
 */
export function PhotoBar({ items, index, onSelect }: PhotoBarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const cur = currentRef.current;
    if (!list || !cur || typeof list.scrollTo !== 'function') return;
    list.scrollTo({ left: cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
  }, [index]);

  const start = Math.max(0, index - RADIUS);
  const end = Math.min(items.length, index + RADIUS + 1);

  return (
    <div ref={listRef} className="wpview-photobar" role="listbox" aria-label="Photos">
      {items.slice(start, end).map((item, i) => {
        const itemIndex = start + i;
        const current = itemIndex === index;
        return (
          <button
            key={item.id}
            ref={current ? currentRef : undefined}
            type="button"
            role="option"
            aria-selected={current}
            aria-label={`Photo ${itemIndex + 1}`}
            className={`wpview-photobar__thumb${current ? ' wpview-photobar__thumb--current' : ''}`}
            onClick={() => onSelect(itemIndex)}
          >
            <img src={item.thumbSrc} alt="" draggable={false} loading="lazy" />
            {item.type === 'video' && <span className="wpview-photobar__badge">▶</span>}
          </button>
        );
      })}
    </div>
  );
}
