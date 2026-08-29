import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from '../../src/gestures/useSwipe';

// Raw dispatchEvent doesn't auto-wrap in act() the way RTL's fireEvent does.
function firePointer(
  el: Element,
  type: string,
  { pointerId = 1, clientX = 0 }: { pointerId?: number; clientX?: number },
) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, clientX }));
  });
}

function Harness({ onSwipeNext, onSwipePrev }: { onSwipeNext: () => void; onSwipePrev: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { dragOffsetX } = useSwipe(ref, { onSwipeNext, onSwipePrev, threshold: 50 });
  return (
    <div ref={ref} data-testid="surface">
      offset:{dragOffsetX}
    </div>
  );
}

describe('useSwipe', () => {
  it('calls onSwipeNext after a leftward drag past the threshold', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 200 });
    firePointer(surface, 'pointermove', { clientX: 100 });
    firePointer(surface, 'pointerup', { clientX: 100 });

    expect(onSwipeNext).toHaveBeenCalledTimes(1);
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('calls onSwipePrev after a rightward drag past the threshold', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 100 });
    firePointer(surface, 'pointermove', { clientX: 200 });
    firePointer(surface, 'pointerup', { clientX: 200 });

    expect(onSwipePrev).toHaveBeenCalledTimes(1);
    expect(onSwipeNext).not.toHaveBeenCalled();
  });

  it('does not swipe when the drag stays under the threshold', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 100 });
    firePointer(surface, 'pointermove', { clientX: 120 });
    firePointer(surface, 'pointerup', { clientX: 120 });

    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('bails out of drag tracking once a second pointer joins (pinch takes over)', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 200 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 200 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 50 });
    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 50 });

    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrev).not.toHaveBeenCalled();
  });
});
