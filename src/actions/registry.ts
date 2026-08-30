import type { Capabilities, EditPatch } from '../contract/types';
import type { ActionDef, ActionHandlers, ActionId } from './types';

export const ICON = {
  star: 'M12 2l2.9 6.9L22 9.3l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.9L2 9.3l7.1-.4L12 2z',
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.01 6.01 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  tag: 'M20.59 13.41L11 3.83A2 2 0 009.59 3H4a1 1 0 00-1 1v5.59a2 2 0 00.59 1.41l9.59 9.59a2 2 0 002.83 0l4.58-4.58a2 2 0 000-2.83zM7 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  rotateLeft:
    'M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z',
  rotateRight:
    'M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.6l-1.44-1.44c-.75.54-1.59.89-2.46 1.02zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z',
  crop: 'M6 2v4H2v2h4v10a2 2 0 002 2h10v4h2v-4h4v-2H8V8h10V2H6z',
  trash: 'M6 7h12l-1 13a2 2 0 01-2 2H9a2 2 0 01-2-2L6 7zM9 4h6l1 2H8l1-2z',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm.75 15h-1.5v-6h1.5v6zm0-8h-1.5V7h1.5v2z',
  play: 'M8 5v14l11-7z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
} as const;

export const ACTIONS: Record<ActionId, ActionDef> = {
  rate: { id: 'rate', label: 'Rate', iconPath: ICON.star, hasHandler: (h) => !!h.onRate },
  favorite: {
    id: 'favorite',
    label: 'Favorite',
    iconPath: ICON.heart,
    hasHandler: (h) => !!h.onFavorite,
  },
  tag: { id: 'tag', label: 'Tags', iconPath: ICON.tag, hasHandler: (h) => !!h.onTagToggle },
  // Reprezentuje capabilitu jako celek (obě tlačítka — Rotate left/right —
  // ji sdílejí, viz Toolbar.tsx). iconPath/label tady slouží jen jako
  // generický fallback, konkrétní tlačítka mají vlastní ICON.rotateLeft/Right.
  rotate: { id: 'rotate', label: 'Rotate', iconPath: ICON.rotateRight, hasHandler: (h) => !!h.onEdit },
  crop: { id: 'crop', label: 'Crop', iconPath: ICON.crop, hasHandler: (h) => !!h.onEdit },
  delete: { id: 'delete', label: 'Delete', iconPath: ICON.trash, hasHandler: (h) => !!h.onDelete },
  info: { id: 'info', label: 'Info', iconPath: ICON.info, hasHandler: (h) => !!h.onInfoOpen },
  present: { id: 'present', label: 'Slideshow', iconPath: ICON.play, hasHandler: () => true },
};

/**
 * Jediný choke-point pro capability gate. Chybějící capability (`!== true`,
 * viz CONTRACT.md „nevyplněné = false") NEBO chybějící handler => akce se
 * nezobrazí ani neemituje.
 */
export function isActionEnabled(
  id: ActionId,
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
): boolean {
  if (capabilities?.[id] !== true) return false;
  return ACTIONS[id].hasHandler(handlers);
}

export function emitRate(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
  value: number,
): void {
  if (!isActionEnabled('rate', capabilities, handlers)) return;
  handlers.onRate?.(id, value);
}

export function emitFavorite(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
  next: boolean,
): void {
  if (!isActionEnabled('favorite', capabilities, handlers)) return;
  handlers.onFavorite?.(id, next);
}

export function emitTagToggle(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
  tagId: string,
): void {
  if (!isActionEnabled('tag', capabilities, handlers)) return;
  handlers.onTagToggle?.(id, tagId);
}

export function emitEdit(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
  patch: EditPatch,
): void {
  const gate: ActionId = patch.type === 'rotate' ? 'rotate' : 'crop';
  if (!isActionEnabled(gate, capabilities, handlers)) return;
  handlers.onEdit?.(id, patch);
}

export function emitDelete(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
): void {
  if (!isActionEnabled('delete', capabilities, handlers)) return;
  handlers.onDelete?.(id);
}

export function emitInfoOpen(
  capabilities: Capabilities | undefined,
  handlers: ActionHandlers,
  id: string,
): void {
  if (!isActionEnabled('info', capabilities, handlers)) return;
  handlers.onInfoOpen?.(id);
}
