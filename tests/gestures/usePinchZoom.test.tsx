import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePinchZoom } from '../../src/gestures/usePinchZoom';

// Raw dispatchEvent (not RTL's fireEvent) doesn't auto-wrap in act(), and the
// resulting setState calls happen outside React's synthetic event system —
// without act() the assertion below can run before React flushes the render.
function firePointer(
  el: Element,
  type: string,
  { pointerId, clientX }: { pointerId: number; clientX: number },
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, clientX, clientY: 0 }),
    );
  });
}

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const { scale } = usePinchZoom(ref, { min: 1, max: 6 });
  return (
    <div ref={ref} data-testid="surface">
      scale:{scale.toFixed(2)}
    </div>
  );
}

describe('usePinchZoom', () => {
  it('scales up when two pointers move apart', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    // start distance 20 -> final distance 100 => 5x, under the max-6 clamp
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });

    expect(surface.textContent).toBe('scale:5.00');
  });

  it('does nothing with a single pointer', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 300 });

    expect(surface.textContent).toBe('scale:1.00');
  });

  it('resets to 1 once a pointer lifts and the pinch ends', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });
    expect(surface.textContent).toBe('scale:5.00');

    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 0 });
    // scale itself is not reset automatically (that's Stage's job on item change),
    // but pinch tracking should stop cleanly without throwing on a lone pointer move.
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 500 });
    expect(surface.textContent).toBe('scale:5.00');
  });
});
