import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WpView } from '../src/WpView';
import type { ItemState, Settings, ViewerItem } from '../src/contract/types';

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

const items: ViewerItem[] = [
  { id: 'a', thumbSrc: 'a-thumb', fullSrc: 'https://example.com/a.jpg' },
  { id: 'b', thumbSrc: 'b-thumb', fullSrc: 'https://example.com/b.jpg' },
];

function baseProps(overrides: Partial<ComponentProps<typeof WpView>> = {}): ComponentProps<typeof WpView> {
  return {
    items,
    index: 0,
    itemState: {} as Record<string, ItemState>,
    onIndexChange: vi.fn(),
    ...overrides,
  };
}

class MockCtx {
  drawImage(..._args: unknown[]) {}
  translate(..._args: unknown[]) {}
  rotate(..._args: unknown[]) {}
}

class MockOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return new MockCtx();
  }
  async convertToBlob({ type }: { type: string }) {
    return new Blob(['fake'], { type });
  }
}

describe('WpView capability gate', () => {
  it('shows an action only when capability is true AND its handler is provided', () => {
    render(
      <WpView
        {...baseProps({
          capabilities: { rate: true, favorite: true, delete: true },
          onRate: vi.fn(),
          // onFavorite deliberately omitted — capability alone must not be enough.
          onDelete: vi.fn(),
        })}
      />,
    );

    expect(screen.getByLabelText('Set rating')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete')).toBeInTheDocument();
    expect(screen.queryByLabelText('Favorite')).not.toBeInTheDocument();
  });

  it('hides an action when the handler exists but the capability is missing', () => {
    render(<WpView {...baseProps({ onDelete: vi.fn() })} />);
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
  });
});

describe('WpView rating', () => {
  it('collapses to a single star; tapping it opens the picker, and picking a value emits onRate and re-collapses', () => {
    const onRate = vi.fn();
    render(<WpView {...baseProps({ capabilities: { rate: true }, onRate })} />);

    // Collapsed: just the one toggle star, not all five (see RatingStars.tsx —
    // five permanent stars were the biggest single contributor to the
    // toolbar overflowing on a phone-width viewport).
    expect(screen.getByLabelText('Set rating')).toBeInTheDocument();
    expect(screen.queryByLabelText('4 stars')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Set rating'));
    const fourthStar = screen.getByLabelText('4 stars');
    fireEvent.click(fourthStar);

    expect(onRate).toHaveBeenCalledWith('a', 4);
    // Picking a value re-collapses the picker back to the single toggle.
    expect(screen.queryByLabelText('4 stars')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rating: 4 stars. Tap to change.')).toBeInTheDocument();
  });
});

describe('WpView windowing', () => {
  it('asks for more items when the index sits at the edge of a small window', () => {
    const onRequestMore = vi.fn();
    render(
      <WpView
        {...baseProps({
          index: 1,
          onRequestMore,
          hasMore: { prev: true, next: true },
        })}
      />,
    );
    expect(onRequestMore).toHaveBeenCalledWith('next');
  });
});

describe('WpView close button', () => {
  it('renders and calls onClose when onClose is provided', () => {
    const onClose = vi.fn();
    render(<WpView {...baseProps({ onClose })} />);

    fireEvent.click(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is absent when onClose is not provided', () => {
    render(<WpView {...baseProps()} />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });
});

describe('WpView chrome toggle (tap to hide/show controls)', () => {
  it('hides the close button and toolbar after a tap on the stage, and a second tap restores them', () => {
    const onClose = vi.fn();
    render(<WpView {...baseProps({ onClose, capabilities: { rate: true }, onRate: vi.fn() })} />);

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(screen.getByLabelText('Set rating')).toBeInTheDocument();

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 150 });

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Set rating')).not.toBeInTheDocument();

    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 150 });

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(screen.getByLabelText('Set rating')).toBeInTheDocument();
  });

  it('a real drag on the stage (swipe) does not toggle the chrome', () => {
    const onClose = vi.fn();
    const onIndexChange = vi.fn();
    render(<WpView {...baseProps({ onClose, onIndexChange })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 300, clientY: 150 });
    firePointer(stage, 'pointermove', { clientX: 100, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 100, clientY: 150 });

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});

describe('WpView swipe carousel (live sliding, not a jump-cut replace)', () => {
  it('renders neighboring slides alongside the current one for a live sliding transition', () => {
    render(<WpView {...baseProps({ index: 0 })} />);

    // index 0 of a 2-item window: current + next, no prev.
    const slides = document.querySelectorAll('.wpview-stage__slide');
    expect(slides.length).toBe(2);
    expect(document.querySelector('.wpview-stage__slide--current')).toBeInTheDocument();
  });

  it('a committed swipe only advances the index after the slide finishes animating off-stage, not instantly on release', async () => {
    const onIndexChange = vi.fn();
    render(<WpView {...baseProps({ index: 0, onIndexChange })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 300, clientY: 150 });
    firePointer(stage, 'pointermove', { clientX: 100, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 100, clientY: 150 });

    // Bug report: the photo used to visually "jump and replace" instead of
    // sliding — this asserts the index change is deferred until the slide
    // has settled (see useSwipe.ts settle()), not fired synchronously.
    expect(onIndexChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1));
  });
});

describe('WpView zoom + pan (bug: dragging a zoomed photo used to swipe/close instead of panning)', () => {
  it('a drag while zoomed in pans the photo instead of swiping to the next one or closing', async () => {
    const onIndexChange = vi.fn();
    const onClose = vi.fn();
    render(<WpView {...baseProps({ index: 0, onIndexChange, onClose })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    // Double-tap zooms in (doubleTapZoom default is 2 — see contract/defaults.ts).
    fireEvent.doubleClick(stage);

    firePointer(stage, 'pointerdown', { clientX: 200, clientY: 200 });
    firePointer(stage, 'pointermove', { clientX: 100, clientY: 260 });
    firePointer(stage, 'pointerup', { clientX: 100, clientY: 260 });

    await new Promise((r) => setTimeout(r, 250));
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    const img = document.querySelector('.wpview-stage__slide--current .wpview-image-loader__full');
    expect(img?.getAttribute('style')).toContain('translate(-100px, 60px)');
  });

  it('a drag while NOT zoomed still swipes/closes as before', async () => {
    const onIndexChange = vi.fn();
    render(<WpView {...baseProps({ index: 0, onIndexChange })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 300, clientY: 150 });
    firePointer(stage, 'pointermove', { clientX: 100, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 100, clientY: 150 });

    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1));
  });
});

describe('WpView slideshow transition', () => {
  function presentProps(
    slideshowTransition: Settings['slideshowTransition'],
    overrides: Partial<ComponentProps<typeof WpView>> = {},
  ) {
    return baseProps({
      capabilities: { present: true },
      // Controlled settings (CONTRACT.md) — short interval so the test
      // doesn't wait out the real 4s default, and picks the transition
      // under test without touching localStorage between tests.
      settings: { slideshowMs: 30, slideshowTransition },
      onSettingsChange: vi.fn(),
      ...overrides,
    });
  }

  it("'none' advances the index immediately when the slideshow interval fires", async () => {
    const onIndexChange = vi.fn();
    render(<WpView {...presentProps('none', { index: 0, onIndexChange })} />);

    fireEvent.click(screen.getByLabelText('Slideshow'));

    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1), { timeout: 1000 });
  });

  it("'fade' defers the index change until the cross-fade finishes, not the moment the interval fires", async () => {
    const onIndexChange = vi.fn();
    render(<WpView {...presentProps('fade', { index: 0, onIndexChange })} />);

    fireEvent.click(screen.getByLabelText('Slideshow'));

    // interval (30ms) has fired well before this, but FADE_MS (400ms) hasn't elapsed yet.
    await new Promise((r) => setTimeout(r, 150));
    expect(onIndexChange).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1), { timeout: 1000 });
  });

  it("'slide' defers the index change until the carousel settle finishes, same mechanism as a manual swipe", async () => {
    const onIndexChange = vi.fn();
    render(<WpView {...presentProps('slide', { index: 0, onIndexChange })} />);

    fireEvent.click(screen.getByLabelText('Slideshow'));

    await new Promise((r) => setTimeout(r, 150));
    expect(onIndexChange).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1), { timeout: 1000 });
  });
});

