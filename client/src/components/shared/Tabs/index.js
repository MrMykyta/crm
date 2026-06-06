import s from './Tabs.module.css';

/**
 * Tabs — lightweight controlled section switcher for a single record/page.
 *
 * Use for: switching sections of one entity (Items / Summary / Relations / Actions).
 * Don't use for: navigating between pages (use links/router), or reorderable tab sets
 *   with drag-and-drop persistence (use layout/TabBar).
 *
 * Props:
 *  - items: [{ key, label, icon?, count?, disabled? }]
 *  - activeKey: currently selected key
 *  - onChange: (key) => void
 *  - size: 'sm'|'md'
 *  - variant: 'underline'|'pill'
 */
export default function Tabs({
  items = [],
  activeKey,
  onChange,
  size = 'md',
  variant = 'underline',
  className = '',
  ariaLabel,
}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const cls = [s.tabs, s[variant], s[size], className].filter(Boolean).join(' ');

  return (
    <div className={cls} role="tablist" aria-label={ariaLabel}>
      {list.map((item) => {
        const isActive = item.key === activeKey;
        const Icon = item.icon || null;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            className={`${s.tab} ${isActive ? s.active : ''}`}
            onClick={() => !item.disabled && onChange?.(item.key)}
          >
            {Icon ? <Icon className={s.icon} size={16} aria-hidden="true" /> : null}
            <span className={s.label}>{item.label}</span>
            {item.count != null ? <span className={s.count}>{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
