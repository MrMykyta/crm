import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import EmptyState from '../../shared/EmptyState';
import StatusBadge from '../../shared/StatusBadge';
import s from './DocumentShell.module.css';

export default function DocumentRelations({ relations = [] }) {
  const { t } = useTranslation();
  const list = Array.isArray(relations) ? relations.filter(Boolean) : [];

  if (!list.length) {
    return <EmptyState size="sm" title={t('documents.relations.empty')} />;
  }

  return (
    <div className={s.relationsList}>
      {list.map((relation) => {
        const label = relation.number || relation.id || '—';
        const body = (
          <>
            <span className={s.relationType}>{relation.type || t('documents.relations.document')}</span>
            <span className={s.relationNumber}>{label}</span>
            {relation.status ? (
              <StatusBadge size="sm" status={relation.status}>
                {relation.statusLabel || relation.status}
              </StatusBadge>
            ) : null}
          </>
        );

        return relation.to ? (
          <Link key={`${relation.type || 'document'}-${label}`} className={s.relationCard} to={relation.to}>
            {body}
          </Link>
        ) : (
          <div key={`${relation.type || 'document'}-${label}`} className={s.relationCard}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
