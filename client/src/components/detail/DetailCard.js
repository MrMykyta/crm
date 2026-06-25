import s from './DetailLayout.module.css';

export default function DetailCard({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) {
  return (
    <section className={[s.card, className].filter(Boolean).join(' ')}>
      {(title || subtitle || actions) ? (
        <header className={s.cardHeader}>
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className={s.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className={s.cardBody}>{children}</div> : null}
    </section>
  );
}
