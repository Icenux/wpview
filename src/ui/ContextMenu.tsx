import { useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  iconPath: string;
  onClick: () => void;
  active?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Dumb kompozice, stejně jako Toolbar — položky (label/ikona/handler) dostává
 * hotové shora, sám nikdy nevolá `props.onX` z WpViewProps.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    setPos({ left: Math.min(x, Math.max(8, maxLeft)), top: Math.min(y, Math.max(8, maxTop)) });
  }, [x, y]);

  useLayoutEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      className="wpview-context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`wpview-context-menu__item${item.active ? ' wpview-context-menu__item--active' : ''}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path d={item.iconPath} fill="currentColor" />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