describe('WpView swipe-to-close', () => {
  it('a downward drag past the threshold calls onClose', () => {
    const onClose = vi.fn();
    render(<WpView {...baseProps({ onClose })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 50 });
    firePointer(stage, 'pointermove', { clientX: 150, clientY: 250 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 250 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('WpView context menu (emit-only, no local UI)', () => {
  it('right-clicking the stage calls onContextMenu with the item id and click position, and renders no menu itself', () => {
    const onContextMenu = vi.fn();
    render(<WpView {...baseProps({ onContextMenu })} />);

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    fireEvent.contextMenu(stage, { clientX: 123, clientY: 45 });

    expect(onContextMenu).toHaveBeenCalledWith('a', 123, 45);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not suppress the native context menu when onContextMenu is not provided', () => {
    render(<WpView {...baseProps()} />);
    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    const event = fireEvent.contextMenu(stage, { clientX: 10, clientY: 10 });
    // fireEvent returns false when preventDefault() was called — undefined handler must not call it.
    expect(event).toBe(true);
  });
});

describe('WpView info (emit-only, no local panel)', () => {
  it('clicking Info fires onInfoOpen every time, with no toggle/active state and no rendered panel', () => {
    const onInfoOpen = vi.fn();
    render(<WpView {...baseProps({ capabilities: { info: true }, onInfoOpen })} />);

    const infoButton = screen.getByLabelText('Info');
    fireEvent.click(infoButton);
    fireEvent.click(infoButton);

    expect(onInfoOpen).toHaveBeenNthCalledWith(1, 'a');
    expect(onInfoOpen).toHaveBeenNthCalledWith(2, 'a');
    expect(infoButton.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('WpView edit flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Rotate right emits an EditPatch with deg 90', async () => {
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/jpeg' }) })),
    );
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);

    const onEdit = vi.fn();
    render(<WpView {...baseProps({ capabilities: { rotate: true }, onEdit })} />);

    fireEvent.click(screen.getByLabelText('Rotate right'));

    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    const [id, patch] = onEdit.mock.calls[0] as [string, { type: string; deg: number }];
    expect(id).toBe('a');
    expect(patch).toMatchObject({ type: 'rotate', deg: 90 });
  });

  it('Rotate left emits an EditPatch with deg 270', async () => {
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/jpeg' }) })),
    );
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);

    const onEdit = vi.fn();
    render(<WpView {...baseProps({ capabilities: { rotate: true }, onEdit })} />);

    fireEvent.click(screen.getByLabelText('Rotate left'));

    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    const [id, patch] = onEdit.mock.calls[0] as [string, { type: string; deg: number }];
    expect(id).toBe('a');
    expect(patch).toMatchObject({ type: 'rotate', deg: 270 });
  });

  it('rotating again before the consumer confirms builds on the currently-displayed image, not the stale original', async () => {
    // Bug report: Rotate right then Rotate left visually jumped through 180°
    // instead of cancelling back out, because the second click re-rotated
    // the ORIGINAL fullSrc (still stale — the consumer's server-side rotate
    // hasn't confirmed and refreshed it yet) instead of the first rotation's
    // already-displayed optical result.
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    const fetchMock = vi.fn(async (_url: string) => ({
      blob: async () => new Blob(['src'], { type: 'image/jpeg' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);

    const onEdit = vi.fn();
    // onEdit deliberately does NOT feed a new fullSrc back — matches the real
    // gallery adapter, whose server-side rotate + thumbnail regen takes
    // seconds, during which items[].fullSrc stays exactly as it was.
    render(<WpView {...baseProps({ capabilities: { rotate: true }, onEdit })} />);

    fireEvent.click(screen.getByLabelText('Rotate right'));
    // Wait for the whole rotate -> applyEdit -> onEdit chain, not just the
    // fetch call — state.edit (and the closures reading it) only reflect
    // the new blobUrl once that dispatch has landed and React re-rendered.
    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/a.jpg');

    fireEvent.click(screen.getByLabelText('Rotate left'));
    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(2));

    expect(fetchMock.mock.calls[1]?.[0]).not.toBe('https://example.com/a.jpg');
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/^blob:/);
  });
});

describe('WpView photobar, tags, filename, transitions', () => {
  const named: ViewerItem[] = [
    { id: 'a', thumbSrc: 'a-thumb', fullSrc: 'https://example.com/a.jpg', meta: { filename: 'IMG_1.jpg' } },
    { id: 'b', thumbSrc: 'b-thumb', fullSrc: 'https://example.com/b.jpg' },
  ];

  it('shows the filename with extension while chrome is visible and hides it with the chrome', () => {
    render(<WpView {...baseProps({ items: named })} />);
    expect(screen.getByText('IMG_1.jpg')).toBeInTheDocument();

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 150 });
    expect(screen.queryByText('IMG_1.jpg')).not.toBeInTheDocument();
  });

  it('photobar toggles from the toolbar and selecting a thumb emits onIndexChange', () => {
    const onIndexChange = vi.fn();
    render(<WpView {...baseProps({ items: named, onIndexChange })} />);
    expect(document.querySelector('.wpview-photobar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Photo bar'));
    expect(document.querySelector('.wpview--photobar')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Photo 2'));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('tag picker toggles an offered tag through the registry (and respects the capability gate)', () => {
    const onTagToggle = vi.fn();
    render(
      <WpView
        {...baseProps({
          capabilities: { tag: true },
          onTagToggle,
          availableTags: [{ id: 't1', label: 'Travel' }],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Tags'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Travel' }));
    expect(onTagToggle).toHaveBeenCalledWith('a', 't1');
  });

  it('slideshow button swaps to the stop icon while presenting', () => {
    render(<WpView {...baseProps({ capabilities: { present: true } })} />);
    const btn = screen.getByLabelText('Slideshow');
    const before = btn.querySelector('path')!.getAttribute('d');
    fireEvent.click(btn);
    expect(btn.querySelector('path')!.getAttribute('d')).not.toBe(before);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('autoplaySlideshow starts presenting on open', () => {
    render(
      <WpView
        {...baseProps({
          capabilities: { present: true },
          settings: { autoplaySlideshow: true },
          onSettingsChange: vi.fn(),
        })}
      />,
    );
    expect(screen.getByLabelText('Slideshow')).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['zoom', 'flip', 'blur'] as const)("'%s' defers the index change until the transition ends", async (t) => {
    const onIndexChange = vi.fn();
    render(
      <WpView
        {...baseProps({
          capabilities: { present: true },
          settings: { slideshowMs: 30, slideshowTransition: t },
          onSettingsChange: vi.fn(),
          onIndexChange,
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Slideshow'));
    await new Promise((r) => setTimeout(r, 150));
    expect(onIndexChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1), { timeout: 1000 });
  });

  it('renders a <video> for video items', () => {
    const vids: ViewerItem[] = [{ id: 'v', type: 'video', thumbSrc: 'p', fullSrc: 'https://e.com/v.mp4' }];
    render(<WpView {...baseProps({ items: vids })} />);
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://e.com/v.mp4');
  });

  it('starting the slideshow on an already shown video plays it muted (autoPlay attribute alone would not)', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const vids: ViewerItem[] = [{ id: 'v', type: 'video', thumbSrc: 'p', fullSrc: 'https://e.com/v.mp4' }];
    render(<WpView {...baseProps({ items: vids, capabilities: { present: true } })} />);
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Slideshow'));
    expect(play).toHaveBeenCalled();
    expect((document.querySelector('video') as HTMLVideoElement).muted).toBe(true);
    play.mockRestore();
  });
});
