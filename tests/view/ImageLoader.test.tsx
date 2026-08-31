import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ImageLoader } from '../../src/view/ImageLoader';

// jsdom images never really load — stub the prototype getters `<img>` uses to
// report "the browser already has this decoded" so we can drive both paths.
function stubImageComplete(complete: boolean) {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => complete,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => (complete ? 800 : 0),
  });
}

function restoreImageComplete() {
  Reflect.deleteProperty(HTMLImageElement.prototype, 'complete');
  Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalWidth');
}

describe('ImageLoader', () => {
  afterEach(() => {
    restoreImageComplete();
  });

  it('skips the placeholder entirely when the browser already has the image cached', () => {
    // Regression: usePreload warms fullSrc for neighboring items ahead of
    // time (swipe, and especially slideshow) — by the time the photo is
    // shown, the browser usually already has it. The old unconditional
    // `useEffect(() => setLoaded(false), [src])` ignored that and always
    // flashed the blurred placeholder for at least one render, racing
    // against the already-fired onLoad.
    stubImageComplete(true);
    render(<ImageLoader src="https://example.com/a.jpg" placeholderSrc="https://example.com/a-thumb.jpg" alt="" zoom={1} />);

    expect(document.querySelector('.wpview-image-loader__placeholder')).toBeNull();
    const full = document.querySelector('.wpview-image-loader__full') as HTMLElement;
    expect(full.style.opacity).toBe('1');
  });

  it('shows the placeholder and fades in on onLoad when the image is not yet cached', () => {
    stubImageComplete(false);
    render(<ImageLoader src="https://example.com/a.jpg" placeholderSrc="https://example.com/a-thumb.jpg" alt="" zoom={1} />);

    expect(document.querySelector('.wpview-image-loader__placeholder')).not.toBeNull();
    const full = document.querySelector('.wpview-image-loader__full') as HTMLElement;
    expect(full.style.opacity).toBe('0');

    act(() => {
      full.dispatchEvent(new Event('load'));
    });

    expect(document.querySelector('.wpview-image-loader__placeholder')).toBeNull();
    expect(full.style.opacity).toBe('1');
  });

  it('re-checks the cache state on every src change instead of only once', () => {
    stubImageComplete(true);
    const { rerender } = render(
      <ImageLoader src="https://example.com/a.jpg" placeholderSrc="https://example.com/a-thumb.jpg" alt="" zoom={1} />,
    );
    expect(document.querySelector('.wpview-image-loader__placeholder')).toBeNull();

    stubImageComplete(false);
    rerender(
      <ImageLoader src="https://example.com/b.jpg" placeholderSrc="https://example.com/b-thumb.jpg" alt="" zoom={1} />,
    );

    expect(document.querySelector('.wpview-image-loader__placeholder')).not.toBeNull();
  });
});
