import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentVisualEditor from '../../../../components/documents/DocumentVisualEditor';
import { mapInvoiceToVisualModel } from '../../../../components/documents/DocumentVisualEditor/omsDocumentModel';
import { DocumentRelations, DocumentTimeline } from '../../../../components/documents/DocumentShell';
import { asText } from '../../../../lib/format';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useGetInvoiceByIdQuery,
  useIssueInvoiceFromOrderMutation,
} from '../../../../store/rtk/invoicesApi';
import s from '../../OmsReadOnlyDetail.module.css';

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`);
}

function buildDocumentRelations(invoice, t) {
  const relations = [];
  if (invoice?.order?.id || invoice?.orderId) {
    relations.push({
      type: t('documents.types.order'),
      number: invoice?.order?.number || invoice.orderId,
      status: invoice?.order?.status,
      statusLabel: invoice?.order?.status ? statusLabel(invoice.order.status, t) : undefined,
      to: `/main/oms/orders/${invoice?.order?.id || invoice.orderId}`,
    });
  }
  return relations;
}

function buildTimelineEvents(invoice, t) {
  return [
    invoice?.createdAt ? { id: 'created', action: t('documents.timeline.created'), timestamp: invoice.createdAt } : null,
    invoice?.issueDate ? { id: 'issued', action: t('documents.timeline.issued'), timestamp: invoice.issueDate } : null,
    invoice?.paidDate ? { id: 'paid', action: t('statuses.paid'), timestamp: invoice.paidDate } : null,
    invoice?.updatedAt ? { id: 'updated', action: t('documents.timeline.updated'), timestamp: invoice.updatedAt } : null,
  ].filter(Boolean);
}

function getActionError(error, t) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || t('oms.errors.actionFailed');
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadInvoices = can('order:read');
  const canIssueInvoices = can('order:convert');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: invoice, isLoading, isFetching, isError, error, refetch } = useGetInvoiceByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const [issueInvoiceFromOrder] = useIssueInvoiceFromOrderMutation();

  const handleAction = useCallback(async (action) => {
    if (!invoice?.orderId || action.key !== 'issue') return;
    setActionLoadingKey(action.key);
    setActionError('');
    try {
      const issued = await issueInvoiceFromOrder({
        orderId: invoice.orderId,
        payload: { issueDate: new Date().toISOString() },
      }).unwrap();
      await refetch();
      if (issued?.id) navigate(`/main/oms/invoices/${issued.id}`, { replace: true });
    } catch (err) {
      setActionError(getActionError(err, t));
    } finally {
      setActionLoadingKey('');
    }
  }, [invoice?.orderId, issueInvoiceFromOrder, navigate, refetch, t]);

  const headerActions = useMemo(() => {
    if (invoice?.status === 'draft' && invoice?.orderId) {
      return [{
        key: 'issue',
        label: t('oms.actionLabels.issueInvoice'),
        variant: 'primary',
        disabled: !canIssueInvoices,
        loadingLabel: t('common.loading'),
        onClick: handleAction,
      }];
    }
    return [];
  }, [invoice?.status, invoice?.orderId, canIssueInvoices, handleAction, t]);

  if (!canReadInvoices) {
    return <DocumentVisualEditor.State title={t('common.noPermission')} text={t('documents.editor.noPermissionHint')} />;
  }
  if (isLoading || isFetching) {
    return <DocumentVisualEditor.State title={t('common.loading')} text={t('documents.editor.loadingHint')} />;
  }
  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || t('oms.errors.invoiceLoadFailed');
    return <DocumentVisualEditor.State title={t('oms.errors.invoiceLoadFailed')} text={message} />;
  }
  if (!invoice) {
    return <DocumentVisualEditor.State title={t('oms.errors.invoiceNotFound')} text={t('documents.editor.notFoundHint')} />;
  }

  const model = mapInvoiceToVisualModel(invoice, { t, locale });
  const relations = buildDocumentRelations(invoice, t);
  const timelineEvents = buildTimelineEvents(invoice, t);
  const orderId = invoice?.order?.id || invoice?.orderId || null;

  const relationsContent = (
    <>
      {relations.length ? <DocumentRelations relations={relations} /> : null}
      <div className={s.kvList}>
        <div className={s.kvRow}>
          <span className={s.kvLabel}>{t('documents.types.order')}</span>
          <span className={`${s.kvValue} ${s.kvValueLeft}`}>
            {orderId ? (
              <Link className={s.entityLink} to={`/main/oms/orders/${orderId}`}>
                {invoice?.order?.number || orderId}
              </Link>
            ) : '—'}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <DocumentVisualEditor
      {...model}
      back={{ label: t('oms.invoices.title'), onClick: () => navigate('/main/oms/invoices') }}
      breadcrumb={`${t('oms.invoices.title')} / ${model.number}`}
      showViewModeToggle
      viewMode="preview"
      viewModeDisabledModes={['edit', 'split']}
      showPrintButton
      onPrint={() => { if (typeof window !== 'undefined') window.print(); }}
      actions={headerActions}
      actionLoadingKey={actionLoadingKey}
      actionError={actionError}
      itemsTitle={t('documents.lines.title')}
      emptyItemsLabel={t('oms.itemsTable.empty')}
      summaryTitle={t('documents.editor.summaryTitle')}
      sections={[
        { key: 'relations', title: t('oms.relations.title'), content: relationsContent },
        { key: 'history', title: t('oms.tabs.history'), content: <DocumentTimeline events={timelineEvents} /> },
      ]}
    />
  );
}
