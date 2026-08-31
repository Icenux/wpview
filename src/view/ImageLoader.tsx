import { useLayoutEffect, useRef, useState } from 'react';

interface ImageLoaderProps {
  src: string;
  placeholderSrc?: string | undefined;
  alt: string;
  /** 'fit' = object-fit: contain, 'actual' = nativní rozměry (1:1 px). */
  fit: 'fit' | 'actual';
  /** Multiplikátor navrch fit/actual — drží ho usePinchZoom. */
  zoom: number;
  /** Živý posun z panování (usePinchZoom) — px, 0 mimo pan/mimo zoomed-in stav. */
  panX?: number;
  panY?: number;
}

/** Zobrazí `placeholderSrc` (thumbnail) dokud se nenačte `src` (fullSrc nebo edit blob). */
export function ImageLoader({ src, placeholderSrc, alt, fit, zoom, panX = 0, panY = 0 }: ImageLoaderProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // `usePreload` warmuje sousední fullSrc dopředu (swipe i slideshow), takže
  // prohlížeč obrázek často má už v okamžiku mountu. `.complete` je pro
  // cachovaný <img> pravda SYNCHRONNĚ hned po nastavení src — proto
  // useLayoutEffect (běží před paintem), ne useEffect. Bez týhle kontroly by
  // se placeholder/blur na každé přelistování probliskl i pro fotku, která
  // je dávno v cache, protože starý kód `loaded` vždycky nejdřív resetoval
  // na false a čekal na onLoad, i když už dávno odpálil.
  useLayoutEffect(() => {
    const img = imgRef.current;
    setLoaded(!!img && img.complete && img.naturalWidth > 0);
  }, [src]);

  return (
    <div className="wpview-image-loader">
      {placeholderSrc && !loaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="wpview-image-loader__placeholder"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className="wpview-image-loader__full"
        style={{
          opacity: loaded ? 1 : 0,
          // translate() OUTSIDE scale() — see usePinchZoom.ts's onPointerMove
          // comment: keeps a screen-pixel pan delta 1:1 regardless of zoom.
          transform:
            panX !== 0 || panY !== 0 || zoom !== 1
              ? `translate(${panX}px, ${panY}px) scale(${zoom})`
              : undefined,
          objectFit: fit === 'fit' ? 'contain' : 'none',
        }}
      />
    </div>
  );
}
