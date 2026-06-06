import s from './PageHeader.module.css';

/**
 * PageHeader — consistent page/record title row.
 *
 * Use for: top of list/detail/document pages — eyebrow + title + status + actions.
 * Don't use for: in-card section titles (use a plain heading) or modal titles.
 *
 * Props:
 *  - eyebrow: small label above the title (e.g. "Order")
 *  - title: main heading (string or node)
 *  - subtitle: secondary line under the title
 *  - status: node rendered next to the title (e.g. <StatusBadge />)
 *  - breadcrumbs: node rendered above the eyebrow
 *  - actions: node rendered on the right (buttons/menus)
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  status,
  breadcrumbs,
  actions,
  className = '',
}) {
  return (
    <header className={`${s.header} ${className}`.trim()}>
      {breadcrumbs ? <div className={s.breadcrumbs}>{breadcrumbs}</div> : null}
      <div className={s.row}>
        <div className={s.main}>
          {eyebrow ? <div className={s.eyebrow}>{eyebrow}</div> : null}
          <div className={s.titleRow}>
            {title ? <h1 className={s.title}>{title}</h1> : null}
            {status ? <span className={s.status}>{status}</span> : null}
          </div>
          {subtitle ? <div className={s.subtitle}>{subtitle}</div> : null}
        </div>
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
