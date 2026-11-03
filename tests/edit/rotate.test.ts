import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rotateImage } from '../../src/edit/rotate';

class MockCtx {
  calls: string[] = [];
  translate(x: number, y: number) {
    this.calls.push(`translate(${x},${y})`);
  }
  rotate(angle: number) {
    this.calls.push(`rotate(${angle})`);
  }
  drawImage(..._args: unknown[]) {
    this.calls.push('drawImage');
  }
}

const instances: MockOffscreenCanvas[] = [];

class MockOffscreenCanvas {
  width: number;
  height: number;
  ctx = new MockCtx();
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    instances.push(this);
  }
  getContext() {
    return this.ctx;
  }
  async convertToBlob({ type }: { type: string }) {
    return new Blob(['fake'], { type });
  }
}

describe('rotateImage', () => {
  const bitmap = { width: 800, height: 600, close: vi.fn() };

  beforeEach(() => {
    instances.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/jpeg' }) })),
    );
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as unknown as typeof OffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    bitmap.close.mockClear();
  });

  it('swaps canvas width/height for a 90° rotation', async () => {
    const patch = await rotateImage('https://example.com/photo.jpg', 90);
    expect(patch).toMatchObject({ type: 'rotate', deg: 90 });
    expect(instances[0]?.width).toBe(bitmap.height);
    expect(instances[0]?.height).toBe(bitmap.width);
  });

  it('keeps canvas width/height for a 180° rotation', async () => {
    await rotateImage('https://example.com/photo.jpg', 180);
    expect(instances[0]?.width).toBe(bitmap.width);
    expect(instances[0]?.height).toBe(bitmap.height);
  });

  it('rotates by the requested angle in radians', async () => {
    await rotateImage('https://example.com/photo.jpg', 90);
    expect(instances[0]?.ctx.calls).toContain(`rotate(${Math.PI / 2})`);
  });

  it('closes the source bitmap after encoding', async () => {
    await rotateImage('https://example.com/photo.jpg', 90);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('infers mime type from the source extension', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['src'], { type: 'image/png' }) })),
    );
    const patch = await rotateImage('https://example.com/photo.png', 90);
    expect(patch.blob.type).toBe('image/png');
  });
});
