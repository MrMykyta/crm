import s from "./Switch.module.css";

/**
 * Двухпозиционный свич: allow / deny
 * props:
 *  - checked (bool): true = allow (зелёный), false = deny (красный)
 *  - onChange(nextBool)
 *  - size: 'md' | 'sm'
 *  - disabled, ariaLabel
 */
export default function Switch({
  checked = false,
  onChange,
  size = "md",
  disabled = false,
  ariaLabel,
  className = "",
}) {
  const handleClick = () => {
    if (!disabled) onChange?.(!checked);
  };

  const trackClass = [
    s.switch,
    s[size],
    checked ? s.allow : s.deny,
    disabled ? s.disabled : "",
    className,
  ].join(" ");

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      disabled={disabled}
      className={trackClass}
      onClick={handleClick}
    >
      <span className={`${s.knob} ${checked ? s.knobRight : s.knobLeft}`} />
    </button>
  );
}