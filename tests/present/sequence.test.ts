import { describe, expect, it } from 'vitest';
import { nextSlideshowIndex } from '../../src/present/sequence';
import type { ViewerItem } from '../../src/contract/types';

const mk = (id: string, type?: 'video'): ViewerItem => ({ id, thumbSrc: id, fullSrc: id, ...(type ? { type } : {}) });
const items = [mk('p0'), mk('v1', 'video'), mk('p2'), mk('v3', 'video'), mk('p4')];
const base = { slideshowLoop: false, slideshowShuffle: false, slideshowContent: 'all' as const };

describe('nextSlideshowIndex', () => {
  it('goes sequentially and stops at the end', () => {
    expect(nextSlideshowIndex(items, 0, base, false)).toBe(1);
    expect(nextSlideshowIndex(items, 4, base, false)).toBeNull();
  });

  it('waits at the end of the window when more items can be loaded', () => {
    expect(nextSlideshowIndex(items, 4, base, true)).toBe('wait');
  });

  it('wraps to the first eligible item when looping', () => {
    expect(nextSlideshowIndex(items, 4, { ...base, slideshowLoop: true }, false)).toBe(0);
  });

  it('skips videos / photos according to slideshowContent', () => {
    expect(nextSlideshowIndex(items, 0, { ...base, slideshowContent: 'photos' }, false)).toBe(2);
    expect(nextSlideshowIndex(items, 0, { ...base, slideshowContent: 'videos' }, false)).toBe(1);
    expect(nextSlideshowIndex(items, 3, { ...base, slideshowContent: 'videos' }, false)).toBeNull();
  });

  it('shuffle picks a different eligible item', () => {
    const s = { ...base, slideshowShuffle: true, slideshowContent: 'photos' as const };
    expect(nextSlideshowIndex(items, 0, s, false, () => 0)).toBe(2);
    expect(nextSlideshowIndex(items, 0, s, false, () => 0.99)).toBe(4);
    expect(nextSlideshowIndex([mk('only')], 0, s, false)).toBeNull();
  });
});
