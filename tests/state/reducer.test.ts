import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../../src/state/reducer';

describe('reducer / overlay slice', () => {
  it('overlay/set merges into existing overlay for the id', () => {
    let state = reducer(initialState, { type: 'overlay/set', id: 'a', patch: { rating: 3 } });
    state = reducer(state, { type: 'overlay/set', id: 'a', patch: { favorite: true } });
    expect(state.overlay['a']).toEqual({ rating: 3, favorite: true });
  });

  it('overlay/reconcile clears only fields that now match the truth', () => {
    let state = reducer(initialState, {
      type: 'overlay/set',
      id: 'a',
      patch: { rating: 3, favorite: true },
    });
    // truth caught up on rating only
    state = reducer(state, {
      type: 'overlay/reconcile',
      id: 'a',
      itemState: { rating: 3 },
    });
    expect(state.overlay['a']).toEqual({ favorite: true });
  });

  it('overlay/reconcile removes the id entirely once every field matches', () => {
    let state = reducer(initialState, { type: 'overlay/set', id: 'a', patch: { rating: 3 } });
    state = reducer(state, { type: 'overlay/reconcile', id: 'a', itemState: { rating: 3 } });
    expect(state.overlay['a']).toBeUndefined();
  });

  it('overlay/reconcile compares tags by content, not by array identity', () => {
    let state = reducer(initialState, {
      type: 'overlay/set',
      id: 'a',
      patch: { tags: ['b', 'a'] },
    });
    state = reducer(state, {
      type: 'overlay/reconcile',
      id: 'a',
      itemState: { tags: ['a', 'b'] },
    });
    expect(state.overlay['a']).toBeUndefined();
  });

  it('overlay/reconcile returns the SAME state reference when nothing matches yet', () => {
    // Regression: a fresh object here would make useOptimistic's effect
    // (deps include state.overlay) re-dispatch forever whenever itemState
    // never catches up — this caused a real OOM during test development.
    const state = reducer(initialState, { type: 'overlay/set', id: 'a', patch: { rating: 3 } });
    const reconciled = reducer(state, { type: 'overlay/reconcile', id: 'a', itemState: undefined });
    expect(reconciled).toBe(state);
  });

  it('overlay/reconcile is a no-op for an id with no pending overlay', () => {
    const state = reducer(initialState, {
      type: 'overlay/reconcile',
      id: 'missing',
      itemState: { rating: 1 },
    });
    expect(state).toBe(initialState);
  });

  it('overlay/clear force-removes an id regardless of truth', () => {
    let state = reducer(initialState, { type: 'overlay/set', id: 'a', patch: { rating: 3 } });
    state = reducer(state, { type: 'overlay/clear', id: 'a' });
    expect(state.overlay['a']).toBeUndefined();
  });

  it('never leaks overlay across ids', () => {
    let state = reducer(initialState, { type: 'overlay/set', id: 'a', patch: { rating: 5 } });
    state = reducer(state, { type: 'overlay/clear', id: 'a' });
    expect(state.overlay['b']).toBeUndefined();
  });
});

describe('reducer / edit slice', () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' });

  it('edit/set stores the blobUrl, patch and capturedFullSrc', () => {
    const state = reducer(initialState, {
      type: 'edit/set',
      id: 'a',
      blobUrl: 'blob:a',
      patch: { type: 'rotate', deg: 90, blob },
      capturedFullSrc: 'https://example.com/a.jpg',
    });
    expect(state.edit['a']).toEqual({
      blobUrl: 'blob:a',
      patch: { type: 'rotate', deg: 90, blob },
      capturedFullSrc: 'https://example.com/a.jpg',
    });
  });

  it('edit/clear removes the entry', () => {
    let state = reducer(initialState, {
      type: 'edit/set',
      id: 'a',
      blobUrl: 'blob:a',
      patch: { type: 'rotate', deg: 90, blob },
      capturedFullSrc: 'https://example.com/a.jpg',
    });
    state = reducer(state, { type: 'edit/clear', id: 'a' });
    expect(state.edit['a']).toBeUndefined();
  });
});
