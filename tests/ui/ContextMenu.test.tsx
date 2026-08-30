import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '../../src/ui/ContextMenu';

const items = [
  { id: 'favorite', label: 'Favorite', iconPath: 'M0 0', onClick: vi.fn() },
  { id: 'delete', label: 'Delete', iconPath: 'M0 0', onClick: vi.fn(), active: false },
];

describe('ContextMenu', () => {
  it('renders nothing when there are no items', () => {
    const onClose = vi.fn();
    const { container } = render(<ContextMenu x={0} y={0} items={[]} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders every item and calls its onClick + onClose when clicked', () => {
    const onClose = vi.fn();
    const onClick = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ id: 'favorite', label: 'Favorite', iconPath: 'M0 0', onClick }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Favorite' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside the menu', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={items} onClose={onClose} />);

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking an item inside the menu', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={items} onClose={onClose} />);

    fireEvent.pointerDown(screen.getByRole('menu'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={items} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
