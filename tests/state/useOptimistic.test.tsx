import { act, renderHook } from '@testing-library/react';
import { useReducer } from 'react';
import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../../src/state/reducer';
import { useOptimistic } from '../../src/state/useOptimistic';
import type { ItemState } from '../../src/contract/types';

function useTestSetup(itemState: Record<string, ItemState>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const optimistic = useOptimistic(state, dispatch, itemState);
  return { state, ...optimistic };
}

describe('useOptimistic', () => {
  it('getDisplayState merges overlay onto truth', () => {
    const { result } = renderHook(({ itemState }) => useTestSetup(itemState), {
      initialProps: { itemState: { a: { rating: 1 } } as Record<string, ItemState> },
    });

    act(() => {
      result.current.setOptimistic('a', { rating: 5 });
    });

    expect(result.current.getDisplayState('a')).toEqual({ rating: 5 });
  });

  it('reconciles and drops the overlay once truth catches up', () => {
    const { result, rerender } = renderHook(({ itemState }) => useTestSetup(itemState), {
      initialProps: { itemState: {} as Record<string, ItemState> },
    });

    act(() => {
      result.current.setOptimistic('a', { rating: 5 });
    });
    expect(result.current.getDisplayState('a')).toEqual({ rating: 5 });

    rerender({ itemState: { a: { rating: 5 } } });

    expect(result.current.state.overlay['a']).toBeUndefined();
    expect(result.current.getDisplayState('a')).toEqual({ rating: 5 });
  });

  it('does not leak overlay set for one id into another id’s display state', () => {
    const { result } = renderHook(({ itemState }) => useTestSetup(itemState), {
      initialProps: { itemState: {} as Record<string, ItemState> },
    });

    act(() => {
      result.current.setOptimistic('a', { rating: 5 });
    });

    expect(result.current.getDisplayState('b')).toEqual({});
  });
});
