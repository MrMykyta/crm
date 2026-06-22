import DocumentHeader from './DocumentHeader';
import DocumentMetaForm from './DocumentMetaForm';
import DocumentItemsTable from './DocumentItemsTable';
import DocumentTypeModeFields from './DocumentTypeModeFields';
import DocumentPreview from './DocumentPreview';
import { getDocumentTypeConfig } from './documentTypeConfig';
import {
  getDocumentStatusLabel,
  getPaymentStatusLabel,
  isPaymentEnabledForType,
} from './documentStatusConfig';
import { DOCUMENT_VIEW_MODES } from './documentViewModes';
import { DateField, NumberField, TextField } from '../ui/fields';
import styles from './DocumentForm.module.css';

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

export default function DocumentForm({
  formState,
  clients = [],
  isClientsLoading = false,
  disabled = false,
  error = '',
  helperText = '',
  helperTone = 'neutral',
  viewMode = DOCUMENT_VIEW_MODES.EDIT,
}) {
  const typeConfig = getDocumentTypeConfig(formState?.header?.type);
  const typeCopy = typeConfig.copy;
  const resolvedHelperText = error || helperText || typeCopy.sidebarHelper;
  const hasHelper = Boolean(resolvedHelperText);
  const statusLabel = getDocumentStatusLabel(formState?.header?.type, formState?.header?.status);
  const supportsPayment = isPaymentEnabledForType(formState?.header?.type);
  const paymentStatusLabel = getPaymentStatusLabel(formState?.header?.type, formState?.payment?.paymentStatus);
  const documentNumber = String(formState?.header?.number || '').trim() || 'Автонумерация при сохранении';
  const helperClassName = error
    ? styles.helperDanger
    : helperTone === 'success'
      ? styles.helperSuccess
      : styles.helperNeutral;
  const hasTypeContext =
    Boolean(typeConfig?.sections?.validity) ||
    Boolean(typeConfig?.sections?.paymentTerms) ||
    typeConfig?.capabilities?.requiresItems === false;

  const isSplitMode = viewMode === DOCUMENT_VIEW_MODES.SPLIT;
  const isPreviewMode = viewMode === DOCUMENT_VIEW_MODES.PREVIEW;

  const editorWorkspace = (
    <>
      {hasHelper ? (
        <section className={styles.infoStrip}>
          {hasHelper ? (
            <div className={`${styles.infoBadge} ${helperClassName}`}>
              <span className={styles.infoBadgeLabel}>{error ? 'Ошибка сохранения' : 'Подсказка'}</span>
              <span className={styles.infoBadgeValue}>{resolvedHelperText}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.commandBar}>
        <div className={styles.commandHeader}>
          <h2 className={styles.commandTitle}>Параметры документа</h2>
          <p className={styles.commandHint}>Основные реквизиты перед заполнением позиций.</p>
        </div>

        <div className={styles.commandGrid}>
          <div className={styles.commandPrimary}>
            <DocumentHeader value={formState.header} onChange={formState.setHeader} disabled={disabled} />
          </div>
          <div className={styles.commandSecondary}>
            <DocumentMetaForm
              value={formState.meta}
              direction={formState.header.direction}
              clients={clients}
              isClientsLoading={isClientsLoading}
              onChange={formState.setMeta}
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      <section className={styles.itemsSection}>
        <DocumentItemsTable
          items={formState.items}
          onItemChange={formState.onItemChange}
          onAddRow={formState.onAddRow}
          onRemoveRow={formState.onRemoveRow}
          disabled={disabled}
          subtitle={typeCopy.itemsSubtitle}
        />
      </section>

      {hasTypeContext ? (
        <section className={styles.contextSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Контекст по типу документа</h2>
            <p className={styles.sectionHint}>Дополнительные поля отображаются по выбранному типу документа.</p>
          </div>
          <DocumentTypeModeFields
            type={formState.header.type}
            value={formState.terms}
            onChange={formState.setTerms}
            disabled={disabled}
          />
        </section>
      ) : null}
    </>
  );

  const summaryPanel = (
    <div className={styles.summaryStack}>
      <section className={`${styles.sideCard} ${styles.summaryCard}`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{typeCopy.summaryTitle}</h2>
          <p className={styles.sectionHint}>{typeCopy.summaryHint}</p>
        </div>

        <div className={styles.lifecycleInline}>
          <span className={styles.totalLabel}>Статус</span>
          <span className={styles.statusBadge}>{statusLabel}</span>
        </div>

        <div className={styles.documentAnchor}>
          <p className={styles.anchorLabel}>Номер</p>
          <p className={styles.anchorValue}>{documentNumber}</p>
        </div>

        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span className={styles.totalLabel}>{typeCopy.totalNetLabel}</span>
            <strong className={styles.totalValue}>{formatAmount(formState.totals.totalNet)}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.totalLabel}>{typeCopy.totalVatLabel}</span>
            <strong className={styles.totalValue}>{formatAmount(formState.totals.totalVat)}</strong>
          </div>
          <div className={`${styles.summaryRow} ${styles.summaryRowAccent}`}>
            <span className={styles.totalLabel}>{typeCopy.totalGrossLabel}</span>
            <strong className={styles.totalValueLarge}>{formatAmount(formState.totals.totalGross)}</strong>
          </div>
        </div>
      </section>

      {supportsPayment ? (
        <section className={`${styles.sideCard} ${styles.paymentCard}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Оплата</h2>
            <span className={styles.paymentStatusBadge}>{paymentStatusLabel}</span>
          </div>

          <div className={styles.paymentSummaryRows}>
            <div className={styles.paymentSummaryRow}>
              <span className={styles.totalLabel}>Оплачено</span>
              <strong className={styles.totalValue}>{formatAmount(formState.payment.paidAmount)}</strong>
            </div>
            <div className={styles.paymentSummaryRow}>
              <span className={styles.totalLabel}>Осталось</span>
              <strong className={styles.totalValue}>{formatAmount(formState.payment.remainingAmount)}</strong>
            </div>
          </div>

          <div className={styles.paymentFields}>
            <label className={styles.sideField}>
              <span className={styles.sideFieldLabel}>Сумма оплаты</span>
              <NumberField
                emitAs="string"
                min="0"
                step="0.01"
                max={formatAmount(formState.totals.totalGross)}
                value={formState.payment.paidAmount ?? ""}
                onValueChange={(value) => formState?.setPayment?.('paidAmount', value)}
                inputClassName={styles.sideFieldControl}
                disabled={disabled}
              />
            </label>

            <label className={styles.sideField}>
              <span className={styles.sideFieldLabel}>Дата оплаты</span>
              <DateField
                value={formState.payment.paymentDate ?? ""}
                onValueChange={(value) => formState?.setPayment?.('paymentDate', value)}
                inputClassName={styles.sideFieldControl}
                disabled={disabled}
              />
            </label>

            <label className={styles.sideField}>
              <span className={styles.sideFieldLabel}>Способ оплаты</span>
              <TextField
                value={formState.payment.paymentMethod ?? ""}
                onValueChange={(value) => formState?.setPayment?.('paymentMethod', value)}
                inputClassName={styles.sideFieldControl}
                placeholder="Например: банковский перевод"
                disabled={disabled}
              />
            </label>
          </div>

          <p className={styles.sideHint}>{typeCopy.paymentHelper}</p>
        </section>
      ) : null}
    </div>
  );

  if (isPreviewMode) {
    return (
      <div className={`${styles.layout} ${styles.layoutPreview}`}>
        <section className={styles.previewOnlyPane}>
          <div className={styles.previewOnlyFrame}>
            <DocumentPreview formState={formState} clients={clients} />
          </div>
        </section>
      </div>
    );
  }

  if (isSplitMode) {
    return (
      <div className={`${styles.layout} ${styles.layoutSplit}`}>
        <div className={`${styles.workspace} ${styles.workspaceSplit}`}>{editorWorkspace}</div>

        <aside className={styles.splitPreviewColumn}>
          <div className={styles.splitPreviewSticky}>
            <div className={styles.splitPreviewFrame}>
              <DocumentPreview formState={formState} clients={clients} />
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.workspace}>{editorWorkspace}</div>

      <aside className={styles.sideColumn}>
        <div className={styles.sideShell}>{summaryPanel}</div>
      </aside>
    </div>
  );
}
