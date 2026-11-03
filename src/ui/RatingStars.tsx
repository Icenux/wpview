import { useEffect, useRef, useState } from 'react';
import { ICON } from '../actions/registry';

interface RatingStarsProps {
  /** 0-5 */
  value: number;
  /** Chybí => read-only zobrazení. */
  onChange?: ((value: number) => void) | undefined;
}

const STARS = [1, 2, 3, 4, 5];
/** Mezera mezi tlačítkem a popoverem + odhad poloviny šířky popoveru, jen pro clamp na okrajích obrazovky. */
const POPOVER_GAP = 8;
const POPOVER_HALF_WIDTH_ESTIMATE = 60;

interface Anchor {
  /** Vzdálenost popoveru od spodního okraje viewportu (position: fixed) — bottom, ne top, ať popover roste NAHORU bez ohledu na svou (předem neznámou) výšku. */
  bottom: number;
  left: number;
}

/**
 * Sbaleno je to jedna hvězda (36px, stejně jako ostatní tlačítka toolbaru) —
 * pět hvězd natrvalo v liště bylo na mobilu hlavní příčinou toho, že se
 * poslední tlačítka (Settings) vešla mimo obrazovku (viz .wpview-toolbar
 * overflow fix). Klik/ťuknutí otevře pěti-hvězdový picker jako popover NAD
 * tlačítkem (`position: fixed`, měřeno přes getBoundingClientRect) — ne
 * inline v řádku, což by tlačítka v liště posouvalo, a ne `position:
 * absolute` v `.wpview-toolbar`, ten má kvůli horizontálnímu scrollu (viz
 * overflow fix) `overflow-y: hidden`, které by popover nad řádkem oříznulo.
 * Výběr hodnoty picker zase automaticky zavře.
 */
export function RatingStars({ value, onChange }: RatingStarsProps) {
  const readOnly = !onChange;
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setExpanded(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  function openPicker() {
    const rect = toggleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.min(
      Math.max(centerX, POPOVER_HALF_WIDTH_ESTIMATE + POPOVER_GAP),
      window.innerWidth - POPOVER_HALF_WIDTH_ESTIMATE - POPOVER_GAP,
    );
    setAnchor({ bottom: window.innerHeight - rect.top + POPOVER_GAP, left: clampedX });
    setExpanded(true);
  }

  function pick(star: number) {
    onChange?.(star === value ? 0 : star);
    setExpanded(false);
  }

  if (readOnly) {
    return (
      <div className="wpview-rating-stars wpview-rating-stars--readonly" aria-label={`Rating: ${value} star${value === 1 ? '' : 's'}`}>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
          <path d={ICON.star} fill="currentColor" />
        </svg>
        {value > 0 && <span className="wpview-rating-stars__badge">{value}</span>}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="wpview-rating-stars">
      <button
        ref={toggleRef}
        type="button"
        className={`wpview-icon-button wpview-rating-stars__toggle${
          value > 0 ? ' wpview-icon-button--active' : ''
        }${expanded ? ' wpview-icon-button--active' : ''}`}
        onClick={() => (expanded ? setExpanded(false) : openPicker())}
        aria-expanded={expanded}
        aria-label={value > 0 ? `Rating: ${value} star${value === 1 ? '' : 's'}. Tap to change.` : 'Set rating'}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
          <path d={ICON.star} fill="currentColor" />
        </svg>
        {value > 0 && <span className="wpview-rating-stars__badge">{value}</span>}
      </button>

      {expanded && anchor && (
        <div
          className="wpview-rating-stars__picker"
          role="radiogroup"
          aria-label="Rating"
          style={{ position: 'fixed', bottom: anchor.bottom, left: anchor.left, transform: 'translateX(-50%)' }}
        >
          {STARS.map((star) => (
            <button
              key={star}
              type="button"
              className={`wpview-rating-stars__star${
                star <= value ? ' wpview-rating-stars__star--filled' : ''
              }`}
              onClick={() => pick(star)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
                <path d={ICON.star} fill="currentColor" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
