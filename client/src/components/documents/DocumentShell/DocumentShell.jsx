import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../../dialogs/ConfirmDialog';
import PageHeader from '../../shared/PageHeader';
import StatusBadge from '../../shared/StatusBadge';
import Tabs from '../../shared/Tabs';
import DocumentRelations from './DocumentRelations';
import DocumentTimeline from './DocumentTimeline';
import s from './DocumentShell.module.css';

function renderBreadcrumbs(items, ariaLabel) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <nav className={s.breadcrumbs} aria-label={ariaLabel}>
      {list.map((item, index) => {
        const isLast = index === list.length - 1;
        const label = item?.label || item?.to || '';
        return (
          <span key={`${label}-${index}`} className={s.breadcrumbItem}>
            {item?.to && !isLast ? (
              <Link className={s.breadcrumbLink} to={item.to}>{label}</Link>
            ) : (
              <span className={s.breadcrumbCurrent}>{label}</span>
            )}
            {!isLast ? <span className={s.breadcrumbSeparator}>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

function ActionButton({ action, loadingKey, onClick }) {
  const isLoading = loadingKey && loadingKey === action.key;
  const variant = action.variant || (action.destructive ? 'danger' : 'secondary');
  return (
    <button
      type="button"
      className={`${s.actionButton} ${s[variant] || s.secondary}`}
      disabled={action.disabled || isLoading}
      onClick={onClick}
    >
      {isLoading ? action.loadingLabel || action.label : action.label}
    </button>
  );
}

function HeaderActions({ actions, loadingKey, onAction, actionError }) {
  const { t } = useTranslation();
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];

  if (!list.length) return actions || null;

  const handleAction = (action) => {
    if (action.confirm) {
      setPendingConfirm(action);
      return;
    }
    action.onClick?.(action);
    onAction?.(action);
  };

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(null);
    action.onClick?.(action);
    onAction?.(action);
  };

  return (
    <>
      <div className={s.headerActions}>
        {list.map((action) => (
          <ActionButton
            key={action.key || action.label}
            action={action}
            loadingKey={loadingKey}
            onClick={() => handleAction(action)}
          />
        ))}
      </div>
      {actionError ? <div className={s.actionError}>{actionError}</div> : null}
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

export default function DocumentShell({
  type,
  number,
  status,
  statusLabel,
  title,
  subtitle,
  breadcrumbs = [],
  headerMeta = [],
  actions = [],
  actionLoadingKey = '',
  actionError = '',
  onAction,
  tabs = [],
  activeTab,
  onTabChange,
  relations = [],
  timelineEvents = [],
  children,
  className = '',
}) {
  const { t } = useTranslation();
  const meta = Array.isArray(headerMeta) ? headerMeta.filter(Boolean) : [];
  const documentNumber = number || t('documents.shell.unknownNumber');
  const headerTitle = title ? `${title} ${documentNumber}` : documentNumber;

  let body = children;
  if (!body && activeTab === 'relations') {
    body = <DocumentRelations relations={relations} />;
  }
  if (!body && activeTab === 'history') {
    body = <DocumentTimeline events={timelineEvents} />;
  }

  return (
    <div className={`${s.shell} ${className}`.trim()} data-document-type={type || undefined}>
      <PageHeader
        eyebrow={type}
        title={headerTitle}
        subtitle={subtitle}
        breadcrumbs={renderBreadcrumbs(breadcrumbs, t('documents.shell.breadcrumbsAria'))}
        status={status ? <StatusBadge status={status}>{statusLabel || status}</StatusBadge> : null}
        actions={(
          <HeaderActions
            actions={actions}
            loadingKey={actionLoadingKey}
            actionError={actionError}
            onAction={onAction}
          />
        )}
        className={s.header}
      />

      {meta.length ? (
        <dl className={s.metaGrid}>
          {meta.map((item) => (
            <div key={item.key || item.label} className={s.metaItem}>
              <dt className={s.metaLabel}>{item.label}</dt>
              <dd className={s.metaValue}>{item.value || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {tabs.length ? (
        <Tabs
          items={tabs}
          activeKey={activeTab}
          onChange={onTabChange}
          ariaLabel={t('documents.shell.tabsAria')}
          className={s.tabs}
        />
      ) : null}

      <div className={s.content}>
        {body}
      </div>
    </div>
  );
}
