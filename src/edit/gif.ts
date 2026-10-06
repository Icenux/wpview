/**
 * Úprava animovaných GIFů po snímcích — bez závislostí a bez canvasu.
 *
 * Canvas/`createImageBitmap` umí z GIFu jen první snímek, takže rotace nebo
 * ořez přes něj animaci zahodí. Tady GIF rozložíme sami (LZW dekodér, skládání
 * snímků podle disposal metod), každý snímek upravíme jako pole pixelů a
 * složíme zpátky do GIFu (LZW enkodér, paleta ≤ 256 barev). Zachová se počet
 * snímků, jejich zpoždění, smyčka (NETSCAPE2.0) i průhlednost.
 *
 * Ztráta: GIF má max. 256 barev na snímek. Snímky složené z víc barev (u GIFů
 * s lokálními paletami se to stává) se kvantizují (median cut). Průhlednost je
 * jen 1bitová (alfa < 128 = průhledné), jako ve formátu samotném.
 */

export type GifOp =
  | { type: 'rotate'; deg: 90 | 180 | 270 }
  | { type: 'crop'; rect: { x: number; y: number; w: number; h: number } };

/** GIF87a/GIF89a podle magických bajtů ("GIF8"). */
export function isGifBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
}

// ---------------------------------------------------------------------------
// Čtení
// ---------------------------------------------------------------------------

class ByteReader {
  pos = 0;
  constructor(readonly data: Uint8Array) {}

  u8(): number {
    if (this.pos >= this.data.length) throw new Error('wpview: truncated GIF');
    return this.data[this.pos++]!;
  }

  u16(): number {
    const lo = this.u8();
    return lo | (this.u8() << 8);
  }

