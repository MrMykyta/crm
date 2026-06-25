import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import DetailActions from './DetailActions';
import DetailStatusChip from './DetailStatusChip';
import s from './DetailLayout.module.css';

function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className={s.breadcrumbs} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = item.to && !isLast
          ? <Link to={item.to}>{item.label}</Link>
          : <span>{item.label}</span>;
        return (
          <span key={`${item.label}-${index}`} className={s.breadcrumbItem}>
            {content}
            {!isLast ? <ChevronRight size={12} aria-hidden="true" /> : null}
          </span>
        );
      })}
    </nav>
  );
}

function SmartButtons({ items = [] }) {
  const visible = items.filter((item) => item && !item.hidden);
  if (!visible.length) return null;
  return (
    <div className={s.smartButtons}>
      {visible.map((item) => {
        const Tag = item.to ? 'a' : 'button';
        const props = item.to
          ? { href: item.to }
          : { type: 'button', onClick: item.onClick, disabled: item.disabled };
        return (
          <Tag
            {...props}
            key={item.key || item.label}
            className={s.smartButton}
            aria-disabled={item.disabled || undefined}
          >
            <strong>{item.count ?? item.value ?? '—'}</strong>
            <span>{item.label}</span>
          </Tag>
        );
      })}
    </div>
  );
}

export default function DetailHeader({
  breadcrumbs = [],
  title,
  subtitle,
  icon,
  status,
  priority,
  smartButtons = [],
  actions,
  primaryAction,
  actionItems,
  overflowActions,
  saveState,
  children,
}) {
  return (
    <header className={s.header}>
      <div className={s.headerMain}>
        <Breadcrumbs items={breadcrumbs} />
        <div className={s.titleRow}>
          {icon ? <span className={s.headerIcon}>{icon}</span> : null}
          <div className={s.titleBlock}>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className={s.headerBadges}>
            <DetailStatusChip status={status} />
            {priority ? (
              <DetailStatusChip
                status={priority}
                tone={priority.tone || 'warning'}
                label={priority.label || priority.value}
                size="sm"
              />
            ) : null}
          </div>
        </div>
        {children}
      </div>
      <div className={s.headerSide}>
        <SmartButtons items={smartButtons} />
        {actions || (
          <DetailActions
            saveState={saveState}
            primaryAction={primaryAction}
            actions={actionItems}
            overflowActions={overflowActions}
          />
        )}
      </div>
    </header>
  );
}
