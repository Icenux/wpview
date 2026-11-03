import { describe, expect, it, vi } from 'vitest';
import {
  emitDelete,
  emitEdit,
  emitFavorite,
  emitInfoOpen,
  emitShare,
  emitRate,
  emitTagToggle,
  isActionEnabled,
} from '../../src/actions/registry';
import type { Capabilities } from '../../src/contract/types';

describe('isActionEnabled', () => {
  it('is false when capability is missing — undefined means false per CONTRACT.md', () => {
    expect(isActionEnabled('rate', undefined, { onRate: vi.fn() })).toBe(false);
  });

  it('is false when capability is explicitly false', () => {
    expect(isActionEnabled('rate', { rate: false }, { onRate: vi.fn() })).toBe(false);
  });

  it('is false when capability is true but the handler is missing', () => {
    expect(isActionEnabled('rate', { rate: true }, {})).toBe(false);
  });

  it('is true only when capability is true AND handler exists', () => {
    expect(isActionEnabled('rate', { rate: true }, { onRate: vi.fn() })).toBe(true);
  });

  it('present needs no handler — it is purely internal UI, gated by capability alone', () => {
    expect(isActionEnabled('present', { present: true }, {})).toBe(true);
    expect(isActionEnabled('present', undefined, {})).toBe(false);
  });
});

describe('emit* guards', () => {
  const caps: Capabilities = {
    rate: true,
    favorite: true,
    tag: true,
    rotate: true,
    crop: true,
    delete: true,
    info: true,
  };
  const blob = new Blob(['x']);

  it('emitRate forwards only when enabled', () => {
    const onRate = vi.fn();
    emitRate(caps, { onRate }, 'a', 4);
    expect(onRate).toHaveBeenCalledWith('a', 4);

    const onRateDisabled = vi.fn();
    emitRate({ rate: false }, { onRate: onRateDisabled }, 'a', 4);
    expect(onRateDisabled).not.toHaveBeenCalled();
  });

  it('emitFavorite forwards only when enabled', () => {
    const onFavorite = vi.fn();
    emitFavorite(caps, { onFavorite }, 'a', true);
    expect(onFavorite).toHaveBeenCalledWith('a', true);
  });

  it('emitTagToggle forwards only when enabled', () => {
    const onTagToggle = vi.fn();
    emitTagToggle(caps, { onTagToggle }, 'a', 'x');
    expect(onTagToggle).toHaveBeenCalledWith('a', 'x');
  });

  it('emitEdit gates rotate patches on the rotate capability specifically', () => {
    const onEdit = vi.fn();
    emitEdit({ rotate: true }, { onEdit }, 'a', { type: 'rotate', deg: 90, blob });
    expect(onEdit).toHaveBeenCalled();

    const onEditDisabled = vi.fn();
    emitEdit({ rotate: false, crop: true }, { onEdit: onEditDisabled }, 'a', {
      type: 'rotate',
      deg: 90,
      blob,
    });
    expect(onEditDisabled).not.toHaveBeenCalled();
  });

  it('emitEdit gates crop patches on the crop capability specifically', () => {
    const onEdit = vi.fn();
    emitEdit({ crop: true }, { onEdit }, 'a', { type: 'crop', rect: { x: 0, y: 0, w: 1, h: 1 }, blob });
    expect(onEdit).toHaveBeenCalled();

    const onEditDisabled = vi.fn();
    emitEdit({ crop: false, rotate: true }, { onEdit: onEditDisabled }, 'a', {
      type: 'crop',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      blob,
    });
    expect(onEditDisabled).not.toHaveBeenCalled();
  });

  it('emitDelete and emitInfoOpen forward only when enabled', () => {
    const onDelete = vi.fn();
    emitDelete(caps, { onDelete }, 'a');
    expect(onDelete).toHaveBeenCalledWith('a');

    const onInfoOpen = vi.fn();
    emitInfoOpen(caps, { onInfoOpen }, 'a');
    expect(onInfoOpen).toHaveBeenCalledWith('a');
  });

  it('emitShare forwards only with the share capability and a handler', () => {
    const onShare = vi.fn();
    emitShare({ ...caps, share: true }, { onShare }, 'a');
    expect(onShare).toHaveBeenCalledWith('a');

    emitShare({ ...caps, share: false }, { onShare }, 'b');
    emitShare({ ...caps, share: true }, {}, 'c');
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('a missing handler never throws — it is a silent no-op, same as a missing capability', () => {
    expect(() => emitRate(caps, {}, 'a', 3)).not.toThrow();
  });
});
