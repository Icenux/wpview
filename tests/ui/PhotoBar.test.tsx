import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoBar } from '../../src/ui/PhotoBar';
import type { ViewerItem } from '../../src/contract/types';

const makeItems = (n: number): ViewerItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, thumbSrc: `t${i}.jpg`, fullSrc: `f${i}.jpg` }) as ViewerItem);

function setScroll(el: HTMLElement, left: number, width: number, client: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: client });
  el.scrollLeft = left;
}

describe('PhotoBar', () => {
  it('renders every item of the window, not just a radius around the current one', () => {
    const { container } = render(<PhotoBar items={makeItems(60)} index={30} onSelect={() => {}} />);
    expect(container.querySelectorAll('.wpview-photobar__thumb')).toHaveLength(60);
  });

  it('asks for more when scrolled near the right edge, once per window size', () => {
    const onRequestMore = vi.fn();
    const { getByRole } = render(
      <PhotoBar items={makeItems(20)} index={5} onSelect={() => {}} onRequestMore={onRequestMore} />,
    );
    const list = getByRole('listbox');
    setScroll(list, 1000, 1500, 400);
    fireEvent.scroll(list);
    fireEvent.scroll(list);
    expect(onRequestMore).toHaveBeenCalledTimes(1);
    expect(onRequestMore).toHaveBeenCalledWith('next');
  });

  it('asks for earlier items near the left edge, unless hasMore.prev is false', () => {
    const onRequestMore = vi.fn();
    const items = makeItems(20);
    const { getByRole, rerender } = render(
      <PhotoBar items={items} index={5} onSelect={() => {}} onRequestMore={onRequestMore} hasMore={{ prev: false, next: false }} />,
    );
    const list = getByRole('listbox');
    setScroll(list, 50, 1500, 400);
    fireEvent.scroll(list);
    expect(onRequestMore).not.toHaveBeenCalled();
    rerender(<PhotoBar items={items} index={5} onSelect={() => {}} onRequestMore={onRequestMore} hasMore={{ prev: true, next: false }} />);
    fireEvent.scroll(list);
    expect(onRequestMore).toHaveBeenCalledWith('prev');
  });
});
