import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ViewerItem } from '../contract/types';

interface PhotoBarProps {
  items: ViewerItem[];
  index: number;
  onSelect: (index: number) => void;
  hasMore?: { prev: boolean; next: boolean } | undefined;
  /** Lišta dojela ke kraji okna — consumer má dodat další položky. */
  onRequestMore?: ((dir: 'prev' | 'next') => void) | undefined;
}

/** Vzdálenost od kraje (px), od které se žádá o další miniatury. */
const EDGE_PX = 300;

/**
 * Pás miniatur pod hlavní fotkou: aktuální uprostřed (větší), předchozí
 * vlevo a následující vpravo. Dumb komponenta — výběr jen hlásí nahoru.
 */
export function PhotoBar({ items, index, onSelect, hasMore, onRequestMore }: PhotoBarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const cur = currentRef.current;
    if (!list || !cur || typeof list.scrollTo !== 'function') return;
    list.scrollTo({ left: cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
  }, [index]);

  // Okno se může rozšířit i doleva (prepend) — bez korekce by se pás „posunul"
  // pod prstem. Držíme pozici první viditelné miniatury.
  const firstId = items[0]?.id;
  const prev = useRef<{ firstId: string | undefined; scrollWidth: number }>({ firstId, scrollWidth: 0 });
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const before = prev.current;
    if (before.firstId !== firstId && before.scrollWidth > 0 && items.some((it) => it.id === before.firstId)) {
      list.scrollLeft += list.scrollWidth - before.scrollWidth;
    }
    prev.current = { firstId, scrollWidth: list.scrollWidth };
  }, [firstId, items]);

  // Každý směr se žádá nejvýš jednou na danou délku okna.
  const requested = useRef<{ prev: number; next: number }>({ prev: -1, next: -1 });
  function handleScroll() {
    const list = listRef.current;
    if (!list || !onRequestMore) return;
    prev.current.scrollWidth = list.scrollWidth;
    if (list.scrollLeft < EDGE_PX && hasMore?.prev !== false && requested.current.prev !== items.length) {
      requested.current.prev = items.length;
      onRequestMore('prev');
    }
    if (
      list.scrollWidth - list.scrollLeft - list.clientWidth < EDGE_PX &&
      hasMore?.next !== false &&
      requested.current.next !== items.length
    ) {
      requested.current.next = items.length;
      onRequestMore('next');
    }
  }

  return (
    <div ref={listRef} className="wpview-photobar" role="listbox" aria-label="Photos" onScroll={handleScroll}>
      {items.map((item, itemIndex) => {
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
