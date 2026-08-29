interface TagChipsProps {
  tagIds: string[];
  /** Chybí => chipy jsou jen k zobrazení, bez křížku. wpview nezná vokabulář tagů, jen umí odebrat existující. */
  onRemove?: ((tagId: string) => void) | undefined;
}

export function TagChips({ tagIds, onRemove }: TagChipsProps) {
  if (tagIds.length === 0) return null;
  return (
    <ul className="wpview-tag-chips">
      {tagIds.map((tagId) => (
        <li key={tagId} className="wpview-tag-chips__chip">
          <span>{tagId}</span>
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
