import { DOCUMENT_VIEW_MODE_OPTIONS } from './documentViewModes';
import styles from './DocumentViewModeSwitch.module.css';

export default function DocumentViewModeSwitch({
  value,
  onChange,
  disabled = false,
  disabledModes = [],
}) {
  const blockedModes = new Set(disabledModes);

  return (
    <div className={styles.switcher} role="tablist" aria-label="View mode">
      {DOCUMENT_VIEW_MODE_OPTIONS.map((option) => {
        const isActive = value === option.value;
        const isDisabled = disabled || blockedModes.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.button} ${isActive ? styles.buttonActive : ''}`}
            onClick={() => onChange?.(option.value)}
            disabled={isDisabled}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
