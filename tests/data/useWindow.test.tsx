import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWindow } from '../../src/data/useWindow';

describe('useWindow', () => {
  it('requests prev when index is within threshold of the start', () => {
    const onRequestMore = vi.fn();
    renderHook(() => useWindow({ index: 0, itemsLength: 10, onRequestMore, threshold: 2 }));
    expect(onRequestMore).toHaveBeenCalledWith('prev');
    expect(onRequestMore).not.toHaveBeenCalledWith('next');
  });

  it('requests next when index is within threshold of the end', () => {
    const onRequestMore = vi.fn();
    renderHook(() => useWindow({ index: 9, itemsLength: 10, onRequestMore, threshold: 2 }));
    expect(onRequestMore).toHaveBeenCalledWith('next');
  });

  it('does not request in a direction where hasMore is explicitly false', () => {
    const onRequestMore = vi.fn();
    renderHook(() =>
      useWindow({
        index: 0,
        itemsLength: 10,
        onRequestMore,
        threshold: 2,
        hasMore: { prev: false, next: true },
      }),
    );
    expect(onRequestMore).not.toHaveBeenCalled();
  });

  it('does not re-request for the same index across re-renders', () => {
    const onRequestMore = vi.fn();
    const { rerender } = renderHook((props) => useWindow(props), {
      initialProps: { index: 0, itemsLength: 10, onRequestMore, threshold: 2 },
    });
    expect(onRequestMore).toHaveBeenCalledTimes(1);
    rerender({ index: 0, itemsLength: 10, onRequestMore, threshold: 2 });
    expect(onRequestMore).toHaveBeenCalledTimes(1);
  });

  it('does nothing away from the edges', () => {
    const onRequestMore = vi.fn();
    renderHook(() => useWindow({ index: 5, itemsLength: 10, onRequestMore, threshold: 2 }));
    expect(onRequestMore).not.toHaveBeenCalled();
  });
});
