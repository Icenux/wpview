import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGifBytes, readGifFrames, transformGif } from '../../src/edit/gif';

interface Expected {
  width: number;
  height: number;
  loop: number | null;
  frames: { delayCs: number; rgba: number[] }[];
}

const gifBytes = new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures/anim.gif')));
// Referenční snímky vyrobil Pillow (cizí dekodér) — viz ~/Documents/CC/bin/make-gif-test-fixture.py.
const expected: Expected = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/anim.expected.json'), 'utf8'));

/** Průhledné pixely se porovnávají jen podle alfy, ostatní podle RGB. */
function expectSamePixels(actual: ArrayLike<number>, wanted: ArrayLike<number>, label = '') {
  expect(actual.length, `${label} length`).toBe(wanted.length);
  for (let i = 0; i < wanted.length; i += 4) {
    const wantedAlpha = wanted[i + 3]! < 128 ? 0 : 255;
    const actualAlpha = actual[i + 3]! < 128 ? 0 : 255;
    expect(actualAlpha, `${label} alpha @${i / 4}`).toBe(wantedAlpha);
    if (wantedAlpha === 255) {
      expect([actual[i], actual[i + 1], actual[i + 2]], `${label} rgb @${i / 4}`).toEqual([
        wanted[i],
        wanted[i + 1],
        wanted[i + 2],
      ]);
    }
  }
}

/** Referenční otočení/ořez nad polem RGBA — nezávislé na implementaci v gif.ts. */
function rotateRef(rgba: ArrayLike<number>, w: number, h: number, deg: 90 | 180 | 270) {
  const swap = deg !== 180;
  const nw = swap ? h : w;
  const out = new Array<number>(w * h * 4).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny] = deg === 90 ? [h - 1 - y, x] : deg === 270 ? [y, w - 1 - x] : [w - 1 - x, h - 1 - y];
      for (let c = 0; c < 4; c++) out[(ny * nw + nx) * 4 + c] = rgba[(y * w + x) * 4 + c]!;
    }
  }
  return out;
}

function cropRef(rgba: ArrayLike<number>, w: number, x0: number, y0: number, cw: number, ch: number) {
  const out: number[] = [];
  for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) for (let c = 0; c < 4; c++) out.push(rgba[(y * w + x) * 4 + c]!);
  return out;
}