  bytes(n: number): Uint8Array {
    if (this.pos + n > this.data.length) throw new Error('wpview: truncated GIF');
    const out = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /** Sloučí řetěz sub-bloků (délka + data, ukončeno nulou) do jednoho pole. */
  subBlocks(): Uint8Array {
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const n = this.u8();
      if (n === 0) break;
      const part = this.bytes(n);
      parts.push(part);
      total += n;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  const out = new Uint8Array(pixelCount);
  let size = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  let firstChar = 0;
  let bits = 0;
  let nbits = 0;
  let p = 0;
  let o = 0;

  while (o < pixelCount) {
    while (nbits < size) {
      if (p >= data.length) return out;
      bits |= data[p++]! << nbits;
      nbits += 8;
    }
    const code = bits & ((1 << size) - 1);
    bits >>>= size;
    nbits -= size;

    if (code === clear) {
      size = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;

    if (prev === -1) {
      out[o++] = code;
      prev = code;
      firstChar = code;
      continue;
    }

    let sp = 0;
    let cur = code;
    if (code >= next) {
      // KwKwK: kód, který dekodér ještě nemá — řetězec předchozího + jeho první znak.
      stack[sp++] = firstChar;
      cur = prev;
    }
    while (cur >= clear) {
      stack[sp++] = suffix[cur]!;
      cur = prefix[cur]!;
    }
    stack[sp++] = cur;
    firstChar = cur;
    while (sp > 0 && o < pixelCount) out[o++] = stack[--sp]!;

    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = firstChar;
      next++;
      if (next === 1 << size && size < 12) size++;
    }
    prev = code;
  }
  return out;
}

interface DecodedFrame {
  /** RGBA celého plátna. Platí jen do příštího kroku iterátoru (pole se přepisuje). */
  rgba: Uint8ClampedArray;
  /** Zpoždění ve stovkách sekundy. */
  delay: number;
}

interface GifDecoder {
  width: number;
  height: number;
  /** Počet opakování z NETSCAPE2.0 (0 = nekonečně); null = rozšíření chybí (přehraje se jednou). */
  loop: () => number | null;
  frames: Generator<DecodedFrame>;
}

const INTERLACE_PASSES: [start: number, step: number][] = [
  [0, 8],
  [4, 8],
  [2, 4],
  [1, 2],
];

function decodeGif(bytes: Uint8Array): GifDecoder {
  if (!isGifBytes(bytes)) throw new Error('wpview: not a GIF');
  const r = new ByteReader(bytes);
  r.pos = 6;
  const width = r.u16();
  const height = r.u16();
  const packed = r.u8();
  r.u8(); // background color index — prohlížeče ho ignorují
  r.u8(); // pixel aspect ratio
  if (width === 0 || height === 0) throw new Error('wpview: empty GIF');
  const globalPalette = packed & 0x80 ? r.bytes(3 * (1 << ((packed & 7) + 1))) : null;

  let loop: number | null = null;

  function* frames(): Generator<DecodedFrame> {
    const canvas = new Uint8ClampedArray(width * height * 4);
    let gce = { dispose: 0, transparent: -1, delay: 0 };
    let prevDispose = 0;
    let prevRect: { l: number; t: number; w: number; h: number } | null = null;
    let snapshot: Uint8ClampedArray | null = null;

    for (;;) {
      const block = r.u8();
      if (block === 0x3b) return;
      if (block === 0x21) {
        const label = r.u8();
        if (label === 0xf9) {
          r.u8(); // délka bloku (4)
          const flags = r.u8();
          const delay = r.u16();
          const transIndex = r.u8();
          r.u8();
          gce = { dispose: (flags >> 2) & 7, transparent: flags & 1 ? transIndex : -1, delay };
        } else if (label === 0xff) {
          const idLen = r.u8();
          const id = String.fromCharCode(...r.bytes(idLen));
          const data = r.subBlocks();
          if (id === 'NETSCAPE2.0' && data[0] === 1 && data.length >= 3) loop = data[1]! | (data[2]! << 8);
        } else {
          r.subBlocks();
        }
        continue;
      }
      if (block !== 0x2c) throw new Error('wpview: corrupt GIF');

      const left = r.u16();
      const top = r.u16();
      const w = r.u16();
      const h = r.u16();
      const flags = r.u8();
      const palette = flags & 0x80 ? r.bytes(3 * (1 << ((flags & 7) + 1))) : globalPalette;
      if (!palette) throw new Error('wpview: GIF without a palette');
      const minCode = r.u8();
      const compressed = r.subBlocks();
      if (minCode < 2 || minCode > 8) throw new Error('wpview: corrupt GIF');
      const indices = lzwDecode(compressed, minCode, w * h);

      // Disposal předchozího snímku se uplatní až teď, před kreslením tohoto.
      if (prevDispose === 2 && prevRect) {
        for (let y = prevRect.t; y < Math.min(height, prevRect.t + prevRect.h); y++) {
          const from = (y * width + prevRect.l) * 4;
          const to = (y * width + Math.min(width, prevRect.l + prevRect.w)) * 4;
          canvas.fill(0, from, to);
        }
      } else if (prevDispose === 3 && snapshot) {
        canvas.set(snapshot);
      }
      snapshot = gce.dispose === 3 ? canvas.slice() : null;

      const rowOf: number[] = [];
      if (flags & 0x40) {
        for (const [start, step] of INTERLACE_PASSES) for (let y = start; y < h; y += step) rowOf.push(y);
      } else {
        for (let y = 0; y < h; y++) rowOf.push(y);
      }
      for (let i = 0; i < h; i++) {
        const destY = top + rowOf[i]!;
        if (destY >= height) continue;
        for (let x = 0; x < w; x++) {
          const destX = left + x;
          if (destX >= width) break;
          const idx = indices[i * w + x]!;
          if (idx === gce.transparent) continue;
          const d = (destY * width + destX) * 4;
          canvas[d] = palette[idx * 3] ?? 0;
          canvas[d + 1] = palette[idx * 3 + 1] ?? 0;
          canvas[d + 2] = palette[idx * 3 + 2] ?? 0;
          canvas[d + 3] = 255;
        }
      }

      yield { rgba: canvas, delay: gce.delay };
      prevDispose = gce.dispose;
      prevRect = { l: left, t: top, w, h };
      gce = { dispose: 0, transparent: -1, delay: 0 };
    }
  }

  return { width, height, loop: () => loop, frames: frames() };
}

// ---------------------------------------------------------------------------
// Úpravy pixelů
// ---------------------------------------------------------------------------

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Rozměry výsledku po úpravě `op` nad plátnem `width`×`height`. */
function outputBox(width: number, height: number, op: GifOp) {
  if (op.type === 'rotate') {
    const swap = op.deg === 90 || op.deg === 270;
    return { x: 0, y: 0, w: swap ? height : width, h: swap ? width : height };
  }
  const x = clampInt(op.rect.x, 0, width - 1);
  const y = clampInt(op.rect.y, 0, height - 1);
  return {
    x,
    y,
    w: clampInt(op.rect.w, 1, width - x),
    h: clampInt(op.rect.h, 1, height - y),
  };
}

function applyOp(src: Uint8ClampedArray, width: number, height: number, op: GifOp): Uint8ClampedArray {
  const box = outputBox(width, height, op);
  const out = new Uint8ClampedArray(box.w * box.h * 4);

  if (op.type === 'crop') {
    for (let y = 0; y < box.h; y++) {
      const from = ((box.y + y) * width + box.x) * 4;
      out.set(src.subarray(from, from + box.w * 4), y * box.w * 4);
    }
    return out;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 90 = po směru hodinových ručiček (stejně jako canvas rotate v rotate.ts).
      let dx: number;
      let dy: number;
      if (op.deg === 90) {
        dx = height - 1 - y;
        dy = x;
      } else if (op.deg === 270) {
        dx = y;
        dy = width - 1 - x;
      } else {
        dx = width - 1 - x;
        dy = height - 1 - y;
      }
      const s = (y * width + x) * 4;
      const d = (dy * box.w + dx) * 4;
      out[d] = src[s]!;
      out[d + 1] = src[s + 1]!;
      out[d + 2] = src[s + 2]!;
      out[d + 3] = src[s + 3]!;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zápis
// ---------------------------------------------------------------------------

class ByteWriter {
  private buf = new Uint8Array(4096);
  length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.length + extra));
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  u8(v: number) {
    this.ensure(1);
    this.buf[this.length++] = v & 255;
  }

  u16(v: number) {
    this.u8(v);
    this.u8(v >> 8);
  }

  bytes(data: ArrayLike<number>) {
    this.ensure(data.length);
    for (let i = 0; i < data.length; i++) this.buf[this.length++] = data[i]! & 255;
  }

  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }

  /** Data rozdělená do sub-bloků po max. 255 bajtech + nulový terminátor. */
  subBlocks(data: Uint8Array) {
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.subarray(i, Math.min(data.length, i + 255));
      this.u8(chunk.length);
      this.bytes(chunk);
    }
    this.u8(0);
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const out = new ByteWriter();
  const dict = new Map<number, number>();
  let size = minCodeSize + 1;
  let next = eoi + 1;
  let bits = 0;
  let nbits = 0;

  function emit(code: number) {
    bits |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      out.u8(bits & 255);
      bits >>>= 8;
      nbits -= 8;
    }
  }

