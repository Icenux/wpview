import { useCallback, useMemo, useState } from 'react';
import { WpView } from '@wpview';
import type { Capabilities, EditPatch, ItemState, ViewerItem } from '@wpview';
import { MOCK_ITEMS, MOCK_ITEM_STATE } from './mock-items';

// Kolik položek "okno" drží kolem otevřeného indexu — simuluje to, co by
// v reálné gallery byla stránkovaná infinite query. Menší než MOCK_ITEM_COUNT,
// aby šlo reálně vidět useWindow/onRequestMore v akci.
const WINDOW_STEP = 6;

const CAPABILITIES: Capabilities = {
  rate: true,
  favorite: true,
  tag: true,
  rotate: true,
  crop: true,
  delete: true,
  info: true,
  present: true,
};

export function App() {
  const [items, setItems] = useState<ViewerItem[]>(MOCK_ITEMS);
  const [itemState, setItemState] = useState<Record<string, ItemState>>(MOCK_ITEM_STATE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [windowEnd, setWindowEnd] = useState(WINDOW_STEP);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 20));
  }, []);

  const openAt = useCallback(
    (globalIndex: number) => {
      const start = Math.max(0, globalIndex - Math.floor(WINDOW_STEP / 2));
      setWindowStart(start);
      setWindowEnd(Math.min(items.length, start + WINDOW_STEP));
      setLightboxIndex(globalIndex);
    },
    [items.length],
  );

  const handleIndexChange = useCallback(
    (localIndex: number) => {
      setLightboxIndex(windowStart + localIndex);
    },
    [windowStart],
  );

  const handleRequestMore = useCallback(
    (dir: 'prev' | 'next') => {
      pushLog(`onRequestMore(${dir})`);
      if (dir === 'prev') setWindowStart((s) => Math.max(0, s - WINDOW_STEP));
      else setWindowEnd((e) => Math.min(items.length, e + WINDOW_STEP));
    },
    [items.length, pushLog],
  );

  const handleRate = useCallback(
    (id: string, value: number) => {
      pushLog(`onRate(${id}, ${value})`);
      setItemState((prev) => ({ ...prev, [id]: { ...prev[id], rating: value } }));
    },
    [pushLog],
  );

  const handleFavorite = useCallback(
    (id: string, next: boolean) => {
      pushLog(`onFavorite(${id}, ${next})`);
      setItemState((prev) => ({ ...prev, [id]: { ...prev[id], favorite: next } }));
    },
    [pushLog],
  );

  const handleTagToggle = useCallback(
    (id: string, tagId: string) => {
      pushLog(`onTagToggle(${id}, ${tagId})`);
      setItemState((prev) => {
        const current = prev[id]?.tags ?? [];
        const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
        return { ...prev, [id]: { ...prev[id], tags: next } };
      });
    },
    [pushLog],
  );

  const handleEdit = useCallback(
    (id: string, patch: EditPatch) => {
      pushLog(`onEdit(${id}, ${patch.type})`);
      // Mock consumer publikuje nový fullSrc -> wpview podle CONTRACT.md zahodí edit overlay.
      const blobUrl = URL.createObjectURL(patch.blob);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, fullSrc: blobUrl, thumbSrc: blobUrl } : it)));
    },
    [pushLog],
  );

  const handleDelete = useCallback(
    (id: string) => {
      pushLog(`onDelete(${id}) — mock consumer nechává položku v datech`);
    },
    [pushLog],
  );

  const handleInfoOpen = useCallback(
    (id: string) => {
      pushLog(`onInfoOpen(${id})`);
    },
    [pushLog],
  );

  const handleClose = useCallback(() => {
    pushLog('onClose()');
    setLightboxIndex(null);
  }, [pushLog]);

  const windowItems = useMemo(() => items.slice(windowStart, windowEnd), [items, windowStart, windowEnd]);
  const localIndex = lightboxIndex !== null ? lightboxIndex - windowStart : 0;

  return (
    <div className="app">
      <h1>wpview playground</h1>
      <p className="app__hint">
        Klikni na dlaždici. Okno drží jen {WINDOW_STEP} položek kolem otevřeného indexu — swipe/šipka na kraji
        okna vyvolá onRequestMore (viz log dole).
      </p>
      <div className="app__grid">
        {items.map((item, i) => (
          <button key={item.id} type="button" className="app__tile" onClick={() => openAt(i)}>
            <img src={item.thumbSrc} alt={item.id} />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div className="app__lightbox">
          <WpView
            items={windowItems}
            index={localIndex}
            itemState={itemState}
            capabilities={CAPABILITIES}
            hasMore={{ prev: windowStart > 0, next: windowEnd < items.length }}
            onIndexChange={handleIndexChange}
            onRate={handleRate}
            onFavorite={handleFavorite}
            onTagToggle={handleTagToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onInfoOpen={handleInfoOpen}
            onRequestMore={handleRequestMore}
            onClose={handleClose}
          />
        </div>
      )}

      <div className="app__log">
        <strong>Event log</strong>
        <ul>
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
