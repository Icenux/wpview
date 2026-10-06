import { ACTIONS, ICON } from '../actions/registry';
import { IconButton } from './IconButton';
import { RatingStars } from './RatingStars';
import type { TagOption } from '../contract/types';
import { TagChips } from './TagChips';
import { TagPicker } from './TagPicker';

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
  onToggleTag?: ((tagId: string) => void) | undefined;
  tagOptions?: TagOption[] | undefined;

  showRotate: boolean;
  onRotateLeft?: (() => void) | undefined;
  onRotateRight?: (() => void) | undefined;

  showCrop: boolean;
  onCrop?: (() => void) | undefined;

  showDelete: boolean;
  onDelete?: (() => void) | undefined;

  showInfo: boolean;
  onInfoOpen?: (() => void) | undefined;

  showPresent: boolean;
  isPresenting: boolean;
  onTogglePresent?: (() => void) | undefined;

  photoBarOpen: boolean;
  onTogglePhotoBar?: (() => void) | undefined;

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
  onToggleTag,
  tagOptions = [],
  showRotate,
  onRotateLeft,
  onRotateRight,
  showCrop,
  onCrop,
  showDelete,
  onDelete,
  showInfo,
  onInfoOpen,
  showPresent,
  isPresenting,
  onTogglePresent,
  photoBarOpen,
  onTogglePhotoBar,
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
        {showTags && onToggleTag && (
          <TagPicker tagIds={tagIds} options={tagOptions} onToggle={onToggleTag} />
        )}
        {showTags && (
          <TagChips
            tagIds={tagIds}
            onRemove={onRemoveTag}
            labels={Object.fromEntries(tagOptions.filter((t) => t.label).map((t) => [t.id, t.label!]))}
          />
        )}
      </div>
      <div className="wpview-toolbar__group">
        {showRotate && (
          <IconButton label="Rotate left" iconPath={ICON.rotateLeft} onClick={() => onRotateLeft?.()} />
        )}
        {showRotate && (
          <IconButton label="Rotate right" iconPath={ICON.rotateRight} onClick={() => onRotateRight?.()} />
        )}
        {showCrop && (
          <IconButton label={ACTIONS.crop.label} iconPath={ACTIONS.crop.iconPath} onClick={() => onCrop?.()} />
        )}
        {onTogglePhotoBar && (
          <IconButton
            label="Photo bar"
            iconPath={ICON.photos}
            active={photoBarOpen}
            onClick={() => onTogglePhotoBar()}
          />
        )}
        {showPresent && (
          <IconButton
            label={ACTIONS.present.label}
            iconPath={isPresenting ? ICON.stop : ACTIONS.present.iconPath}
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
      </div>
    </div>
  );
}
