import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EditPatch } from '../contract/types';
import { canvasToBlob, inferMimeType, loadBitmap } from './encode';

const JPEG_QUALITY = 0.92;

interface Point {
  x: number;
  y: number;
}

interface NaturalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropCanvasProps {
  fullSrc: string;
  onConfirm: (patch: EditPatch) => void;
  onCancel: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ořízne bitmapu na `rect` (v natural-pixelech vstupního obrázku) a vrátí hotový EditPatch. */
export async function buildCropPatch(fullSrc: string, rect: NaturalRect): Promise<EditPatch> {
  const bitmap = await loadBitmap(fullSrc);
  try {
    const canvas = new OffscreenCanvas(Math.round(rect.w), Math.round(rect.h));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('wpview: OffscreenCanvas 2D context not available');
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const blob = await canvasToBlob(canvas, { mimeType: inferMimeType(fullSrc), quality: JPEG_QUALITY });
    return { type: 'crop', rect, blob };
  } finally {
    bitmap.close();
  }
}

/**
 * Drag-to-draw výběr obdélníku nad zobrazeným obrázkem. Žádné táhnutí za
 * hrany existujícího výběru (resize handles) — v0 vždy kreslí nový obdélník
 * od nuly, což pokrývá crop use-case bez další interakční složitosti.
 */
export function CropCanvas({ fullSrc, onConfirm, onCancel }: CropCanvasProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [rect, setRect] = useState<NaturalRect | null>(null);
  const dragStart = useRef<Point | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    setRect({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const toNaturalPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const img = imgRef.current;
      if (!img || !natural) return null;
      const box = img.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return null;
      const scaleX = natural.width / box.width;
      const scaleY = natural.height / box.height;
      return {
        x: clamp((clientX - box.left) * scaleX, 0, natural.width),
        y: clamp((clientY - box.top) * scaleY, 0, natural.height),
      };
    },
    [natural],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const point = toNaturalPoint(e.clientX, e.clientY);
      if (!point) return;
      dragStart.current = point;
      e.currentTarget.setPointerCapture(e.pointerId);
      setRect({ x: point.x, y: point.y, w: 0, h: 0 });
    },
    [toNaturalPoint],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return;
      const point = toNaturalPoint(e.clientX, e.clientY);
      if (!point) return;
      const start = dragStart.current;
      setRect({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      });
    },
    [toNaturalPoint],
  );

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const canConfirm = !submitting && !!rect && rect.w >= 1 && rect.h >= 1;

  const handleConfirm = useCallback(async () => {
    if (!rect || rect.w < 1 || rect.h < 1) return;
    setSubmitting(true);
    try {
      const patch = await buildCropPatch(fullSrc, rect);
      onConfirm(patch);
    } finally {
      setSubmitting(false);
    }
  }, [fullSrc, rect, onConfirm]);

  return (
    <div className="wpview-crop-canvas">
      <div
        className="wpview-crop-canvas__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={fullSrc}
          alt=""
          onLoad={handleImgLoad}
          className="wpview-crop-canvas__image"
          draggable={false}
        />
        {rect && natural && natural.width > 0 && natural.height > 0 && (
          <div
            className="wpview-crop-canvas__rect"
            style={{
              left: `${(rect.x / natural.width) * 100}%`,
              top: `${(rect.y / natural.height) * 100}%`,
              width: `${(rect.w / natural.width) * 100}%`,
              height: `${(rect.h / natural.height) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="wpview-crop-canvas__controls">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="button" onClick={handleConfirm} disabled={!canConfirm}>
          Apply
        </button>
      </div>
    </div>
  );
}
