import { ICON } from '../actions/registry';

interface RatingStarsProps {
  /** 0-5 */
  value: number;
  /** Chybí => read-only zobrazení. */
  onChange?: ((value: number) => void) | undefined;
}

const STARS = [1, 2, 3, 4, 5];

export function RatingStars({ value, onChange }: RatingStarsProps) {
  const readOnly = !onChange;
  return (
    <div className="wpview-rating-stars" role={readOnly ? undefined : 'radiogroup'} aria-label="Rating">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          className={`wpview-rating-stars__star${
            star <= value ? ' wpview-rating-stars__star--filled' : ''
          }`}
          // Klik na aktuální hodnotu ji vynuluje (toggle-off), stejný vzorec jako gallery RatingStars.
          onClick={readOnly ? undefined : () => onChange?.(star === value ? 0 : star)}
          disabled={readOnly}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path d={ICON.star} fill="currentColor" />
          </svg>
        </button>
      ))}
    </div>
  );
}
