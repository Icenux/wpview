import { ACTIONS } from '../actions/registry';
import { IconButton } from './IconButton';
import { RatingStars } from './RatingStars';
import { TagChips } from './TagChips';

interface ToolbarProps {
  showRating: boolean;
  ratingValue: number;
  onRate?: ((value: number) => void) | undefined;

  showFavorite: boolean;
  isFavorite: boolean;
  onToggleFavorite?: (() => void) | undefined;

  showTags: boolean;
  tagIds: string[];
  onRemoveTag?: ((tagId: string) => void) | undefined;

  showRotate: boolean;
  onRotate?: (() => void) | undefined;

  showCrop: boolean;
  onCrop?: (() => void) | undefined;

  showDelete: boolean;
  onDelete?: (() => void) | undefined;

  showInfo: boolean;
  onInfoOpen?: (() => void) | undefined;

  showPresent: boolean;
  isPresenting: boolean;
  onTogglePresent?: (() => void) | undefined;

  onOpenSettings?: (() => void) | undefined;
}

/**
 * Dumb kompozice — každé tlačítko dostane už hotový (registrem prošlý)
 * callback shora. Toolbar sám nikdy nevolá `props.onX` z WpViewProps.
 */
export function Toolbar({
  showRating,
  ratingValue,
  onRate,
  showFavorite,
  isFavorite,
  onToggleFavorite,
  showTags,
  tagIds,
  onRemoveTag,
  showRotate,
  onRotate,
  showCrop,
  onCrop,
  showDelete,
  onDelete,
  showInfo,
  onInfoOpen,
  showPresent,
  isPresenting,
  onTogglePresent,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div className="wpview-toolbar">
      <div className="wpview-toolbar__group">
        {showRating && <RatingStars value={ratingValue} onChange={onRate} />}
        {showFavorite && (
          <IconButton
            label={ACTIONS.favorite.label}
            iconPath={ACTIONS.favorite.iconPath}
            active={isFavorite}
            onClick={() => onToggleFavorite?.()}
          />
        )}
        {showTags && <TagChips tagIds={tagIds} onRemove={onRemoveTag} />}
      </div>
      <div className="wpview-toolbar__group">
        {showRotate && (
          <IconButton
            label={ACTIONS.rotate.label}
            iconPath={ACTIONS.rotate.iconPath}
            onClick={() => onRotate?.()}
          />
        )}
        {showCrop && (
          <IconButton label={ACTIONS.crop.label} iconPath={ACTIONS.crop.iconPath} onClick={() => onCrop?.()} />
        )}
        {showPresent && (
          <IconButton
            label={ACTIONS.present.label}
            iconPath={ACTIONS.present.iconPath}
            active={isPresenting}
            onClick={() => onTogglePresent?.()}
          />
        )}
        {showInfo && (
          <IconButton
            label={ACTIONS.info.label}
            iconPath={ACTIONS.info.iconPath}
            onClick={() => onInfoOpen?.()}
          />
        )}
        {showDelete && (
          <IconButton
            label={ACTIONS.delete.label}
            iconPath={ACTIONS.delete.iconPath}
            onClick={() => onDelete?.()}
          />
        )}
        {onOpenSettings && (
          <button type="button" className="wpview-toolbar__settings" onClick={onOpenSettings} aria-label="Settings">
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
