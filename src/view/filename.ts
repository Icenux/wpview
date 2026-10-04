import type { ViewerItem } from '../contract/types';

/** Název souboru vč. přípony: `item.filename` → `meta.filename` → poslední segment URL (bez dotazu/hash). */
export function getFilename(item: ViewerItem): string {
  if (item.filename) return item.filename;
  const fromMeta = item.meta?.['filename'];
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
  if (item.fullSrc.startsWith('data:') || item.fullSrc.startsWith('blob:')) return '';
  const last = item.fullSrc.split(/[?#]/)[0]!.split('/').pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
