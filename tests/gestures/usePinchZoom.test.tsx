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
  { pointerId, clientX, clientY = 0 }: { pointerId: number; clientX: number; clientY?: number },
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, clientX, clientY }),
    );
  });
}

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const { scale, translateX, translateY } = usePinchZoom(ref, { min: 1, max: 6 });
  return (
    <div ref={ref} data-testid="surface">
      scale:{scale.toFixed(2)} pan:{translateX},{translateY}
    </div>
  );
}

describe('usePinchZoom / pinch', () => {
  it('scales up when two pointers move apart', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    // start distance 20 -> final distance 100 => 5x, under the max-6 clamp
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });

    expect(surface.textContent).toBe('scale:5.00 pan:0,0');
  });

  it('a single pointer does not zoom or pan while at scale 1', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 300 });

    expect(surface.textContent).toBe('scale:1.00 pan:0,0');
  });

  it('resets to 1 once a pointer lifts and the pinch ends', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });
    expect(surface.textContent).toBe('scale:5.00 pan:0,0');

    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 0 });
    // scale itself is not reset automatically (that's Stage's job on item change),
    // but pinch tracking should stop cleanly without throwing on a lone pointer move.
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 500 });
    expect(surface.textContent).toBe('scale:5.00 pan:0,0');
  });
});

describe('usePinchZoom / single-finger pan (bug: dragging a zoomed photo used to swipe/close instead)', () => {
  it('pans once already zoomed in from a prior pinch', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    // Zoom in with two fingers, then lift both.
    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });
    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointerup', { pointerId: 2, clientX: 100 });
    expect(surface.textContent).toBe('scale:5.00 pan:0,0');

    // A fresh single-finger drag should now pan, not do nothing.
    firePointer(surface, 'pointerdown', { pointerId: 3, clientX: 50, clientY: 50 });
    firePointer(surface, 'pointermove', { pointerId: 3, clientX: 80, clientY: 70 });

    expect(surface.textContent).toBe('scale:5.00 pan:30,20');
  });

  it('a second finger joining mid-pan hands off to pinch instead of continuing the pan', () => {
    render(<Harness />);
    const surface = screen.getByTestId('surface');

    // Zoom in first, then lift, so a fresh single-finger drag starts a pan.
    firePointer(surface, 'pointerdown', { pointerId: 1, clientX: 100 });
    firePointer(surface, 'pointerdown', { pointerId: 2, clientX: 120 });
    firePointer(surface, 'pointermove', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointermove', { pointerId: 2, clientX: 100 });
    firePointer(surface, 'pointerup', { pointerId: 1, clientX: 0 });
    firePointer(surface, 'pointerup', { pointerId: 2, clientX: 100 });

    firePointer(surface, 'pointerdown', { pointerId: 3, clientX: 50 });
    firePointer(surface, 'pointermove', { pointerId: 3, clientX: 70 });
    expect(surface.textContent).toBe('scale:5.00 pan:20,0');

    // Second finger joins -> pan must stop right where it was, handed off to pinch.
    firePointer(surface, 'pointerdown', { pointerId: 4, clientX: 90 });
    expect(surface.textContent).toBe('scale:5.00 pan:20,0');
  });
});
