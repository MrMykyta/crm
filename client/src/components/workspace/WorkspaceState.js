import {
  AlertTriangle,
  Ban,
  Box,
  Loader2,
  PackageOpen,
  RefreshCcw,
} from 'lucide-react';
import s from './Workspace.module.css';

function WorkspaceStateFrame({
  tone = 'neutral',
  icon: Icon,
  title,
  description,
  action,
  role = 'status',
  className = '',
}) {
  return (
    <div className={[s.state, s[`state_${tone}`], className].filter(Boolean).join(' ')} role={role}>
      {Icon ? (
        <span className={s.stateIcon} aria-hidden="true">
          <Icon size={24} strokeWidth={2} />
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

export function WorkspaceLoadingState({
  title = 'Loading...',
  variant = 'skeleton',
  rows = 4,
  className = '',
}) {
  if (variant === 'skeleton') {
    const count = Math.max(1, Number(rows) || 1);
    return (
      <div className={`${s.skeleton} ${className}`.trim()} aria-busy="true" role="status">
        <span className={s.srOnly}>{title}</span>
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className={s.skeletonRow} />
        ))}
      </div>
    );
  }

  return (
    <WorkspaceStateFrame
      tone="info"
      icon={Loader2}
      title={title}
      className={className}
    />
  );
}

export function WorkspaceEmptyState({
  title = 'No data',
  description,
  action,
  icon = PackageOpen,
  className = '',
}) {
  return (
    <WorkspaceStateFrame
      tone="neutral"
      icon={icon || Box}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function WorkspaceErrorState({
  title = 'Failed to load data',
  description,
  retryLabel = 'Retry',
  onRetry,
  className = '',
}) {
  const action = onRetry ? (
    <button type="button" className={s.stateButton} onClick={onRetry}>
      <RefreshCcw size={14} aria-hidden="true" />
      <span>{retryLabel}</span>
    </button>
  ) : null;

  return (
    <WorkspaceStateFrame
      tone="danger"
      icon={AlertTriangle}
      title={title}
      description={description}
      action={action}
      role="alert"
      className={className}
    />
  );
}

export function WorkspaceForbiddenState({
  title = 'No permission',
  description,
  className = '',
}) {
  return (
    <WorkspaceStateFrame
      tone="muted"
      icon={Ban}
      title={title}
      description={description}
      className={className}
    />
  );
}

export default WorkspaceStateFrame;
