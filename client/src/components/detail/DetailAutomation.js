import DetailCard from './DetailCard';
import s from './DetailLayout.module.css';

export default function DetailAutomation({
  rules = [],
  title = 'Automation',
  emptyText = 'No automation rules.',
  actions,
  renderRule,
}) {
  return (
    <DetailCard title={title} actions={actions}>
      {rules.length ? (
        <div className={s.automationList}>
          {rules.map((rule, index) => (
            <div key={rule.id || rule.key || index} className={s.automationItem}>
              {renderRule ? renderRule(rule) : (
                <>
                  <strong>{rule.title || rule.label}</strong>
                  {rule.description ? <span>{rule.description}</span> : null}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={s.emptyText}>{emptyText}</p>
      )}
    </DetailCard>
  );
}
