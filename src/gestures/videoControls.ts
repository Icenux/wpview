/** Výška pásu u spodku <video>, kam prohlížeč kreslí nativní ovládání (play, posuvník, hlasitost). */
const CONTROLS_STRIP_PX = 64;

/**
 * Zasáhl `pointerdown` nativní ovládání videa? useSwipe chytá pointer
 * (setPointerCapture) na celé scéně, čímž by klik na play/posuvník nikdy
 * nedorazil k videu — v tomhle pásu se proto gesta vůbec nezačínají.
 * Ovládání je v shadow DOM, takže se pozná jen podle polohy.
 */
export function hitsVideoControls(e: PointerEvent): boolean {
  const target = e.target;
  if (!(target instanceof HTMLVideoElement) || !target.controls) return false;
  const rect = target.getBoundingClientRect();
  return e.clientY >= rect.bottom - CONTROLS_STRIP_PX;
}
