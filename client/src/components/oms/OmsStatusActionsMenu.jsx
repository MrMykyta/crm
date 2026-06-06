import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../dialogs/ConfirmDialog';
import s from './OmsStatusActionsMenu.module.css';

export default function OmsStatusActionsMenu({
  actions = [],
  loadingKey = '',
  error = '',
  errorLink = null,
  onAction,
}) {
  const { t } = useTranslation();
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

    const ok = window.confirm(action.confirm?.text || t('documents.shell.confirmText'));
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
              {isActive ? (action.loadingLabel || t('common.loading')) : action.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className={s.error}>
          {error}
          {errorLink?.to ? (
            <>
              {' '}
              <Link to={errorLink.to}>{errorLink.label || errorLink.to}</Link>
            </>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.confirm?.title || t('documents.shell.confirmTitle')}
        text={pendingConfirm?.confirm?.text || t('documents.shell.confirmText')}
        onOk={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
        okText={pendingConfirm?.confirm?.okText || t('documents.shell.confirmOk')}
        cancelText={pendingConfirm?.confirm?.cancelText || t('common.cancel')}
      />
    </>
  );
}
