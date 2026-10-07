// Source of truth pro kontrakt wpview <-> consumer. Zrcadlo je CONTRACT.md —
// měň oba spolu.

export interface ViewerItem {
  id: string;
  /** default 'image'. U 'video' je `fullSrc` URL videa a `thumbSrc` je poster/náhled. */
  type?: 'image' | 'video';
  /** Název souboru vč. přípony (zobrazuje se v horní liště). Fallback: `meta.filename`, pak poslední segment URL `fullSrc`. */
  filename?: string;
  thumbSrc: string;
  fullSrc: string;
  width?: number;
  height?: number;
  /** EXIF / datum / místo — wpview to samo nezobrazuje, jen si to drží pro consumera. */
  meta?: Record<string, unknown>;
}

export interface ItemState {
  /** 0–5 */
  rating?: number;
  tags?: string[];
  favorite?: boolean;
}

/** Tag, který consumer nabízí k přiřazení (wpview vokabulář tagů jinak nezná). */
export interface TagOption {
  id: string;
  /** Zobrazený text; chybí => `id`. */
  label?: string;
}

export type SlideshowTransition = 'none' | 'fade' | 'slide' | 'zoom' | 'flip' | 'blur';

export interface Capabilities {
  rate?: boolean;
  favorite?: boolean;
  tag?: boolean;
  rotate?: boolean;
  crop?: boolean;
  delete?: boolean;
  info?: boolean;
  share?: boolean;
  present?: boolean;
}

export type EditPatch =
  | { type: 'rotate'; deg: 90 | 180 | 270; blob: Blob }
  | { type: 'crop'; rect: { x: number; y: number; w: number; h: number }; blob: Blob };

export interface Settings {
  /** default 4000 */
  slideshowMs: number;
  /** default 'fade' */
  slideshowTransition: SlideshowTransition;
  /** Po poslední položce okna začít znovu od první. default false */
  slideshowLoop: boolean;
  /** Náhodné pořadí (v rámci okna `items`). default false */
  slideshowShuffle: boolean;
  /** Co se ve slideshow přehrává. default 'all' */
  slideshowContent: 'all' | 'photos' | 'videos';
  /** Spustit slideshow hned po otevření (vyžaduje capability `present`). default false */
  autoplaySlideshow: boolean;
  /** Video se po otevření samo spustí. default false */
  autoplayVideo: boolean;
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
  /** Nabídka tagů pro tlačítko Tags v liště (capability `tag` + `onTagToggle`). */
  availableTags?: TagOption[];

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
  /** Fotka info — jednorázový klik, žádný toggle. wpview nic sám nezobrazuje. */
  onInfoOpen?(id: string): void;
  /** Sdílení fotky/videa — jednorázový klik. wpview nic nesdílí, dialog i odkaz řeší consumer. */
  onShare?(id: string): void;
  /** Pravý klik / long-press na fotce — wpview nekreslí žádné menu, jen záměr. */
  onContextMenu?(id: string, x: number, y: number): void;
  onRequestMore?(dir: 'prev' | 'next'): void;
  onClose?(): void;
}
