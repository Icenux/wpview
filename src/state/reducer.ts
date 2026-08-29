import type { EditPatch, ItemState } from '../contract/types';

export interface EditOverlayEntry {
  blobUrl: string;
  patch: EditPatch;
  /**
   * fullSrc položky v okamžiku, kdy vznikl tento entry. Dokud consumer
   * nedodá jiný fullSrc pro totéž id (viz CONTRACT.md „Editace je
   * klient-side"), entry zůstává zobrazený opticky místo skutečného fullSrc.
   */
  capturedFullSrc: string;
}

export interface WpViewState {
  /** Optimistic rating/tag/favorite, klíčováno per item id. */
  overlay: Record<string, Partial<ItemState>>;
  /** Optický výsledek crop/rotate, klíčováno per item id. */
  edit: Record<string, EditOverlayEntry>;
}

export const initialState: WpViewState = { overlay: {}, edit: {} };

export type WpViewAction =
  | { type: 'overlay/set'; id: string; patch: Partial<ItemState> }
  | { type: 'overlay/reconcile'; id: string; itemState: ItemState | undefined }
  | { type: 'overlay/clear'; id: string }
  | { type: 'edit/set'; id: string; blobUrl: string; patch: EditPatch; capturedFullSrc: string }
  | { type: 'edit/clear'; id: string };

export function reducer(state: WpViewState, action: WpViewAction): WpViewState {
  switch (action.type) {
    case 'overlay/set': {
      const existing = state.overlay[action.id] ?? {};
      return {
        ...state,
        overlay: { ...state.overlay, [action.id]: { ...existing, ...action.patch } },
      };
    }
    case 'overlay/reconcile': {
      const existing = state.overlay[action.id];
      if (!existing) return state;
      const remaining: Partial<ItemState> = {};
      // Tracks whether reconciliation actually clears at least one field —
      // NOT whether any field remains. Returning a fresh object when nothing
      // changed would make useOptimistic's effect (deps include state.overlay)
      // re-fire on its own dispatch forever, since itemState never catches up
      // on its own between renders.
      let changed = false;
      for (const key of Object.keys(existing) as (keyof ItemState)[]) {
        const overlayValue = existing[key];
        const truthValue = action.itemState?.[key];
        const matches = key === 'tags' ? sameTags(overlayValue, truthValue) : overlayValue === truthValue;
        if (matches) {
          changed = true;
        } else {
          // @ts-expect-error -- key/value pair comes from the same object, TS can't narrow the union across the loop
          remaining[key] = overlayValue;
        }
      }
      if (!changed) return state;
      if (Object.keys(remaining).length === 0) {
        const { [action.id]: _removed, ...rest } = state.overlay;
        return { ...state, overlay: rest };
      }
      return { ...state, overlay: { ...state.overlay, [action.id]: remaining } };
    }
    case 'overlay/clear': {
      if (!(action.id in state.overlay)) return state;
      const { [action.id]: _removed, ...rest } = state.overlay;
      return { ...state, overlay: rest };
    }
    case 'edit/set': {
      return {
        ...state,
        edit: {
          ...state.edit,
          [action.id]: {
            blobUrl: action.blobUrl,
            patch: action.patch,
            capturedFullSrc: action.capturedFullSrc,
          },
        },
      };
    }
    case 'edit/clear': {
      if (!(action.id in state.edit)) return state;
      const { [action.id]: _removed, ...rest } = state.edit;
      return { ...state, edit: rest };
    }
    default:
      return state;
  }
}

function sameTags(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
