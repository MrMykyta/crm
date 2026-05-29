import { useMemo, useState } from 'react';
import ConfirmDialog from '../dialogs/ConfirmDialog';
import s from './OmsStatusActionsMenu.module.css';

export default function OmsStatusActionsMenu({
  actions = [],
  loadingKey = '',
  error = '',
  onAction,
}) {
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const visibleActions = useMemo(
    () => actions.filter((action) => Boolean(action?.enabled)),
    [actions]
  );

  const handleClick = (action) => {
    if (!action?.confirm) {
      onAction?.(action);
      return;
    }

    if (typeof ConfirmDialog === 'function') {
      setPendingConfirm(action);
      return;
    }

    const ok = window.confirm(action.confirm?.text || 'Confirm action?');
    if (ok) onAction?.(action);
  };

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    const next = pendingConfirm;
    setPendingConfirm(null);
    onAction?.(next);
  };

  if (!visibleActions.length) {
    return <p className={s.empty}>—</p>;
  }

  return (
    <>
      <div className={s.actionsWrap}>
        {visibleActions.map((action) => {
          const isActive = loadingKey === action.key;
          return (
            <button
              key={action.key}
              type="button"
              className={`${s.actionButton} ${action.destructive ? s.destructive : ''}`}
              onClick={() => handleClick(action)}
              disabled={Boolean(loadingKey)}
            >
              {isActive ? 'Processing...' : action.label}
            </button>
          );
        })}
      </div>

      {error ? <div className={s.error}>{error}</div> : null}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.confirm?.title || 'Confirm action'}
        text={pendingConfirm?.confirm?.text || 'Are you sure?'}
        onOk={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
        okText={pendingConfirm?.confirm?.okText || 'Confirm'}
        cancelText={pendingConfirm?.confirm?.cancelText || 'Cancel'}
      />
    </>
  );
}
