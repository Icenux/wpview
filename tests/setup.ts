import '@testing-library/jest-dom/vitest';

// jsdom neimplementuje Blob URLs — edit flow (rotate/crop) je potřebuje k optickému zobrazení.
URL.createObjectURL = () => 'blob:mock-url';
URL.revokeObjectURL = () => {};

// jsdom nemá vlastní PointerEvent (viz https://github.com/jsdom/jsdom/issues/2527) —
// gesture hooky (useSwipe/usePinchZoom) na něm stojí, testy je musí umět vytvořit.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error -- jsdom lacks a native PointerEvent constructor
  globalThis.PointerEvent = PointerEventPolyfill;
}

// jsdom neimplementuje Pointer Capture API — gesture hooky ho volají, testy by
// jinak padaly na "not implemented".
for (const method of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      value: method === 'hasPointerCapture' ? () => false : () => {},
      writable: true,
    });
  }
}
