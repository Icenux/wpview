import { useEffect } from 'react';

interface UseKeyboardOptions {
  onNext?: () => void;
  onPrev?: () => void;
  onClose?: () => void;
  onRate?: (value: number) => void;
  onInfoToggle?: () => void;
  onFavoriteToggle?: () => void;
  disabled?: boolean;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Klávesové zkratky na window — wpview je typicky jediný fullscreen overlay,
 * když je otevřený, takže netrackuje focus na konkrétní element. Ignoruje
 * stisky uvnitř inputů/textarey (např. tag picker se search polem).
 */
export function useKeyboard({
  onNext,
  onPrev,
  onClose,
  onRate,
  onInfoToggle,
  onFavoriteToggle,
  disabled = false,
}: UseKeyboardOptions): void {
  useEffect(() => {
    if (disabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      switch (e.key) {
        case 'ArrowRight':
          onNext?.();
          break;
        case 'ArrowLeft':
          onPrev?.();
          break;
        case 'Escape':
          onClose?.();
          break;
        case 'i':
          onInfoToggle?.();
          break;
        case 'f':
          onFavoriteToggle?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          onRate?.(Number(e.key));
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNext, onPrev, onClose, onRate, onInfoToggle, onFavoriteToggle, disabled]);
}
