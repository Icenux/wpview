import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCropPatch } from '../../src/edit/CropCanvas';
import { blobBytes, isGifBlob } from '../../src/edit/encode';
import { readGifFrames } from '../../src/edit/gif';
import { rotateImage } from '../../src/edit/rotate';

const gifBytes = new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures/anim.gif')));

/** fetch vrací blob se zadaným typem; `createImageBitmap` nesmí být pro GIF vůbec zavolán. */
function stubFetch(type: string) {
  const createImageBitmap = vi.fn();
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => new Blob([gifBytes], { type }) })),
  );
  return createImageBitmap;
}

const bytesOf = blobBytes;

describe('animated GIF editing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rotateImage keeps the animation (all frames) and returns image/gif', async () => {
    const createImageBitmap = stubFetch('image/gif');
    const patch = await rotateImage('https://example.com/a.gif', 90);
    expect(patch).toMatchObject({ type: 'rotate', deg: 90 });
    expect(patch.blob.type).toBe('image/gif');
    const out = readGifFrames(await bytesOf(patch.blob));
    expect(out.frames).toHaveLength(4);
    expect([out.width, out.height]).toEqual([8, 12]);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('a second rotation of the blob: URL result still recognises the GIF without a file extension', async () => {
    stubFetch('image/gif');
    const first = await rotateImage('https://example.com/a.gif', 90);
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => first.blob })));
    const second = await rotateImage('blob:http://localhost/abc', 90, 'https://example.com/a.gif');
    expect(readGifFrames(await bytesOf(second.blob)).frames).toHaveLength(4);
    expect(second.blob.type).toBe('image/gif');
  });

  it('buildCropPatch crops every frame and keeps the rect in the patch', async () => {
    stubFetch('image/gif');
    const rect = { x: 2, y: 1, w: 7, h: 5 };
    const patch = await buildCropPatch('https://example.com/a.gif', rect);
    expect(patch).toMatchObject({ type: 'crop', rect });
    const out = readGifFrames(await bytesOf(patch.blob));
    expect([out.width, out.height, out.frames.length]).toEqual([7, 5, 4]);
  });

  it('detects a GIF by magic bytes when the server sends a generic content type', async () => {
    expect(await isGifBlob(new Blob([gifBytes], { type: 'application/octet-stream' }))).toBe(true);
    expect(await isGifBlob(new Blob([gifBytes], { type: '' }))).toBe(true);
    expect(await isGifBlob(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0])], { type: '' }))).toBe(false);
  });

  it('does not touch JPEG/PNG/WebP blobs (they keep the bitmap path)', async () => {
    expect(await isGifBlob(new Blob(['x'], { type: 'image/jpeg' }))).toBe(false);
    expect(await isGifBlob(new Blob([gifBytes], { type: 'image/png' }))).toBe(false);
  });
});
