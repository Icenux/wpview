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
        <span>Zoom mode</span>
        <select
          value={settings.zoomMode}
          onChange={(e) => onChange({ ...settings, zoomMode: e.target.value as Settings['zoomMode'] })}
        >
          <option value="fit">Fit</option>
          <option value="actual">Actual size</option>
        </select>
      </label>
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
        <span>Slideshow interval (ms)</span>
        <input
          type="number"
          min={500}
          step={500}
          value={settings.slideshowMs}
          onChange={(e) => onChange({ ...settings, slideshowMs: Number(e.target.value) })}
        />
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
