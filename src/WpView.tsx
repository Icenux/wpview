import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { EditPatch, WpViewProps } from './contract/types';
import { initialState, reducer } from './state/reducer';
import { useOptimistic } from './state/useOptimistic';
import { useSettings } from './state/useSettings';
import { useWindow } from './data/useWindow';
import { usePreload } from './view/usePreload';
import { Stage } from './view/Stage';
import { Slideshow } from './present/Slideshow';
import { useFullscreen } from './present/useFullscreen';
import { useKeyboard } from './gestures/useKeyboard';
import { CropCanvas } from './edit/CropCanvas';
import { rotateImage } from './edit/rotate';
import { Toolbar } from './ui/Toolbar';
import { InfoPanel } from './ui/InfoPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import {
  emitDelete,
  emitEdit,
  emitFavorite,
  emitInfoOpen,
  emitRate,
  emitTagToggle,
  isActionEnabled,
} from './actions/registry';
import type { ActionHandlers } from './actions/types';
import './styles/wpview.css';

/** Orchestrace root komponenty, nic víc — logika žije ve state/data/actions/edit vrstvách. */
export function WpView(props: WpViewProps) {
  const {
    items,
    index,
    itemState,
    capabilities,
    hasMore,
    onIndexChange,
    onRate,
    onFavorite,
    onTagToggle,
    onEdit,
    onDelete,
    onInfoOpen,
    onRequestMore,
    onClose,
  } = props;

  const [state, dispatch] = useReducer(reducer, initialState);
  const { setOptimistic, getDisplayState } = useOptimistic(state, dispatch, itemState);
  const { settings, setSettings, settingsOpen, setSettingsOpen } = useSettings(props);

  const containerRef = useRef<HTMLDivElement>(null);
  useFullscreen(containerRef);

  const [infoOpenFor, setInfoOpenFor] = useState<string | null>(null);
  const [cropOpenFor, setCropOpenFor] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);

  const currentItem = items[index];

  const handlers: ActionHandlers = useMemo(
    () => ({ onRate, onFavorite, onTagToggle, onEdit, onDelete, onInfoOpen }),
    [onRate, onFavorite, onTagToggle, onEdit, onDelete, onInfoOpen],
  );

  useWindow({ index, itemsLength: items.length, hasMore, onRequestMore });
  usePreload(items, index);

  // Overlay/edit se nikdy nepřenáší mezi id — při změně okna se pro odcházející položky čistí.
  useEffect(() => {
    const windowIds = new Set(items.map((it) => it.id));
    for (const id of Object.keys(state.overlay)) {
      if (!windowIds.has(id)) dispatch({ type: 'overlay/clear', id });
    }
    for (const [id, entry] of Object.entries(state.edit)) {
      if (!windowIds.has(id)) {
        URL.revokeObjectURL(entry.blobUrl);
        dispatch({ type: 'edit/clear', id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Edit overlay se zahodí, jakmile consumer dodá jiný fullSrc pro totéž id (viz CONTRACT.md).
  useEffect(() => {
    for (const item of items) {
      const entry = state.edit[item.id];
      if (entry && entry.capturedFullSrc !== item.fullSrc) {
        URL.revokeObjectURL(entry.blobUrl);
        dispatch({ type: 'edit/clear', id: item.id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Revokovat zbylé blob URLs při unmountu wpview celého.
  const editStateRef = useRef(state.edit);
  editStateRef.current = state.edit;
  useEffect(() => {
    return () => {
      for (const entry of Object.values(editStateRef.current)) {
        URL.revokeObjectURL(entry.blobUrl);
      }
    };
  }, []);

  const goNext = useCallback(() => {
    if (index < items.length - 1) onIndexChange(index + 1);
  }, [index, items.length, onIndexChange]);

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const handleRate = useCallback(
    (value: number) => {
      if (!currentItem) return;
      setOptimistic(currentItem.id, { rating: value });
      emitRate(capabilities, handlers, currentItem.id, value);
    },
    [currentItem, capabilities, handlers, setOptimistic],
  );

  const handleToggleFavorite = useCallback(() => {
    if (!currentItem) return;
    const next = !getDisplayState(currentItem.id).favorite;
    setOptimistic(currentItem.id, { favorite: next });
    emitFavorite(capabilities, handlers, currentItem.id, next);
  }, [currentItem, capabilities, handlers, getDisplayState, setOptimistic]);

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      if (!currentItem) return;
      const current = getDisplayState(currentItem.id).tags ?? [];
      setOptimistic(currentItem.id, { tags: current.filter((t) => t !== tagId) });
      emitTagToggle(capabilities, handlers, currentItem.id, tagId);
    },
    [currentItem, capabilities, handlers, getDisplayState, setOptimistic],
  );

  const handleDelete = useCallback(() => {
    if (!currentItem) return;
    emitDelete(capabilities, handlers, currentItem.id);
  }, [currentItem, capabilities, handlers]);

  const handleToggleInfo = useCallback(() => {
    if (!currentItem) return;
    const id = currentItem.id;
    // Side effect lives outside the setState updater — an updater must stay
    // pure, since StrictMode (deliberately) invokes it twice in dev to catch
    // exactly this, which was double-firing onInfoOpen.
    const next = infoOpenFor === id ? null : id;
    setInfoOpenFor(next);
    if (next) emitInfoOpen(capabilities, handlers, id);
  }, [currentItem, capabilities, handlers, infoOpenFor]);

  const applyEdit = useCallback(
    (patch: EditPatch) => {
      if (!currentItem) return;
      dispatch({
        type: 'edit/set',
        id: currentItem.id,
        blobUrl: URL.createObjectURL(patch.blob),
        patch,
        capturedFullSrc: currentItem.fullSrc,
      });
      emitEdit(capabilities, handlers, currentItem.id, patch);
    },
    [currentItem, capabilities, handlers],
  );

  const handleRotate = useCallback(async () => {
    if (!currentItem) return;
    try {
      const patch = await rotateImage(currentItem.fullSrc, 90);
      applyEdit(patch);
    } catch (err) {
      console.error('wpview: rotate failed', err);
    }
  }, [currentItem, applyEdit]);

  const handleCropConfirm = useCallback(
    (patch: EditPatch) => {
      applyEdit(patch);
      setCropOpenFor(null);
    },
    [applyEdit],
  );

  const handleTogglePresent = useCallback(() => {
    setIsPresenting((prev) => !prev);
  }, []);

  useKeyboard({
    onNext: goNext,
    onPrev: goPrev,
    onClose,
    onRate: handleRate,
    onInfoToggle: handleToggleInfo,
    onFavoriteToggle: handleToggleFavorite,
    disabled: !!cropOpenFor,
  });

  if (!currentItem) return null;

  const displayState = getDisplayState(currentItem.id);
  const editEntry = state.edit[currentItem.id];
  const displaySrc = editEntry?.blobUrl ?? currentItem.fullSrc;
  const canGoNext = index < items.length - 1 || hasMore?.next === true;

  return (
    <div ref={containerRef} className="wpview" data-theme={settings.theme}>
      <Stage
        item={currentItem}
        displaySrc={displaySrc}
        zoomMode={settings.zoomMode}
        doubleTapZoom={settings.doubleTapZoom}
        onSwipeNext={goNext}
        onSwipePrev={goPrev}
        swipeDisabled={!!cropOpenFor}
      />

      <Toolbar
        showRating={isActionEnabled('rate', capabilities, handlers)}
        ratingValue={displayState.rating ?? 0}
        onRate={handleRate}
        showFavorite={isActionEnabled('favorite', capabilities, handlers)}
        isFavorite={displayState.favorite ?? false}
        onToggleFavorite={handleToggleFavorite}
        showTags={isActionEnabled('tag', capabilities, handlers)}
        tagIds={displayState.tags ?? []}
        onRemoveTag={handleRemoveTag}
        showRotate={isActionEnabled('rotate', capabilities, handlers)}
        onRotate={handleRotate}
        showCrop={isActionEnabled('crop', capabilities, handlers)}
        onCrop={() => setCropOpenFor(currentItem.id)}
        showDelete={isActionEnabled('delete', capabilities, handlers)}
        onDelete={handleDelete}
        showInfo={isActionEnabled('info', capabilities, handlers)}
        infoActive={infoOpenFor === currentItem.id}
        onToggleInfo={handleToggleInfo}
        showPresent={capabilities?.present === true}
        isPresenting={isPresenting}
        onTogglePresent={handleTogglePresent}
        onOpenSettings={() => setSettingsOpen(!settingsOpen)}
      />

      {infoOpenFor === currentItem.id && <InfoPanel meta={currentItem.meta} />}

      {cropOpenFor === currentItem.id && (
        <CropCanvas
          fullSrc={currentItem.fullSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropOpenFor(null)}
        />
      )}

      <Slideshow
        active={isPresenting}
        intervalMs={settings.slideshowMs}
        canAdvance={canGoNext}
        onAdvance={goNext}
        onExit={() => setIsPresenting(false)}
      />

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
