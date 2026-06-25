import DetailCard from './DetailCard';
import DetailMeta from './DetailMeta';
import DetailSection from './DetailSection';
import DetailStatusChip from './DetailStatusChip';
import s from './DetailLayout.module.css';

function IdentityCard({ identity }) {
  if (!identity) return null;
  return (
    <DetailCard className={s.identityCard}>
      <div className={s.identityInner}>
        {identity.avatar ? <div className={s.identityAvatar}>{identity.avatar}</div> : null}
        <div className={s.identityText}>
          <strong>{identity.title}</strong>
          {identity.subtitle ? <span>{identity.subtitle}</span> : null}
        </div>
        <DetailStatusChip status={identity.status} size="sm" />
      </div>
    </DetailCard>
  );
}

export default function DetailSidebar({
  identity,
  sections = [],
  children,
}) {
  return (
    <aside className={s.sidebar}>
      <IdentityCard identity={identity} />
      {sections.map((section) => (
        <DetailSection
          key={section.key || section.title}
          title={section.title}
          subtitle={section.subtitle}
          collapsible={section.collapsible}
          defaultCollapsed={section.defaultCollapsed}
          actions={section.actions}
        >
          {section.children || <DetailMeta rows={section.fields || []} />}
        </DetailSection>
      ))}
      {children}
    </aside>
  );
}
