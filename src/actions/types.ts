import type { Capabilities, WpViewProps } from '../contract/types';

/** Klíče Capabilities a ActionId jsou schválně identické — 1:1 mapování akce na gate. */
export type ActionId = keyof Capabilities;

export interface ActionHandlers {
  onRate?: WpViewProps['onRate'];
  onFavorite?: WpViewProps['onFavorite'];
  onTagToggle?: WpViewProps['onTagToggle'];
  onEdit?: WpViewProps['onEdit'];
  onDelete?: WpViewProps['onDelete'];
  onInfoOpen?: WpViewProps['onInfoOpen'];
  onShare?: WpViewProps['onShare'];
}

export interface ActionDef {
  id: ActionId;
  label: string;
  /** SVG path `d` pro 24x24 viewBox. */
  iconPath: string;
  /** `present` nemá handler — je to čistě interní UI (Slideshow), gate jen capability. */
  hasHandler(handlers: ActionHandlers): boolean;
}
