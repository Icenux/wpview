interface IconButtonProps {
  label: string;
  iconPath: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export function IconButton({ label, iconPath, onClick, active = false, disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`wpview-icon-button${active ? ' wpview-icon-button--active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d={iconPath} fill="currentColor" />
      </svg>
    </button>
  );
}
