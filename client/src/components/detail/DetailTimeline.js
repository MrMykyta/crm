import DetailCard from './DetailCard';
import s from './DetailLayout.module.css';

export default function DetailTimeline({
  items = [],
  title = 'Timeline',
  emptyText = 'No activity yet.',
  renderItem,
}) {
  return (
    <DetailCard title={title}>
      {items.length ? (
        <ol className={s.timeline}>
          {items.map((item, index) => (
            <li key={item.id || item.key || index} className={s.timelineItem}>
              <span aria-hidden="true" className={s.timelineMarker} />
              {renderItem ? renderItem(item) : (
                <div>
                  <strong>{item.title || item.label}</strong>
                  {item.description ? <p>{item.description}</p> : null}
                  {item.time || item.date ? <time>{item.time || item.date}</time> : null}
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className={s.emptyText}>{emptyText}</p>
      )}
    </DetailCard>
  );
}
