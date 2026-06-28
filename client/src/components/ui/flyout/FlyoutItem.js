import { Link } from "react-router-dom";
import styles from "./HoverFlyout.module.css";

export default function FlyoutItem({
  children,
  to,
  onSelect,
  active = false,
  disabled = false,
  disabledReason = "",
  title,
}) {
  const className = [
    styles.flyoutItem,
    active ? styles.flyoutItemActive : "",
    disabled ? styles.flyoutItemDisabled : "",
  ].filter(Boolean).join(" ");

  if (disabled) {
    return (
      <span
        className={className}
        title={disabledReason || title || (typeof children === "string" ? children : undefined)}
        role="menuitem"
        aria-disabled="true"
      >
        <span>{children}</span>
        {disabledReason ? <small>{disabledReason}</small> : null}
      </span>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        className={className}
        onClick={() => onSelect?.()}
        role="menuitem"
      >
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect?.()}
      role="menuitem"
    >
      <span>{children}</span>
    </button>
  );
}
