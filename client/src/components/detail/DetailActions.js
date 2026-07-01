import { MoreHorizontal } from 'lucide-react';

import s from './DetailLayout.module.css';

function SaveState({ state }) {
  if (!state) return null;
  const { saving, dirty, error, label } = state;
  if (!saving && !dirty && !error && !label) return null;
  const text = label || (error ? error : saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved');
  return (
    <span className={[
      s.saveState,
      error ? s.saveStateError : '',
      saving ? s.saveStateSaving : '',
      dirty ? s.saveStateDirty : '',
    ].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className={s.saveStateDot} />
      {text}
    </span>
  );
}

function ActionButton({ action, variant = 'secondary' }) {
  if (!action || action.hidden) return null;
  const Tag = action.to ? 'a' : 'button';
  const props = action.to
    ? { href: action.to }
    : { type: 'button', onClick: action.onClick, disabled: action.disabled };

  return (
    <Tag
      {...props}
      className={[
        s.actionButton,
        variant === 'primary' ? s.actionPrimary : '',
        action.destructive ? s.actionDanger : '',
      ].filter(Boolean).join(' ')}
      aria-disabled={action.disabled || undefined}
      title={action.title || action.label}
    >
      {action.icon ? <span className={s.actionIcon}>{action.icon}</span> : null}
      <span>{action.label}</span>
    </Tag>
  );
}

export default function DetailActions({
  saveState,
  primaryAction,
  actions = [],
  overflowActions = [],
  children,
}) {
  const visibleActions = actions.filter((action) => action && !action.hidden);
  const visibleOverflow = overflowActions.filter((action) => action && !action.hidden);

  return (
    <div className={s.actionsBar}>
      <SaveState state={saveState} />
      {children}
      {visibleActions.map((action) => (
        <ActionButton key={action.key || action.label} action={action} />
      ))}
      {visibleOverflow.length ? (
        <details className={s.overflowActions}>
          <summary className={s.overflowTrigger} aria-label="More actions">
            <MoreHorizontal size={16} aria-hidden="true" />
          </summary>
          <div className={s.overflowMenu}>
            {visibleOverflow.map((action) => (
              <ActionButton key={action.key || action.label} action={action} />
            ))}
          </div>
        </details>
      ) : null}
      <ActionButton action={primaryAction} variant="primary" />
    </div>
  );
}
