import type { Settings } from '../contract/types';

interface SettingsPanelProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <div className="wpview-settings-panel" role="dialog" aria-label="Settings">
      <button
        type="button"
        className="wpview-settings-panel__close"
        onClick={onClose}
        aria-label="Close settings"
      >
        ×
      </button>
      <label className="wpview-settings-panel__row">
        <span>Double-tap zoom</span>
        <input
          type="number"
          min={1}
          max={8}
          step={0.5}
          value={settings.doubleTapZoom}
          onChange={(e) => onChange({ ...settings, doubleTapZoom: Number(e.target.value) })}
        />
      </label>
      <label className="wpview-settings-panel__row">
        <span>Slideshow interval (seconds)</span>
        <input
          type="number"
          min={1}
          step={1}
          // Settings.slideshowMs stays milliseconds internally (Slideshow.tsx
          // feeds it straight into setInterval) — nobody types "4000" into a
          // form field on purpose, so the UI works in seconds and converts.
          value={settings.slideshowMs / 1000}
          onChange={(e) => onChange({ ...settings, slideshowMs: Math.max(1, Number(e.target.value)) * 1000 })}
        />
      </label>
      <label className="wpview-settings-panel__row">
        <span>Slideshow transition</span>
        <select
          value={settings.slideshowTransition}
          onChange={(e) =>
            onChange({ ...settings, slideshowTransition: e.target.value as Settings['slideshowTransition'] })
          }
        >
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
          <option value="none">None (cut)</option>
        </select>
      </label>
      <label className="wpview-settings-panel__row">
        <span>Theme</span>
        <select
          value={settings.theme}
          onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
