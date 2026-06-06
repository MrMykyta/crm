import s from './EmptyState.module.css';

/**
 * EmptyState — neutral placeholder for "no data" situations.
 *
 * Use for: empty lists, empty tabs, no search results.
 * Don't use for: errors (use an error/alert), or loading (use LoadingState).
 *
 * Props:
 *  - icon: optional lucide icon component
 *  - title: main message
 *  - description: secondary explanation
 *  - action: optional node (e.g. a "Create" button)
 *  - size: 'sm'|'md'
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}) {
  return (
    <div className={`${s.empty} ${s[size]} ${className}`.trim()} role="status">
      {Icon ? (
        <div className={s.iconWrap}>
          <Icon className={s.icon} size={size === 'sm' ? 20 : 28} aria-hidden="true" />
        </div>
      ) : null}
      {title ? <div className={s.title}>{title}</div> : null}
      {description ? <div className={s.description}>{description}</div> : null}
      {action ? <div className={s.action}>{action}</div> : null}
    </div>
  );
}
