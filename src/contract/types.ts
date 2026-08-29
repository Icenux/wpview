// Source of truth pro kontrakt wpview <-> consumer. Zrcadlo je CONTRACT.md —
// měň oba spolu.

export interface ViewerItem {
  id: string;
  thumbSrc: string;
  fullSrc: string;
  width?: number;
  height?: number;
  /** EXIF / datum / místo — jen k zobrazení v InfoPanel. */
  meta?: Record<string, unknown>;
}

export interface ItemState {
  /** 0–5 */
  rating?: number;
  tags?: string[];
  favorite?: boolean;
}

export interface Capabilities {
  rate?: boolean;
  favorite?: boolean;
  tag?: boolean;
  rotate?: boolean;
  crop?: boolean;
  delete?: boolean;
  info?: boolean;
  present?: boolean;
}

export type EditPatch =
  | { type: 'rotate'; deg: 90 | 180 | 270; blob: Blob }
  | { type: 'crop'; rect: { x: number; y: number; w: number; h: number }; blob: Blob };

export interface Settings {
  /** default 4000 */
  slideshowMs: number;
  /** default 'fit' */
  zoomMode: 'fit' | 'actual';
  /** default 2 */
  doubleTapZoom: number;
  /** default 'system' */
  theme: 'dark' | 'light' | 'system';
}

export interface WpViewProps {
  /** OKNO položek, ne nutně celá galerie (viz windowing). */
  items: ViewerItem[];
  /** Controlled pozice; wpview ji nemění sám, jen navrhuje. */
  index: number;
  /** Aktuální pravda (rating/tags/favorite) z consumeru. */
  itemState: Record<string, ItemState>;
  /** Co se zobrazí; nevyplněné = false. */
  capabilities?: Capabilities;
  hasMore?: { prev: boolean; next: boolean };

  // Settings — dvě nezávislé osy, obě controlled/uncontrolled (viz CONTRACT.md sémantika).
  settings?: Partial<Settings>;
  onSettingsChange?(next: Settings): void;
  settingsOpen?: boolean;
  onSettingsOpenChange?(open: boolean): void;

  onIndexChange(index: number): void;
  onRate?(id: string, value: number): void;
  onFavorite?(id: string, next: boolean): void;
  onTagToggle?(id: string, tagId: string): void;
  onEdit?(id: string, patch: EditPatch): void;
  onDelete?(id: string): void;
  onInfoOpen?(id: string): void;
  onRequestMore?(dir: 'prev' | 'next'): void;
  onClose?(): void;
}
