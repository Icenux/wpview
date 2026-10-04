interface TagChipsProps {
  tagIds: string[];
  /** Chybí => chipy jsou jen k zobrazení, bez křížku. wpview nezná vokabulář tagů, jen umí odebrat existující. */
  onRemove?: ((tagId: string) => void) | undefined;
  /** id → zobrazený text (z availableTags); chybí => id. */
  labels?: Record<string, string> | undefined;
}

export function TagChips({ tagIds, onRemove, labels }: TagChipsProps) {
  if (tagIds.length === 0) return null;
  return (
    <ul className="wpview-tag-chips">
      {tagIds.map((tagId) => (
        <li key={tagId} className="wpview-tag-chips__chip">
          <span>{labels?.[tagId] ?? tagId}</span>
          {onRemove && (
            <button
              type="button"
              className="wpview-tag-chips__remove"
              onClick={() => onRemove(tagId)}
              aria-label={`Remove tag ${tagId}`}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
