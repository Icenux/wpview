import { useCallback, useEffect } from 'react';
import type { Dispatch } from 'react';
import type { ItemState } from '../contract/types';
import type { WpViewAction, WpViewState } from './reducer';

/**
 * Optimistic rating/tag/favorite overlay. `setOptimistic` zapíše okamžitě,
 * `getDisplayState` vrací overlay sloučený s pravdou. Reconciliace běží
 * v efektu při každé změně `itemState` NEBO `overlay` — druhé proto, aby se
 * hned zahodil overlay, který už při zápisu odpovídá aktuální pravdě
 * (uživatel klikne na hodnotu, kterou consumer už dávno poslal).
 */
export function useOptimistic(
  state: WpViewState,
  dispatch: Dispatch<WpViewAction>,
  itemState: Record<string, ItemState>,
) {
  useEffect(() => {
    for (const id of Object.keys(state.overlay)) {
      dispatch({ type: 'overlay/reconcile', id, itemState: itemState[id] });
    }
  }, [itemState, state.overlay, dispatch]);

  const setOptimistic = useCallback(
    (id: string, patch: Partial<ItemState>) => {
      dispatch({ type: 'overlay/set', id, patch });
    },
    [dispatch],
  );

  const getDisplayState = useCallback(
    (id: string): ItemState => {
      const truth = itemState[id] ?? {};
      const overlay = state.overlay[id];
      return overlay ? { ...truth, ...overlay } : truth;
    },
    [itemState, state.overlay],
  );

  return { setOptimistic, getDisplayState };
}
