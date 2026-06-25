import DetailCard from './DetailCard';
import { Link } from 'react-router-dom';
import s from './DetailLayout.module.css';

export default function DetailRelations({
  relations = [],
  title = 'Relations',
  emptyText = 'No related records.',
  renderRelation,
}) {
  return (
    <DetailCard title={title}>
      {relations.length ? (
        <div className={s.relationsList}>
          {relations.map((relation, index) => {
            const Tag = relation.to ? Link : 'button';
            const props = relation.to
              ? { to: relation.to }
              : { type: 'button', onClick: relation.onClick };
            return (
              <Tag
                {...props}
                key={relation.id || relation.key || index}
                className={s.relationItem}
              >
                {renderRelation ? renderRelation(relation) : (
                  <>
                    <strong>{relation.title || relation.label}</strong>
                    {relation.meta ? <span>{relation.meta}</span> : null}
                    {relation.count !== undefined ? <em>{relation.count}</em> : null}
                  </>
                )}
              </Tag>
            );
          })}
        </div>
      ) : (
        <p className={s.emptyText}>{emptyText}</p>
      )}
    </DetailCard>
  );
}
