import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ICON } from '../actions/registry';
import type { TagOption } from '../contract/types';

interface TagPickerProps {
  /** Tagy aktuální fotky. */
  tagIds: string[];
  /** Nabídka od consumera; prázdná => jen pole pro vlastní tag. */
  options: TagOption[];
  /** Přepnutí tagu (přiřadit/odebrat) — už hotový, registrem prošlý callback. */
  onToggle: (tagId: string) => void;
}

const POPOVER_GAP = 8;
const POPOVER_HALF_WIDTH_ESTIMATE = 120;

interface Anchor {
  bottom: number;
  left: number;
}

/**
 * Tlačítko Tags v liště. Popover nad ním (`position: fixed`, stejně jako
 * RatingStars — `.wpview-toolbar` má overflow, který by inline/absolutní
 * popover oříznul). wpview vokabulář tagů nezná: nabídku dodává consumer
 * (`availableTags`), navíc jde zadat vlastní id; obojí jen emituje toggle.
 */
export function TagPicker({ tagIds, options, onToggle }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function openPicker() {
    const rect = toggleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.min(
      Math.max(centerX, POPOVER_HALF_WIDTH_ESTIMATE + POPOVER_GAP),
      window.innerWidth - POPOVER_HALF_WIDTH_ESTIMATE - POPOVER_GAP,
    );
    setAnchor({ bottom: window.innerHeight - rect.top + POPOVER_GAP, left: clampedX });
    setOpen(true);
  }

  function addCustom(e: FormEvent) {
    e.preventDefault();
    const tagId = draft.trim();
    if (!tagId) return;
    if (!tagIds.includes(tagId)) onToggle(tagId);
    setDraft('');
  }

  // Přiřazené tagy mimo nabídku (consumer je má, ale nenabízí) musí jít odebrat.
  const known = new Set(options.map((o) => o.id));
  const rows: TagOption[] = [...options, ...tagIds.filter((id) => !known.has(id)).map((id) => ({ id }))];

  return (
    <div ref={wrapRef} className="wpview-tag-picker">
      <button
        ref={toggleRef}
        type="button"
        className={`wpview-icon-button${open || tagIds.length > 0 ? ' wpview-icon-button--active' : ''}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-expanded={open}
        aria-label="Tags"
        title="Tags"
      >
        <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
          <path d={ICON.tag} fill="currentColor" />
        </svg>
      </button>

      {open && anchor && (
        <div
          className="wpview-tag-picker__popover"
          role="dialog"
          aria-label="Tags"
          style={{ position: 'fixed', bottom: anchor.bottom, left: anchor.left, transform: 'translateX(-50%)' }}
        >
          <ul className="wpview-tag-picker__list">
            {rows.map((tag) => {
              const on = tagIds.includes(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`wpview-tag-picker__option${on ? ' wpview-tag-picker__option--on' : ''}`}
                    onClick={() => onToggle(tag.id)}
                  >
                    {on ? '✓ ' : ''}
                    {tag.label ?? tag.id}
                  </button>
                </li>
              );
            })}
          </ul>
          <form className="wpview-tag-picker__form" onSubmit={addCustom}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New tag…"
              aria-label="New tag"
            />
            <button type="submit">Add</button>
          </form>
        </div>
      )}
    </div>
  );
}
