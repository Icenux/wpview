import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WpView } from '../src/WpView';
import type { ItemState, ViewerItem } from '../src/contract/types';

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

    expect(screen.getByLabelText('4 stars')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete')).toBeInTheDocument();
    expect(screen.queryByLabelText('Favorite')).not.toBeInTheDocument();
  });

  it('hides an action when the handler exists but the capability is missing', () => {
    render(<WpView {...baseProps({ onDelete: vi.fn() })} />);
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
  });
});

describe('WpView rating', () => {
  it('shows the optimistic value immediately and emits onRate', () => {
    const onRate = vi.fn();
    render(<WpView {...baseProps({ capabilities: { rate: true }, onRate })} />);

    const fourthStar = screen.getByLabelText('4 stars');
    fireEvent.click(fourthStar);

    expect(onRate).toHaveBeenCalledWith('a', 4);
    expect(fourthStar.className).toContain('wpview-rating-stars__star--filled');
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
    expect(screen.getByLabelText('4 stars')).toBeInTheDocument();

    const stage = document.querySelector('.wpview-stage') as HTMLElement;
    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 150 });

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('4 stars')).not.toBeInTheDocument();

    firePointer(stage, 'pointerdown', { clientX: 150, clientY: 150 });
    firePointer(stage, 'pointerup', { clientX: 150, clientY: 150 });

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(screen.getByLabelText('4 stars')).toBeInTheDocument();
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
});
