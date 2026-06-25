import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import DetailCard from './DetailCard';
import s from './DetailLayout.module.css';

export default function DetailSection({
  title,
  subtitle,
  collapsible = false,
  defaultCollapsed = false,
  actions,
  children,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!collapsible) {
    return (
      <DetailCard title={title} subtitle={subtitle} actions={actions} className={s.sectionCard}>
        {children}
      </DetailCard>
    );
  }

  return (
    <section className={[s.card, s.sectionCard].join(' ')}>
      <button
        type="button"
        className={s.sectionToggle}
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        <span>
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={collapsed ? s.chevronCollapsed : ''}
        />
      </button>
      {!collapsed ? <div className={s.cardBody}>{children}</div> : null}
    </section>
  );
}
