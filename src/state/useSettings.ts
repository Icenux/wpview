import { useCallback, useState } from 'react';
import type { Settings } from '../contract/types';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_PREFIX } from '../contract/defaults';

const STORAGE_KEY = `${SETTINGS_STORAGE_PREFIX}settings`;

function loadStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveStoredSettings(next: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Privátní režim / zakázaný localStorage — persistence je best-effort.
  }
}

interface UseSettingsProps {
  settings?: Partial<Settings> | undefined;
  onSettingsChange?: ((next: Settings) => void) | undefined;
  settingsOpen?: boolean | undefined;
  onSettingsOpenChange?: ((open: boolean) => void) | undefined;
}

/**
 * Dvě nezávislé controlled/uncontrolled osy — viz CONTRACT.md „Settings".
 * Persistence: `settings` + `onSettingsChange` dodané společně => controlled,
 * wpview se localStorage nedotkne. Otevírání panelu: `settingsOpen` +
 * `onSettingsOpenChange` dodané společně => controlled.
 */
export function useSettings({
  settings: controlledSettings,
  onSettingsChange,
  settingsOpen: controlledOpen,
  onSettingsOpenChange,
}: UseSettingsProps) {
  const isPersistenceControlled = controlledSettings !== undefined && onSettingsChange !== undefined;
  const [localSettings, setLocalSettings] = useState<Settings>(() =>
    isPersistenceControlled ? DEFAULT_SETTINGS : loadStoredSettings(),
  );

  const settings: Settings = isPersistenceControlled
    ? { ...DEFAULT_SETTINGS, ...controlledSettings }
    : localSettings;

  const setSettings = useCallback(
    (next: Settings) => {
      if (isPersistenceControlled) {
        onSettingsChange?.(next);
      } else {
        setLocalSettings(next);
        saveStoredSettings(next);
      }
    },
    [isPersistenceControlled, onSettingsChange],
  );

  const isOpenControlled = controlledOpen !== undefined && onSettingsOpenChange !== undefined;
  const [localOpen, setLocalOpen] = useState(false);
  const settingsOpen = isOpenControlled ? (controlledOpen ?? false) : localOpen;

  const setSettingsOpen = useCallback(
    (open: boolean) => {
      if (isOpenControlled) {
        onSettingsOpenChange?.(open);
      } else {
        setLocalOpen(open);
      }
    },
    [isOpenControlled, onSettingsOpenChange],
  );

  return { settings, setSettings, settingsOpen, setSettingsOpen };
}
