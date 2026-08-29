import { useEffect, useState } from 'react';

interface ImageLoaderProps {
  src: string;
  placeholderSrc?: string | undefined;
  alt: string;
  /** 'fit' = object-fit: contain, 'actual' = nativní rozměry (1:1 px). */
  fit: 'fit' | 'actual';
  /** Multiplikátor navrch fit/actual — drží ho usePinchZoom. */
  zoom: number;
}

/** Zobrazí `placeholderSrc` (thumbnail) dokud se nenačte `src` (fullSrc nebo edit blob). */
export function ImageLoader({ src, placeholderSrc, alt, fit, zoom }: ImageLoaderProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="wpview-image-loader">
      {placeholderSrc && !loaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className="wpview-image-loader__placeholder"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className="wpview-image-loader__full"
        style={{
          opacity: loaded ? 1 : 0,
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          objectFit: fit === 'fit' ? 'contain' : 'none',
        }}
      />
    </div>
  );
}
