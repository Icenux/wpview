import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../../src/state/useSettings';
import { DEFAULT_SETTINGS } from '../../src/contract/defaults';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uncontrolled persistence starts from defaults and writes to localStorage', () => {
    const { result } = renderHook(() => useSettings({}));
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);

    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, doubleTapZoom: 3 });
    });

    expect(result.current.settings.doubleTapZoom).toBe(3);
    expect(JSON.parse(localStorage.getItem('wpview:settings') ?? '{}').doubleTapZoom).toBe(3);
  });

  it('uncontrolled persistence loads from localStorage on mount', () => {
    localStorage.setItem('wpview:settings', JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'dark' }));
    const { result } = renderHook(() => useSettings({}));
    expect(result.current.settings.theme).toBe('dark');
  });

  it('controlled persistence never touches localStorage, calls onSettingsChange instead', () => {
    const onSettingsChange = vi.fn();
    const { result } = renderHook(() => useSettings({ settings: { doubleTapZoom: 3 }, onSettingsChange }));

    expect(result.current.settings.doubleTapZoom).toBe(3);

    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    });

    expect(onSettingsChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(localStorage.getItem('wpview:settings')).toBeNull();
  });

  it('open axis defaults to internal state when uncontrolled', () => {
    const { result } = renderHook(() => useSettings({}));
    expect(result.current.settingsOpen).toBe(false);
    act(() => {
      result.current.setSettingsOpen(true);
    });
    expect(result.current.settingsOpen).toBe(true);
  });

  it('open axis is controlled independently of the persistence axis', () => {
    const onSettingsOpenChange = vi.fn();
    const { result } = renderHook(() => useSettings({ settingsOpen: false, onSettingsOpenChange }));

    act(() => {
      result.current.setSettingsOpen(true);
    });

    expect(onSettingsOpenChange).toHaveBeenCalledWith(true);
    // Controlled axis: internal state never moves, consumer owns the truth.
    expect(result.current.settingsOpen).toBe(false);
  });
});
