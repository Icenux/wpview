import { isGifBytes, transformGif } from './gif';
import type { GifOp } from './gif';

interface EncodeOptions {
  mimeType: string;
  /** 0..1, jen pro jpeg/webp. */
  quality?: number;
}

export async function canvasToBlob(
  canvas: OffscreenCanvas,
  { mimeType, quality }: EncodeOptions,
): Promise<Blob> {
  return canvas.convertToBlob({ type: mimeType, quality });
}

/** JPEG→JPEG, jinak PNG — nikdy nekonvertuje do formátu s horší kompresí, než měl vstup. */
export function inferMimeType(src: string, fallback = 'image/png'): string {
  const match = /\.(\w+)(?:\?.*)?(?:#.*)?$/.exec(src);
  const ext = match?.[1]?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    default:
      return fallback;
  }
}

export async function fetchBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  return res.blob();
}

export async function loadBitmap(src: string): Promise<ImageBitmap> {
  return createImageBitmap(await fetchBlob(src));
}

/** `Blob.arrayBuffer()` chybí ve starších prohlížečích (Safari < 14) i v jsdom — fallback přes FileReader. */
export function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const KNOWN_STILL_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Je to GIF? Podle MIME typu blobu, a když ten chybí nebo je obecný (server
 * pošle application/octet-stream, `blob:` URL bez přípony), podle magických
 * bajtů — přípona v URL se nedá spolehlivě číst, viz rotate.ts (mimeHintSrc).
 */
export async function isGifBlob(blob: Blob): Promise<boolean> {
  if (blob.type === 'image/gif') return true;
  if (KNOWN_STILL_TYPES.has(blob.type)) return false;
  try {
    return isGifBytes(await blobBytes(blob.slice(0, 6)));
  } catch {
    return false;
  }
}

/** GIF upravený po snímcích (animace se zachová) — viz gif.ts. */
export async function editGifBlob(blob: Blob, op: GifOp): Promise<Blob> {
  const out = transformGif(await blobBytes(blob), op);
  return new Blob([out.buffer as ArrayBuffer], { type: 'image/gif' }); // result() je přesný výřez, buffer nemá přesah
}
