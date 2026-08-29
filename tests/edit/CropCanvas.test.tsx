import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCanvas, buildCropPatch } from '../../src/edit/CropCanvas';

class MockCtx {
  drawImage(..._args: unknown[]) {}
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return new MockCtx();
  }
  async convertToBlob({ type }: { type: string }) {
    return new Blob(['fake'], { type });
  }
}

function stubCanvasGlobals(bitmap: { width: number; height: number; close: () => void }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/jpeg' }) })),
  );
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);
}

describe('buildCropPatch', () => {
  const bitmap = { width: 800, height: 600, close: vi.fn() };

  beforeEach(() => stubCanvasGlobals(bitmap));
  afterEach(() => {
    vi.unstubAllGlobals();
    bitmap.close.mockClear();
  });

  it('returns a crop EditPatch carrying the requested rect', async () => {
    const rect = { x: 10, y: 20, w: 300, h: 200 };
    const patch = await buildCropPatch('https://example.com/photo.jpg', rect);
    expect(patch).toMatchObject({ type: 'crop', rect });
    expect(patch.blob.type).toBe('image/jpeg');
  });

  it('closes the source bitmap after encoding', async () => {
    await buildCropPatch('https://example.com/photo.jpg', { x: 0, y: 0, w: 10, h: 10 });
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});

describe('CropCanvas interaction', () => {
  const bitmap = { width: 800, height: 600, close: vi.fn() };

  beforeEach(() => stubCanvasGlobals(bitmap));
  afterEach(() => {
    vi.unstubAllGlobals();
    bitmap.close.mockClear();
  });

  it('drag-to-draw a rect and confirm produces a crop patch in natural-pixel coordinates', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<CropCanvas fullSrc="https://example.com/photo.jpg" onConfirm={onConfirm} onCancel={onCancel} />);

    const img = document.querySelector('.wpview-crop-canvas__image') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
    img.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.load(img);

    const stage = document.querySelector('.wpview-crop-canvas__stage') as HTMLElement;
    // Displayed at 2x downscale (800x600 natural vs 400x300 box): client (100,50)->(300,200)
    // maps to natural (200,100)->(600,400).
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 300, clientY: 200, pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const patch = onConfirm.mock.calls[0]![0];
    expect(patch).toMatchObject({ type: 'crop', rect: { x: 200, y: 100, w: 400, h: 300 } });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancel never calls onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<CropCanvas fullSrc="https://example.com/photo.jpg" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
