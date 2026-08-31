import { useEffect, useRef, useState } from 'react';
import { ICON } from '../actions/registry';

interface RatingStarsProps {
  /** 0-5 */
  value: number;
  /** Chybí => read-only zobrazení. */
  onChange?: ((value: number) => void) | undefined;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Sbaleno je to jedna hvězda (36px, stejně jako ostatní tlačítka toolbaru) —
 * pět hvězd natrvalo v liště bylo na mobilu hlavní příčinou toho, že se
 * poslední tlačítka (Settings) vešla mimo obrazovku (viz .wpview-toolbar
 * overflow fix). Klik/ťuknutí rozbalí klasický pěti-hvězdový picker; výběr
 * hodnoty picker zase automaticky sbalí.
 */
export function RatingStars({ value, onChange }: RatingStarsProps) {
  const readOnly = !onChange;
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setExpanded(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

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
      {expanded ? (
        <div className="wpview-rating-stars__picker" role="radiogroup" aria-label="Rating">
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
      ) : (
        <button
          type="button"
          className={`wpview-icon-button wpview-rating-stars__toggle${
            value > 0 ? ' wpview-icon-button--active' : ''
          }`}
          onClick={() => setExpanded(true)}
          aria-label={value > 0 ? `Rating: ${value} star${value === 1 ? '' : 's'}. Tap to change.` : 'Set rating'}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path d={ICON.star} fill="currentColor" />
          </svg>
          {value > 0 && <span className="wpview-rating-stars__badge">{value}</span>}
        </button>
      )}
    </div>
  );
}
