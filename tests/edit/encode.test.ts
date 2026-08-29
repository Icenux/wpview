import { describe, expect, it } from 'vitest';
import { inferMimeType } from '../../src/edit/encode';

describe('inferMimeType', () => {
  it('keeps jpeg as jpeg', () => {
    expect(inferMimeType('https://example.com/a/photo.jpg')).toBe('image/jpeg');
    expect(inferMimeType('photo.JPEG')).toBe('image/jpeg');
  });

  it('keeps webp as webp', () => {
    expect(inferMimeType('photo.webp')).toBe('image/webp');
  });

  it('keeps png as png', () => {
    expect(inferMimeType('photo.png')).toBe('image/png');
  });

  it('falls back to png for unknown/missing extensions, never downgrades to jpeg silently', () => {
    expect(inferMimeType('https://example.com/blob-endpoint')).toBe('image/png');
  });

  it('ignores query strings when inferring the extension', () => {
    expect(inferMimeType('https://example.com/photo.jpg?v=3')).toBe('image/jpeg');
  });
});
