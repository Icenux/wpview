interface InfoPanelProps {
  meta: Record<string, unknown> | undefined;
}

/** Jen k zobrazení meta pole (EXIF/datum/místo) — nic nedokáže editovat, žádný stav. */
export function InfoPanel({ meta }: InfoPanelProps) {
  const entries = meta ? Object.entries(meta) : [];
  return (
    <div className="wpview-info-panel">
      {entries.length === 0 ? (
        <p className="wpview-info-panel__empty">No info available.</p>
      ) : (
        <dl className="wpview-info-panel__list">
          {entries.map(([key, value]) => (
            <div key={key} className="wpview-info-panel__row">
              <dt>{key}</dt>
              <dd>{formatMetaValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
