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

export async function loadBitmap(src: string): Promise<ImageBitmap> {
  const res = await fetch(src);
  const blob = await res.blob();
  return createImageBitmap(blob);
}
