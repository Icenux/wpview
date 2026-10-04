import { describe, expect, it } from 'vitest';
import { getFilename } from '../../src/view/filename';

const base = { id: 'x', thumbSrc: 't' };

describe('getFilename', () => {
  it('prefers item.filename, then meta.filename, then the URL tail', () => {
    expect(getFilename({ ...base, fullSrc: 'https://e.com/u.jpg', filename: 'a.png', meta: { filename: 'm.jpg' } })).toBe('a.png');
    expect(getFilename({ ...base, fullSrc: 'https://e.com/u.jpg', meta: { filename: 'm.jpg' } })).toBe('m.jpg');
    expect(getFilename({ ...base, fullSrc: 'https://e.com/d/my%20pic.JPG?v=1#x' })).toBe('my pic.JPG');
    expect(getFilename({ ...base, fullSrc: 'data:image/jpeg;base64,AA' })).toBe('');
  });
});
