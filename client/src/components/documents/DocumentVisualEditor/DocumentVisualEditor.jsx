import { useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../../dialogs/ConfirmDialog';
import StatusBadge from '../../shared/StatusBadge';
import DocumentViewModeSwitch from '../DocumentViewModeSwitch';
// Reuse the EXISTING document visual layer — no new styles are introduced.
import pageStyles from '../../../pages/documents/DocumentEditorPage.module.css';
import formStyles from '../DocumentForm.module.css';
import itemStyles from '../DocumentItemsTable.module.css';

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * DocumentVisualEditor — presentational, data-agnostic read-only document surface.
 *
 * Renders the SAME visual language as /main/documents/:id (DocumentDetailsPage /
 * DocumentForm): page header chrome + left workspace (params + items) + right
 * summary panel. It reuses the existing CSS modules verbatim, so OMS documents are
 * visually indistinguishable from the documents module.
 *
 * It owns no data and performs no mutations — feed it a normalized model via adapters.
 */
export default function DocumentVisualEditor({
  back,                 // { label, onClick }
  breadcrumb,           // string
  mode = 'preview',     // 'preview' | 'edit' — drives field/items editability
  typeLabel,
  statusLabel,
  title,
  subtitle,
  facts = [],           // [{ label, value, muted }]
  lockedNote,           // { label, text } shown when a document is locked
  itemsSlot,            // editable items node (e.g. <LineItemsEditor/>) used in edit mode
  // Document action cluster (mirrors /main/documents/:id)
  showViewModeToggle = false,
  viewMode = 'preview',
  onViewModeChange,
  viewModeDisabledModes = [],
  showPrintButton = false,
  onPrint,
  printLabel,
  showSaveButton = false,
  onSave,
  saveLabel,
  saveDisabled = false,
  saveLoading = false,
  actions = [],         // [{ key, label, variant, onClick, disabled, loading, confirm, destructive }]
  actionLoadingKey = '',
  actionError = '',
  paramsTitle,
  paramsHint,
  primaryFields = [],   // [{ label, value }]
  secondaryFields = [], // [{ label, value }]
  items = [],           // [{ key, name, lineTypeLabel, lineTypeTone, affectsStock, qty, unit, priceNet, vatRate, sumNet, sumVat, sumGross }]
  itemsTitle,
  itemsSubtitle,
  emptyItemsLabel,
  summaryTitle,
  summaryHint,
  summaryStatusLabel,
  number,
  totals = {},          // { netLabel, vatLabel, grossLabel, net, vat, gross }
  sections = [],        // [{ key, title, hint, content }]
}) {
  const { t } = useTranslation();
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const runAction = (action) => action?.onClick?.(action);
  const handleActionClick = (action) => {
    if (action.confirm) { setPendingConfirm(action); return; }
    runAction(action);
  };
  const handleConfirm = () => {
    const action = pendingConfirm;
    setPendingConfirm(null);
    runAction(action);
  };

  const renderControl = (field) => {
    const onChange = (event) => field.onChange?.(event.target.value);
    if (field.type === 'select') {
      return (
        <select className={formStyles.sideFieldControl} value={field.value ?? ''} onChange={onChange}>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    if (field.type === 'textarea') {
      return (
        <textarea
          className={formStyles.sideFieldControl}
          style={{ minHeight: 76, height: 'auto', paddingTop: 6, paddingBottom: 6, resize: 'vertical' }}
          value={field.value ?? ''}
          onChange={onChange}
        />
      );
    }
    return (
      <input
        className={formStyles.sideFieldControl}
        type={field.type === 'date' ? 'date' : 'text'}
        value={field.value ?? ''}
        onChange={onChange}
      />
    );
  };

  const renderField = (field) => {
    const editable = mode === 'edit' && typeof field.onChange === 'function';
    if (editable) {
      return (
        <label key={field.label} className={formStyles.sideField}>
          <span className={formStyles.sideFieldLabel}>{field.label}</span>
          {renderControl(field)}
        </label>
      );
    }
    return (
      <div key={field.label} className={formStyles.documentAnchor}>
        <p className={formStyles.anchorLabel}>{field.label}</p>
        <p className={formStyles.anchorValue} style={{ whiteSpace: 'pre-wrap' }}>{field.value || '—'}</p>
      </div>
    );
  };

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.pageHeader}>
        <div className={pageStyles.headerMain}>
          {back ? (
            <button type="button" className={pageStyles.backButton} onClick={back.onClick}>
              <ArrowLeft size={16} />
              {back.label}
            </button>
          ) : null}
          {breadcrumb ? <p className={pageStyles.breadcrumb}>{breadcrumb}</p> : null}
          <div className={pageStyles.headerMeta}>
            {typeLabel ? <span className={pageStyles.headerTypeBadge}>{typeLabel}</span> : null}
            {statusLabel ? <span className={pageStyles.headerStatusBadge}>{statusLabel}</span> : null}
          </div>
          {title ? <h1 className={pageStyles.title}>{title}</h1> : null}
          {subtitle ? <p className={pageStyles.subtitle}>{subtitle}</p> : null}
          {facts.length ? (
            <div className={pageStyles.headerFacts}>
              {facts.map((fact) => (
                <span
                  key={fact.label}
                  className={`${pageStyles.factChip} ${fact.muted ? pageStyles.factChipMuted : ''}`.trim()}
                >
                  {fact.label}: {fact.value || '—'}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {(showViewModeToggle || showPrintButton || showSaveButton || actions.length || actionError) ? (
          <div className={pageStyles.actions}>
            {showViewModeToggle ? (
              <DocumentViewModeSwitch
                value={viewMode}
                onChange={onViewModeChange}
                disabledModes={viewModeDisabledModes}
              />
            ) : null}

            {showPrintButton ? (
              <button type="button" className={pageStyles.printButton} onClick={onPrint}>
                <Printer size={14} />
                {printLabel || t('oms.actions.print')}
              </button>
            ) : null}

            {actions.map((action) => {
              const isLoading = action.loading || (actionLoadingKey && actionLoadingKey === action.key);
              const cls = action.variant === 'primary' ? pageStyles.saveButton : pageStyles.printButton;
              return (
                <button
                  key={action.key || action.label}
                  type="button"
                  className={cls}
                  disabled={action.disabled || isLoading}
                  onClick={() => handleActionClick(action)}
                >
                  {isLoading ? (action.loadingLabel || action.label) : action.label}
                </button>
              );
            })}

            {showSaveButton ? (
              <button
                type="button"
                className={pageStyles.saveButton}
                onClick={onSave}
                disabled={saveDisabled || saveLoading}
              >
                {saveLoading ? t('common.saving') : (saveLabel || t('common.save'))}
              </button>
            ) : null}

            {actionError ? <p className={pageStyles.convertError}>{actionError}</p> : null}
          </div>
        ) : null}
      </header>

      <div className={formStyles.layout}>
        <div className={formStyles.workspace}>
          {lockedNote ? (
            <section className={formStyles.infoStrip}>
              <div className={`${formStyles.infoBadge} ${formStyles.helperNeutral}`}>
                <span className={formStyles.infoBadgeLabel}>{lockedNote.label}</span>
                <span className={formStyles.infoBadgeValue}>{lockedNote.text}</span>
              </div>
            </section>
          ) : null}

          <section className={formStyles.commandBar}>
            <div className={formStyles.commandHeader}>
              <h2 className={formStyles.commandTitle}>{paramsTitle}</h2>
              {paramsHint ? <p className={formStyles.commandHint}>{paramsHint}</p> : null}
            </div>
            <div className={formStyles.commandGrid}>
              <div className={formStyles.commandPrimary}>{primaryFields.map(renderField)}</div>
              <div className={formStyles.commandSecondary}>{secondaryFields.map(renderField)}</div>
            </div>
          </section>

          <section className={formStyles.itemsSection}>
            {itemsSlot ? itemsSlot : (
            <div className={itemStyles.tableZone}>
              <div className={itemStyles.header}>
                <div>
                  <h3 className={itemStyles.title}>{itemsTitle}</h3>
                  {itemsSubtitle ? <p className={itemStyles.subtitle}>{itemsSubtitle}</p> : null}
                </div>
              </div>

              <div className={itemStyles.scroll}>
                <table className={itemStyles.table}>
                  <thead>
                    <tr>
                      <th className={itemStyles.colName}>{t('documents.lines.name')}</th>
                      <th className={itemStyles.colQuantity}>{t('documents.lines.qty')}</th>
                      <th className={itemStyles.colUnit}>{t('oms.itemsTable.unit', 'Ед.')}</th>
                      <th className={itemStyles.colPrice}>{t('documents.lines.priceNet')}</th>
                      <th className={itemStyles.colVat}>{t('documents.lines.taxRate')}</th>
                      <th className={itemStyles.numeric}>{t('oms.summaryLabels.net')}</th>
                      <th className={itemStyles.numeric}>{t('oms.summaryLabels.vat')}</th>
                      <th className={itemStyles.numeric}>{t('oms.summaryLabels.gross')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className={itemStyles.row}>
                        <td>
                          <div>{item.name || '—'}</div>
                          {(item.lineTypeLabel || item.affectsStock) ? (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              {item.lineTypeLabel ? (
                                <StatusBadge tone={item.lineTypeTone || 'neutral'} size="sm">{item.lineTypeLabel}</StatusBadge>
                              ) : null}
                              {item.affectsStock ? (
                                <StatusBadge tone="success" size="sm">{t('documents.lines.affectsStock')}</StatusBadge>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className={itemStyles.numeric}>{item.qty}</td>
                        <td>{item.unit || '—'}</td>
                        <td className={itemStyles.numeric}>{formatAmount(item.priceNet)}</td>
                        <td className={itemStyles.numeric}>{formatAmount(item.vatRate)}</td>
                        <td className={`${itemStyles.amount} ${itemStyles.numeric}`}>{formatAmount(item.sumNet)}</td>
                        <td className={`${itemStyles.amount} ${itemStyles.numeric}`}>{formatAmount(item.sumVat)}</td>
                        <td className={`${itemStyles.amount} ${itemStyles.numeric} ${itemStyles.amountStrong}`}>{formatAmount(item.sumGross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!items.length ? (
                <p className={formStyles.sectionHint} style={{ padding: '8px 2px' }}>{emptyItemsLabel}</p>
              ) : null}
            </div>
            )}
          </section>

          {sections.map((section) => (
            <section key={section.key} className={formStyles.contextSection}>
              <div className={formStyles.sectionHeader}>
                <h2 className={formStyles.sectionTitle}>{section.title}</h2>
                {section.hint ? <p className={formStyles.sectionHint}>{section.hint}</p> : null}
              </div>
              {section.content}
            </section>
          ))}
        </div>

        <aside className={formStyles.sideColumn}>
          <div className={formStyles.sideShell}>
            <div className={formStyles.summaryStack}>
              <section className={`${formStyles.sideCard} ${formStyles.summaryCard}`}>
                <div className={formStyles.sectionHeader}>
                  <h2 className={formStyles.sectionTitle}>{summaryTitle}</h2>
                  {summaryHint ? <p className={formStyles.sectionHint}>{summaryHint}</p> : null}
                </div>

                {summaryStatusLabel ? (
                  <div className={formStyles.lifecycleInline}>
                    <span className={formStyles.totalLabel}>{t('oms.detailLabels.status')}</span>
                    <span className={formStyles.statusBadge}>{summaryStatusLabel}</span>
                  </div>
                ) : null}

                {number ? (
                  <div className={formStyles.documentAnchor}>
                    <p className={formStyles.anchorLabel}>{t('oms.detailLabels.number')}</p>
                    <p className={formStyles.anchorValue}>{number}</p>
                  </div>
                ) : null}

                <div className={formStyles.summaryRows}>
                  <div className={formStyles.summaryRow}>
                    <span className={formStyles.totalLabel}>{totals.netLabel}</span>
                    <strong className={formStyles.totalValue}>{formatAmount(totals.net)}</strong>
                  </div>
                  <div className={formStyles.summaryRow}>
                    <span className={formStyles.totalLabel}>{totals.vatLabel}</span>
                    <strong className={formStyles.totalValue}>{formatAmount(totals.vat)}</strong>
                  </div>
                  <div className={`${formStyles.summaryRow} ${formStyles.summaryRowAccent}`}>
                    <span className={formStyles.totalLabel}>{totals.grossLabel}</span>
                    <strong className={formStyles.totalValueLarge}>{formatAmount(totals.gross)}</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </aside>
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
    </div>
  );
}

// State card (loading / not found / error) — reuses the documents page state styles.
function DocumentVisualEditorState({ title, text, actions = [] }) {
  return (
    <div className={pageStyles.page}>
      <section className={pageStyles.stateCard}>
        <h2 className={pageStyles.stateTitle}>{title}</h2>
        {text ? <p className={pageStyles.stateText}>{text}</p> : null}
        {actions.length ? (
          <div className={pageStyles.stateActions}>
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.ghost ? pageStyles.stateButtonGhost : pageStyles.stateButton}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

DocumentVisualEditor.State = DocumentVisualEditorState;
