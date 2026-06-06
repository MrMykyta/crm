import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import PageHeader from '../../shared/PageHeader';
import StatusBadge from '../../shared/StatusBadge';
import ThemedSelect from '../../inputs/RadixSelect';
import DateTimePicker from '../../inputs/DateTimePicker';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import s from './DocumentEditor.module.css';

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
            {item?.to && !isLast
              ? <Link className={s.breadcrumbLink} to={item.to}>{label}</Link>
              : <span className={s.breadcrumbCurrent}>{label}</span>}
            {!isLast ? <span className={s.breadcrumbSeparator}>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

function HeaderActions({ actions, loadingKey = '' }) {
  const { t } = useTranslation();
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];
  if (!list.length) return null;

  const run = (action) => {
    action.onClick?.(action);
  };

  const handleClick = (action) => {
    if (action.confirm) {
      setPendingConfirm(action);
      return;
    }
    run(action);
  };

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(null);
    run(action);
  };

  return (
    <>
      <div className={s.headerActions}>
        {list.map((action) => {
          const variant = action.variant || 'secondary';
          const isLoading = action.loading || (loadingKey && loadingKey === action.key);
          return (
            <button
              key={action.key || action.label}
              type="button"
              className={`${s.actionButton} ${s[variant] || s.secondary}`}
              disabled={action.disabled || isLoading}
              onClick={() => handleClick(action)}
            >
              {isLoading ? (action.loadingLabel || action.label) : action.label}
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.confirm?.title || t('documents.shell.confirmTitle')}
        text={pendingConfirm?.confirm?.text || t('documents.shell.confirmText')}
        onOk={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
        okText={pendingConfirm?.confirm?.okText || t('documents.shell.confirmOk')}
        cancelText={pendingConfirm?.confirm?.cancelText || t('common.cancel')}
        danger={Boolean(pendingConfirm?.destructive)}
      />
    </>
  );
}

function Field({ field, readOnly = false }) {
  const {
    type = 'text',
    label,
    value,
    onChange,
    options = [],
    placeholder,
    required,
    error,
    colSpan = 1,
    withTime = false,
    locale,
    disabled,
  } = field;

  // View mode: render a static value (page passes display-ready strings).
  if (readOnly || field.readOnly) {
    const display = (value === undefined || value === null || value === '') ? '—' : value;
    return (
      <div className={`${s.field} ${colSpan >= 2 ? s.fieldFull : ''}`.trim()}>
        <span className={s.fieldLabel}>{label}</span>
        <div className={s.viewValue}>{display}</div>
      </div>
    );
  }

  let control = null;
  if (type === 'select') {
    control = (
      <ThemedSelect value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} />
    );
  } else if (type === 'date') {
    control = (
      <DateTimePicker value={value} onChange={onChange} withTime={withTime} locale={locale} />
    );
  } else if (type === 'textarea') {
    control = (
      <textarea
        className={s.textarea}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
      />
    );
  } else {
    control = (
      <input
        className={s.input}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className={`${s.field} ${colSpan >= 2 ? s.fieldFull : ''}`.trim()}>
      <label className={s.fieldLabel}>{label}{required ? ' *' : ''}</label>
      {control}
      {error ? <span className={s.fieldError}>{error}</span> : null}
    </div>
  );
}

/**
 * DocumentEditor — shared create/edit shell for commercial documents.
 * Layout shell only: the page owns form state and passes field descriptors,
 * summary rows, actions and the line-items editor (as children).
 *
 * Generic enough for offer/order today and future invoice / WMS document editors.
 */
export default function DocumentEditor({
  documentType,
  mode = 'edit',
  title,
  number,
  status,
  statusLabel,
  breadcrumbs = [],
  headerMeta = [],
  actions = [],
  actionLoadingKey = '',
  fields = [],
  fieldsTitle,
  summary = [],
  summaryTitle,
  error = '',
  children,
  className = '',
}) {
  const { t } = useTranslation();
  const isView = mode === 'view';
  const meta = Array.isArray(headerMeta) ? headerMeta.filter(Boolean) : [];
  const fieldList = Array.isArray(fields) ? fields.filter(Boolean) : [];
  const summaryRows = Array.isArray(summary) ? summary.filter(Boolean) : [];
  const headerTitle = title || number || '';

  return (
    <div className={`${s.page} ${className}`.trim()} data-document-type={documentType || undefined}>
      <PageHeader
        eyebrow={documentType}
        title={headerTitle}
        subtitle={number && title ? number : undefined}
        breadcrumbs={renderBreadcrumbs(breadcrumbs, t('documents.shell.breadcrumbsAria'))}
        status={status ? <StatusBadge status={status}>{statusLabel || status}</StatusBadge> : null}
        actions={<HeaderActions actions={actions} loadingKey={actionLoadingKey} />}
        className={s.header}
      />

      {error ? <div className={s.errorBanner}>{error}</div> : null}

      <div className={s.shell}>
        <section className={s.mainCard}>
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

          {fieldList.length ? (
            <div className={s.section}>
              {fieldsTitle ? <h2 className={s.sectionTitle}>{fieldsTitle}</h2> : null}
              <div className={s.grid}>
                {fieldList.map((field) => (
                  <Field key={field.name || field.label} field={field} readOnly={isView} />
                ))}
              </div>
            </div>
          ) : null}

          {children}
        </section>

        {summaryRows.length || summaryTitle ? (
          <aside className={s.summaryCard}>
            {summaryTitle ? <h2 className={s.summaryTitle}>{summaryTitle}</h2> : null}
            <div className={s.summaryRows}>
              {summaryRows.map((row) => (
                <div key={row.label} className={s.summaryRow}>
                  <span>{row.label}</span>
                  <span className={row.strong ? s.summaryValue : undefined}>{row.value}</span>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// DocumentEditor.State — full-bleed status card (loading / no permission / error / not found).
function DocumentEditorState({ title, text }) {
  return (
    <div className={s.page}>
      <section className={s.stateCard}>
        <h2 className={s.stateTitle}>{title}</h2>
        {text ? <p className={s.stateText}>{text}</p> : null}
      </section>
    </div>
  );
}

DocumentEditor.State = DocumentEditorState;
