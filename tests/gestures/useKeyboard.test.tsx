import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboard } from '../../src/gestures/useKeyboard';

function Harness(props: Parameters<typeof useKeyboard>[0]) {
  useKeyboard(props);
  return <input data-testid="text-input" />;
}

function fireKey(key: string, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('useKeyboard', () => {
  it('ArrowRight/ArrowLeft navigate, Escape closes', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onClose = vi.fn();
    render(<Harness onNext={onNext} onPrev={onPrev} onClose={onClose} />);

    fireKey('ArrowRight');
    fireKey('ArrowLeft');
    fireKey('Escape');

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('digits 1-5 report a rating', () => {
    const onRate = vi.fn();
    render(<Harness onRate={onRate} />);
    fireKey('4');
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('ignores keystrokes while an editable element is focused', () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    const input = screen.getByTestId('text-input');
    fireKey('ArrowRight', input);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} disabled />);
    fireKey('ArrowRight');
    expect(onNext).not.toHaveBeenCalled();
  });
});
