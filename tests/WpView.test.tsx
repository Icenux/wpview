import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WpView } from '../src/WpView';
import type { ItemState, ViewerItem } from '../src/contract/types';

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

describe('WpView edit flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rotate emits an EditPatch through onEdit', async () => {
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/jpeg' }) })),
    );
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);

    const onEdit = vi.fn();
    render(<WpView {...baseProps({ capabilities: { rotate: true }, onEdit })} />);

    fireEvent.click(screen.getByLabelText('Rotate'));

    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    const [id, patch] = onEdit.mock.calls[0] as [string, { type: string }];
    expect(id).toBe('a');
    expect(patch.type).toBe('rotate');
  });
});
