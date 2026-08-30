import type { EditPatch } from '../contract/types';
import { canvasToBlob, inferMimeType, loadBitmap } from './encode';

const JPEG_QUALITY = 0.92;

/**
 * Re-encode přes canvas je ztrátový (viz CLAUDE.md „dokumentovaný
 * kompromis, neřeš jako bug"). `deg` je vždy násobek 90°, canvas ho aplikuje
 * jako rotaci kolem středu s prohozenými rozměry pro 90/270.
 *
 * `src` (odkud se pixely berou) a `mimeHintSrc` (odkud se hádá výstupní
 * typ) jsou schválně oddělené parametry: při druhé rotaci v řadě, než
 * consumer potvrdí tu první, `src` bývá `blob:` URL z předchozího otočení
 * (viz WpView.tsx handleRotate) — bez příponu by inferMimeType tiše spadla
 * na PNG fallback i pro JPEG originál. `mimeHintSrc` proto vždycky drží tu
 * skutečnou URL originálu s příponou.
 */
export async function rotateImage(
  src: string,
  deg: 90 | 180 | 270,
  mimeHintSrc: string = src,
): Promise<EditPatch> {
  const bitmap = await loadBitmap(src);
  try {
    const swapDims = deg === 90 || deg === 270;
    const width = swapDims ? bitmap.height : bitmap.width;
    const height = swapDims ? bitmap.width : bitmap.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('wpview: OffscreenCanvas 2D context not available');

    ctx.translate(width / 2, height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const blob = await canvasToBlob(canvas, { mimeType: inferMimeType(mimeHintSrc), quality: JPEG_QUALITY });
    return { type: 'rotate', deg, blob };
  } finally {
    bitmap.close();
  }
}
