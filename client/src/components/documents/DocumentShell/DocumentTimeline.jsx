import { useTranslation } from 'react-i18next';

import EmptyState from '../../shared/EmptyState';
import { formatDate } from '../../../lib/format';
import s from './DocumentShell.module.css';

export default function DocumentTimeline({ events = [] }) {
  const { t, i18n } = useTranslation();
  const list = Array.isArray(events) ? events.filter(Boolean) : [];

  if (!list.length) {
    return <EmptyState size="sm" title={t('documents.timeline.empty')} />;
  }

  return (
    <ol className={s.timeline}>
      {list.map((event, index) => (
        <li key={event.id || `${event.action}-${event.timestamp}-${index}`} className={s.timelineItem}>
          <span className={s.timelineMarker} aria-hidden="true" />
          <div className={s.timelineBody}>
            <div className={s.timelineAction}>{event.action}</div>
            <div className={s.timelineMeta}>
              <span>{event.actorName || t('documents.timeline.systemActor')}</span>
              <span>{formatDate(event.timestamp, i18n.language)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