  // Šířka kódu roste, jakmile další volný kód nevejde do aktuální šířky —
  // stejně jako ve dekodéru (ten je o jeden záznam pozadu, proto se kontroluje
  // až PO zapsání kódu a PŘED přidáním nového záznamu).
  function emitData(code: number) {
    emit(code);
    if (next > (1 << size) - 1 && size < 12) size++;
  }

  emit(clear);
  let cur = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = (cur << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      cur = found;
      continue;
    }
    emitData(cur);
    if (next < 4096) {
      dict.set(key, next++);
    } else {
      emit(clear);
      dict.clear();
      next = eoi + 1;
      size = minCodeSize + 1;
    }
    cur = k;
  }
  emitData(cur);
  emit(eoi);
  if (nbits > 0) out.u8(bits & 255);
  return out.result();
}

interface Quantized {
  /** RGB trojice, délka = 3 × počet barev (včetně průhledné pozice). */
  palette: number[];
  indices: Uint8Array;
  /** Index průhledné barvy, nebo -1. */
  transparent: number;
}

/** RGBA → indexovaný obraz s paletou ≤ 256 barev (přesně, je-li barev málo, jinak median cut). */
function quantize(rgba: Uint8ClampedArray, pixelCount: number): Quantized {
  const keys = new Int32Array(pixelCount);
  const counts = new Map<number, number>();
  let hasTransparent = false;
  for (let i = 0; i < pixelCount; i++) {
    if (rgba[i * 4 + 3]! < 128) {
      keys[i] = -1;
      hasTransparent = true;
      continue;
    }
    const key = (rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!;
    keys[i] = key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const maxColors = hasTransparent ? 255 : 256;
  const colorIndex = new Map<number, number>();
  const palette: number[] = [];
  const push = (r: number, g: number, b: number) => {
    palette.push(r, g, b);
    return palette.length / 3 - 1;
  };

  if (counts.size <= maxColors) {
    for (const key of counts.keys()) colorIndex.set(key, push(key >> 16, (key >> 8) & 255, key & 255));
  } else {
    type Entry = { key: number; count: number };
    const channel = (key: number, c: 0 | 1 | 2) => (key >> (16 - 8 * c)) & 255;
    let boxes: Entry[][] = [[...counts].map(([key, count]) => ({ key, count }))];

    while (boxes.length < maxColors) {
      // Rozděl box s největším rozsahem v některém kanálu (a víc než jednou barvou).
      let bestBox = -1;
      let bestChannel: 0 | 1 | 2 = 0;
      let bestRange = 0;
      boxes.forEach((box, bi) => {
        if (box.length < 2) return;
        for (const c of [0, 1, 2] as const) {
          let lo = 255;
          let hi = 0;
          for (const e of box) {
            const v = channel(e.key, c);
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (hi - lo > bestRange) {
            bestRange = hi - lo;
            bestBox = bi;
            bestChannel = c;
          }
        }
      });
      if (bestBox === -1) break;

      const box = boxes[bestBox]!;
      box.sort((a, b) => channel(a.key, bestChannel) - channel(b.key, bestChannel));
      const total = box.reduce((s, e) => s + e.count, 0);
      let acc = 0;
      let split = 1;
      for (let i = 0; i < box.length - 1; i++) {
        acc += box[i]!.count;
        split = i + 1;
        if (acc >= total / 2) break;
      }
      boxes = [...boxes.slice(0, bestBox), box.slice(0, split), box.slice(split), ...boxes.slice(bestBox + 1)];
    }

    for (const box of boxes) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (const e of box) {
        r += channel(e.key, 0) * e.count;
        g += channel(e.key, 1) * e.count;
        b += channel(e.key, 2) * e.count;
        n += e.count;
      }
      const index = push(Math.round(r / n), Math.round(g / n), Math.round(b / n));
      for (const e of box) colorIndex.set(e.key, index);
    }
  }

  const transparent = hasTransparent ? push(0, 0, 0) : -1;
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    indices[i] = keys[i] === -1 ? transparent : colorIndex.get(keys[i]!)!;
  }
  return { palette, indices, transparent };
}

function writeFrame(out: ByteWriter, rgba: Uint8ClampedArray, w: number, h: number, delay: number) {
  const { palette, indices, transparent } = quantize(rgba, w * h);
  const colorCount = palette.length / 3;
  const bits = Math.max(1, Math.ceil(Math.log2(colorCount)));
  const tableSize = 1 << bits;
  while (palette.length < tableSize * 3) palette.push(0);

  // Disposal 2: každý snímek je celé plátno, další se kreslí na čisté pozadí
  // (jinak by u průhledných míst prosvítal ten předchozí).
  out.bytes([0x21, 0xf9, 0x04, (2 << 2) | (transparent >= 0 ? 1 : 0)]);
  out.u16(delay);
  out.u8(transparent >= 0 ? transparent : 0);
  out.u8(0);

  out.u8(0x2c);
  out.u16(0);
  out.u16(0);
  out.u16(w);
  out.u16(h);
  out.u8(0x80 | (bits - 1));
  out.bytes(palette);

  const minCode = Math.max(2, bits);
  out.u8(minCode);
  out.subBlocks(lzwEncode(indices, minCode));
}

/** Rozloží GIF na plně složené snímky (RGBA celého plátna) — hlavně pro testy a kontrolu. */
export function readGifFrames(bytes: Uint8Array) {
  const gif = decodeGif(bytes);
  const frames: { rgba: Uint8ClampedArray; delay: number }[] = [];
  for (const f of gif.frames) frames.push({ rgba: f.rgba.slice(), delay: f.delay });
  return { width: gif.width, height: gif.height, loop: gif.loop(), frames };
}

/**
 * Aplikuje `op` (otočení / ořez) na každý snímek animovaného GIFu a vrátí nový
 * GIF. Snímky se zpracovávají jeden po druhém, takže se do paměti nikdy
 * nenačte celá animace rozbalená.
 */
export function transformGif(bytes: Uint8Array, op: GifOp): Uint8Array {
  const gif = decodeGif(bytes);
  const box = outputBox(gif.width, gif.height, op);
  const out = new ByteWriter();

  out.ascii('GIF89a');
  out.u16(box.w);
  out.u16(box.h);
  out.u8(0); // bez globální palety — každý snímek má lokální
  out.u8(0);
  out.u8(0);

  let count = 0;
  for (const frame of gif.frames) {
    if (count === 0) {
      const loop = gif.loop();
      if (loop !== null) {
        out.bytes([0x21, 0xff, 0x0b]);
        out.ascii('NETSCAPE2.0');
        out.bytes([0x03, 0x01]);
        out.u16(loop);
        out.u8(0);
      }
    }
    const rgba = applyOp(frame.rgba, gif.width, gif.height, op);
    writeFrame(out, rgba, box.w, box.h, frame.delay);
    count++;
  }
  if (count === 0) throw new Error('wpview: GIF has no frames');

  out.u8(0x3b);
  return out.result();
}
