import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from '../../src/gestures/useSwipe';

// Raw dispatchEvent doesn't auto-wrap in act() the way RTL's fireEvent does.
function firePointer(
  el: Element,
  type: string,
  { pointerId = 1, clientX = 0, clientY = 0 }: { pointerId?: number; clientX?: number; clientY?: number },
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, clientX, clientY }),
    );
  });
}

function Harness({
  onSwipeNext,
  onSwipePrev,
  onSwipeDown,
  onTap,
  canSwipeNext,
  canSwipePrev,
}: {
  onSwipeNext: () => void;
  onSwipePrev: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  canSwipeNext?: boolean;
  canSwipePrev?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { dragOffsetX, dragOffsetY } = useSwipe(ref, {
    onSwipeNext,
    onSwipePrev,
    onSwipeDown,
    onTap,
    canSwipeNext,
    canSwipePrev,
    threshold: 50,
    downThreshold: 100,
  });
  return (
    <div ref={ref} data-testid="surface" style={{ width: '300px' }}>
      offset:{dragOffsetX},{dragOffsetY}
    </div>
  );
}

describe('useSwipe / horizontal', () => {
  it('calls onSwipeNext after a leftward drag past the threshold, once it settles', async () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 200 });
    firePointer(surface, 'pointermove', { clientX: 100 });
    firePointer(surface, 'pointerup', { clientX: 100 });

    // Committed swipes finish sliding to the edge before the callback fires
    // (see useSwipe.ts settle()) — not called synchronously on pointerup.
    expect(onSwipeNext).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onSwipeNext).toHaveBeenCalledTimes(1));
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('calls onSwipePrev after a rightward drag past the threshold, once it settles', async () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 100 });
    firePointer(surface, 'pointermove', { clientX: 200 });
    firePointer(surface, 'pointerup', { clientX: 200 });

    await vi.waitFor(() => expect(onSwipePrev).toHaveBeenCalledTimes(1));
    expect(onSwipeNext).not.toHaveBeenCalled();
  });

  it('rubber-bands back (never settles/commits) when there is no next item to swipe to', async () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} canSwipeNext={false} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 200 });
    firePointer(surface, 'pointermove', { clientX: 100 });
    firePointer(surface, 'pointerup', { clientX: 100 });

    // Give the (non-existent) settle timer a chance to have fired if it wrongly did.
    await new Promise((r) => setTimeout(r, 250));
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

describe('useSwipe / tap', () => {
  it('fires onTap for a plain click with no movement', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onTap = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onTap={onTap} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(surface, 'pointerup', { clientX: 150, clientY: 150 });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('does not fire onTap once the gesture crossed into a real drag', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onTap = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onTap={onTap} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(surface, 'pointermove', { clientX: 100, clientY: 150 });
    firePointer(surface, 'pointerup', { clientX: 100, clientY: 150 });

    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('useSwipe / vertical (swipe-to-close)', () => {
  it('calls onSwipeDown once a downward drag crosses downThreshold', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onSwipeDown = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onSwipeDown={onSwipeDown} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 150, clientY: 100 });
    firePointer(surface, 'pointermove', { clientX: 150, clientY: 250 });
    firePointer(surface, 'pointerup', { clientX: 150, clientY: 250 });

    expect(onSwipeDown).toHaveBeenCalledTimes(1);
    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('does not close on a downward drag under downThreshold', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onSwipeDown = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onSwipeDown={onSwipeDown} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 150, clientY: 100 });
    firePointer(surface, 'pointermove', { clientX: 150, clientY: 150 });
    firePointer(surface, 'pointerup', { clientX: 150, clientY: 150 });

    expect(onSwipeDown).not.toHaveBeenCalled();
  });

  it('does nothing on an upward drag', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onSwipeDown = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onSwipeDown={onSwipeDown} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 150, clientY: 250 });
    firePointer(surface, 'pointermove', { clientX: 150, clientY: 100 });
    firePointer(surface, 'pointerup', { clientX: 150, clientY: 100 });

    expect(onSwipeDown).not.toHaveBeenCalled();
  });

  it('a mostly-horizontal drag never triggers onSwipeDown even if it dips downward', async () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();
    const onSwipeDown = vi.fn();
    render(<Harness onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} onSwipeDown={onSwipeDown} />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { clientX: 100, clientY: 100 });
    // dx dominates dy from the first move past tapThreshold -> axis locks horizontal.
    firePointer(surface, 'pointermove', { clientX: 250, clientY: 130 });
    firePointer(surface, 'pointerup', { clientX: 250, clientY: 130 });

    await vi.waitFor(() => expect(onSwipePrev).toHaveBeenCalledTimes(1));
    expect(onSwipeDown).not.toHaveBeenCalled();
  });
});