describe('isGifBytes', () => {
  it('recognises the GIF magic bytes', () => {
    expect(isGifBytes(gifBytes)).toBe(true);
    expect(isGifBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(false);
    expect(isGifBytes(new Uint8Array([0x47, 0x49]))).toBe(false);
  });
});

describe('readGifFrames (decoder)', () => {
  it('matches the frames, delays and loop count produced by an independent decoder', () => {
    const gif = readGifFrames(gifBytes);
    expect(gif.width).toBe(expected.width);
    expect(gif.height).toBe(expected.height);
    expect(gif.loop).toBe(expected.loop);
    expect(gif.frames).toHaveLength(expected.frames.length);
    gif.frames.forEach((f, i) => {
      expect(f.delay, `frame ${i} delay`).toBe(expected.frames[i]!.delayCs);
      expectSamePixels(f.rgba, expected.frames[i]!.rgba, `frame ${i}`);
    });
  });

  it('rejects data that is not a GIF', () => {
    expect(() => readGifFrames(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

describe('transformGif', () => {
  it.each([90, 180, 270] as const)('rotates every frame by %i° and keeps delays, loop and frame count', (deg) => {
    const out = readGifFrames(transformGif(gifBytes, { type: 'rotate', deg }));
    const swap = deg !== 180;
    expect(out.width).toBe(swap ? expected.height : expected.width);
    expect(out.height).toBe(swap ? expected.width : expected.height);
    expect(out.loop).toBe(expected.loop);
    expect(out.frames).toHaveLength(expected.frames.length);
    out.frames.forEach((f, i) => {
      expect(f.delay).toBe(expected.frames[i]!.delayCs);
      expectSamePixels(f.rgba, rotateRef(expected.frames[i]!.rgba, expected.width, expected.height, deg), `frame ${i}`);
    });
  });

  it('four 90° rotations in a row give the original animation back', () => {
    let bytes: Uint8Array = gifBytes;
    for (let i = 0; i < 4; i++) bytes = transformGif(bytes, { type: 'rotate', deg: 90 });
    const out = readGifFrames(bytes);
    out.frames.forEach((f, i) => expectSamePixels(f.rgba, expected.frames[i]!.rgba, `frame ${i}`));
  });

  it('crops every frame to the rect', () => {
    const rect = { x: 2, y: 1, w: 7, h: 5 };
    const out = readGifFrames(transformGif(gifBytes, { type: 'crop', rect }));
    expect([out.width, out.height]).toEqual([7, 5]);
    expect(out.frames).toHaveLength(expected.frames.length);
    out.frames.forEach((f, i) => {
      expect(f.delay).toBe(expected.frames[i]!.delayCs);
      expectSamePixels(f.rgba, cropRef(expected.frames[i]!.rgba, expected.width, 2, 1, 7, 5), `frame ${i}`);
    });
  });

  it('clamps a crop rect that sticks out of the image', () => {
    const out = readGifFrames(transformGif(gifBytes, { type: 'crop', rect: { x: 8, y: 6, w: 50, h: 50 } }));
    expect([out.width, out.height]).toEqual([4, 2]);
  });

  it('keeps an animation without a loop extension without one (plays once)', () => {
    // Odstraní NETSCAPE2.0 blok (0x21 0xFF 0x0B "NETSCAPE2.0" 0x03 0x01 lo hi 0x00 = 19 B).
    const marker = Array.from('NETSCAPE2.0', (c) => c.charCodeAt(0));
    let at = -1;
    for (let i = 0; i < gifBytes.length - marker.length; i++) {
      if (marker.every((b, k) => gifBytes[i + k] === b)) at = i;
    }
    expect(at).toBeGreaterThan(2);
    const stripped = new Uint8Array([...gifBytes.subarray(0, at - 3), ...gifBytes.subarray(at - 3 + 19)]);
    expect(readGifFrames(stripped).loop).toBeNull();
    expect(readGifFrames(transformGif(stripped, { type: 'rotate', deg: 90 })).loop).toBeNull();
  });

  it('quantizes frames with more than 256 colors instead of failing', () => {
    // Dva snímky s vlastními paletami po 256 barvách; druhý překryje pravou půlku prvního
    // bez disposal => složený snímek má ~512 barev.
    const W = 32;
    const H = 16;
    // 256 navzájem různých barev; jiný offset => jiná (téměř disjunktní) sada.
    const palette = (offset: number) =>
      Array.from({ length: 256 }, (_, k) => [k, (k * 7 + offset) & 255, (k * 13 + offset * 3) & 255]).flat();
    const frame = (left: number, w: number, pal: number[], delay: number) => {
      const indices = Array.from({ length: w * H }, (_, i) => i % 256);
      return rawFrame(left, 0, w, H, pal, indices, delay);
    };
    const bytes = new Uint8Array([
      ...Array.from('GIF89a', (c) => c.charCodeAt(0)),
      W, 0, H, 0, 0, 0, 0,
      ...frame(0, W, palette(0), 5),
      ...frame(W / 2, W / 2, palette(101), 5),
      0x3b,
    ]);
    const before = readGifFrames(bytes);
    const distinct = new Set<number>();
    const px = before.frames[1]!.rgba;
    for (let i = 0; i < px.length; i += 4) distinct.add((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
    expect(distinct.size).toBeGreaterThan(256);

    const out = readGifFrames(transformGif(bytes, { type: 'rotate', deg: 90 }));
    expect([out.width, out.height]).toEqual([H, W]);
    expect(out.frames).toHaveLength(2);
    // Kvantizace je ztrátová, ale obraz musí zůstat blízko originálu (střední chyba kanálu).
    const ref = rotateRef(before.frames[1]!.rgba, W, H, 90);
    const got = out.frames[1]!.rgba;
    let err = 0;
    for (let i = 0; i < ref.length; i += 4) for (let c = 0; c < 3; c++) err += Math.abs(got[i + c]! - ref[i + c]!);
    expect(err / (ref.length / 4) / 3).toBeLessThan(24);
  });
});

/**
 * Nezávislý minimální GIF zapisovač pro testy: LZW jen z "literálových" kódů
 * (clear každých 200 pixelů), takže nesdílí žádnou logiku s enkodérem v gif.ts.
 */
function rawFrame(left: number, top: number, w: number, h: number, palette: number[], indices: number[], delayCs: number) {
  const codes: number[] = [];
  indices.forEach((v, i) => {
    if (i % 200 === 0) codes.push(256); // clear
    codes.push(v);
  });
  codes.push(257); // end of information
  const bytes: number[] = [];
  let acc = 0;
  let nbits = 0;
  for (const c of codes) {
    acc |= c << nbits;
    nbits += 9;
    while (nbits >= 8) {
      bytes.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  }
  if (nbits > 0) bytes.push(acc & 255);
  const blocks: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  return [
    0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0,
    0x2c, left & 255, left >> 8, top & 255, top >> 8, w & 255, w >> 8, h & 255, h >> 8, 0x87,
    ...palette,
    8,
    ...blocks,
    0,
  ];
}

describe('GIF safety limits', () => {
  /** Hlavička GIFu s libovolným plátnem a jedním prázdným obrázkem — dekodér nesmí nic naalokovat předem. */
  const header = (w: number, h: number) =>
    new Uint8Array([...Array.from('GIF89a', (c) => c.charCodeAt(0)), w & 255, w >> 8, h & 255, h >> 8, 0, 0, 0, 0x3b]);

  it('refuses a canvas of 65535×65535 px instead of allocating gigabytes', () => {
    expect(() => transformGif(header(65535, 65535), { type: 'rotate', deg: 90 })).toThrow(/too large/);
    expect(() => readGifFrames(header(65535, 65535))).toThrow(/too large/);
  });

  it('refuses an oversized frame descriptor on a small canvas', () => {
    const bytes = new Uint8Array([
      ...Array.from('GIF89a', (c) => c.charCodeAt(0)),
      2, 0, 2, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255, // plátno 2×2 + 2barevná globální paleta
      0x2c, 0, 0, 0, 0, 255, 255, 255, 255, 0, // obrázek 65535×65535
      2, 0, 0x3b,
    ]);
    expect(() => readGifFrames(bytes)).toThrow(/too large/);
  });

  it('treats a non-finite crop rect as the smallest valid crop, not as a huge allocation', () => {
    const out = readGifFrames(
      transformGif(gifBytes, { type: 'crop', rect: { x: Number.NaN, y: 0, w: Number.POSITIVE_INFINITY, h: Number.NaN } }),
    );
    expect(out.width).toBeGreaterThanOrEqual(1);
    expect(out.width * out.height).toBeLessThanOrEqual(expected.width * expected.height);
  });
});
