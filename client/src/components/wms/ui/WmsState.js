import {
  AlertTriangle,
  Ban,
  Box,
  Loader2,
  PackageOpen,
  RefreshCcw,
} from 'lucide-react';
import s from './WmsUi.module.css';

function WmsStateFrame({
  tone = 'neutral',
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  role = 'status',
  className = '',
}) {
  const cls = [
    s.state,
    s[`state_${tone}`],
    compact ? s.stateCompact : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role={role}>
      {Icon ? (
        <span className={s.stateIcon} aria-hidden="true">
          <Icon size={compact ? 18 : 24} strokeWidth={2} />
        </span>
      ) : null}
      <div className={s.stateCopy}>
        {title ? <div className={s.stateTitle}>{title}</div> : null}
        {description ? <div className={s.stateDescription}>{description}</div> : null}
      </div>
      {action ? <div className={s.stateAction}>{action}</div> : null}
    </div>
  );
}

export function WmsLoadingState({
  title = 'Loading...',
  description,
  variant = 'skeleton',
  rows = 4,
  compact = false,
  className = '',
}) {
  if (variant === 'skeleton') {
    const count = Math.max(1, Number(rows) || 1);
    return (
      <div className={`${s.skeleton} ${compact ? s.skeletonCompact : ''} ${className}`.trim()} aria-busy="true" role="status">
        <span className={s.srOnly}>{title}</span>
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className={s.skeletonRow} />
        ))}
      </div>
    );
  }

  return (
    <WmsStateFrame
      tone="info"
      icon={Loader2}
      title={title}
      description={description}
      compact={compact}
      className={`${s.loadingSpin} ${className}`.trim()}
    />
  );
}

export function WmsEmptyState({
  title = 'No data',
  description,
  action,
  icon = PackageOpen,
  compact = false,
  className = '',
}) {
  return (
    <WmsStateFrame
      tone="neutral"
      icon={icon || Box}
      title={title}
      description={description}
      action={action}
      compact={compact}
      className={className}
    />
  );
}

export function WmsErrorState({
  title = 'Failed to load data',
  description,
  retryLabel = 'Retry',
  onRetry,
  compact = false,
  className = '',
}) {
  const action = onRetry ? (
    <button type="button" className={s.stateButton} onClick={onRetry}>
      <RefreshCcw size={14} aria-hidden="true" />
      <span>{retryLabel}</span>
    </button>
  ) : null;

  return (
    <WmsStateFrame
      tone="danger"
      icon={AlertTriangle}
      title={title}
      description={description}
      action={action}
      compact={compact}
      role="alert"
      className={className}
    />
  );
}

export function WmsForbiddenState({
  title = 'No permission',
  description = 'You do not have access to this WMS view.',
  compact = false,
  className = '',
}) {
  return (
    <WmsStateFrame
      tone="muted"
      icon={Ban}
      title={title}
      description={description}
      compact={compact}
      role="status"
      className={className}
    />
  );
}

export default WmsStateFrame;
