import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  PackageCheck,
  ReceiptText,
  Save,
  ShieldCheck,
  Truck,
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import EntityTimeline from '../../../../components/timeline/EntityTimeline';
import {
  asNumber,
  asText,
  calculateLine,
  calculateTotals,
  createEmptyItem,
  mapLinesToPayload,
  stableItemsHash,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import { SelectField, TextField, TextareaField } from '../../../../components/ui/fields';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import { isOrderEditable } from '../../../../components/oms/documentEditability';
import { paymentMethodLabel } from '../../../../components/oms/paymentLabels';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsByCounterpartyQuery } from '../../../../store/rtk/contactsApi';
import { useListCompanyUsersQuery } from '../../../../store/rtk/companyUsersApi';
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useConfirmOrderMutation,
  useCreateOrderMutation,
  useDeleteOrderMutation,
  useGetOrderByIdQuery,
  useGetOrderMetaQuery,
  useReserveOrderMutation,
  useReturnOrderMutation,
  useSaveOrderItemsMutation,
  useShipOrderMutation,
  useUpdateOrderMutation,
} from '../../../../store/rtk/ordersApi';
import { useIssueInvoiceFromOrderMutation } from '../../../../store/rtk/invoicesApi';
import { useListEntityTimelineQuery } from '../../../../store/rtk/timelineApi';
import s from './OrderDetailPage.module.css';

const EMPTY_FORM = {
  counterpartyId: '',
  contactId: '',
  ownerId: '',
  currencyCode: 'PLN',
  placedAt: '',
  notes: '',
  paymentTerms: '',
  deliveryTerms: '',
  leadTime: '',
};

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function getApiErrorCode(error) {
  return error?.data?.code || error?.data?.details?.code || error?.code || '';
}

function getOrderActionErrorText(error, t) {
  const raw = getErrorText(error, '');
  if (/Cannot return shipped\/completed order without a shipped WZ document/i.test(raw)) {
    return t(
      'oms.errors.returnRequiresShippedWz',
      'This order can be returned only after a shipped WZ document exists.'
    );
  }
  return raw || t('oms.errors.actionFailed', 'Failed to run action');
}

function getReserveOrderErrorText(error, t) {
  const code = getApiErrorCode(error);
  if (code) {
    return t(`oms.orderDetail.fulfillment.reserveErrors.${code}`, t('oms.orderDetail.fulfillment.reserveErrors.UNKNOWN', 'Could not reserve stock.'));
  }
  return getErrorText(error, t('oms.orderDetail.fulfillment.reserveErrors.UNKNOWN', 'Could not reserve stock.'));
}

function readableEventType(value) {
  if (!value) return '';
  return String(value)
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function localizeOrderTimelineEvent(event, t) {
  const eventType = event?.eventType || '';
  const eventKey = eventType.replace(/[.:]/g, '_');
  const titleFallback = event?.title || readableEventType(eventType);
  const payload = event?.payload || {};
  const warehouseName = payload.warehouseName || '';
  let summary = event?.summary || '';

  if (eventType === 'order.stock_reserved') {
    summary = warehouseName
      ? t('oms.orderDetail.activity.summaries.order_stock_reserved_with_warehouse', {
        warehouse: warehouseName,
        defaultValue: `Stock reserved at ${warehouseName}`,
      })
      : t('oms.orderDetail.activity.summaries.order_stock_reserved', 'Stock reserved for this order.');
  } else if (eventType === 'order.fulfillment_planned') {
    summary = t('oms.orderDetail.activity.summaries.order_fulfillment_planned', event?.summary || 'Fulfillment plan prepared.');
  } else if (eventType === 'document.pdf_generated') {
    summary = t('oms.orderDetail.activity.summaries.document_pdf_generated', event?.summary || 'PDF document generated.');
  }

  return {
    ...event,
    title: eventKey
      ? t(`oms.orderDetail.activity.events.${eventKey}`, titleFallback)
      : titleFallback,
    summary,
    changes: Array.isArray(event?.changes)
      ? event.changes.map((change) => ({
        ...change,
        label: change.labelKey ? t(change.labelKey, change.label || change.field) : change.label,
      }))
      : event?.changes,
    links: Array.isArray(event?.links)
      ? event.links.map((link) => ({
        ...link,
        role: link.role === 'warehouse' ? t('oms.orderDetail.activity.links.warehouse', 'Warehouse') : link.role,
        label: link.role === 'warehouse' && warehouseName ? warehouseName : link.label,
      }))
      : event?.links,
  };
}

function getInvoiceId(result) {
  return result?.invoice?.id
    || result?.data?.invoice?.id
    || result?.data?.id
    || result?.id
    || '';
}

function dateInput(value) {
  return asText(value).slice(0, 10);
}

function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function formatAmount(value, locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value, currency = 'PLN', locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${formatAmount(number, locale)} ${currency || 'PLN'}`;
}

function MoneyAmount({ value, currency = 'PLN', locale, size = 'md' }) {
  return (
    <span className={`${s.moneyAmount} ${s[`money_${size}`] || ''}`}>
      <span>{formatAmount(value, locale)}</span>
      <small>{currency || 'PLN'}</small>
    </span>
  );
}

function counterpartyName(counterparty) {
  return counterparty?.shortName || counterparty?.fullName || counterparty?.name || counterparty?.id || '';
}

function contactName(contact) {
  return [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim()
    || contact?.displayName
    || contact?.name
    || contact?.email
    || contact?.id
    || '';
}

function userName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.name
    || user?.email
    || user?.userId
    || user?.id
    || '';
}

function statusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function fulfillmentPlanStatusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`oms.orderDetail.fulfillment.planStatuses.${key}`, statusLabel(key, t));
}

function fulfillmentPlanModeLabel(mode, t) {
  const key = asText(mode).toLowerCase();
  if (!key) return '—';
  return t(`oms.orderDetail.fulfillment.planModes.${key}`, key);
}

function fulfillmentWarningLabel(code, t) {
  const key = asText(code).toLowerCase();
  if (!key) return '';
  return t(`oms.orderDetail.fulfillment.warnings.${key}`, key);
}

function fulfillmentLineStatusKey(status) {
  const key = asText(status).toLowerCase();
  if (key === 'ready') return 'available';
  if (key === 'already_fulfilled') return 'fulfilled';
  return key || 'unknown';
}

function fulfillmentTone(status) {
  const key = fulfillmentLineStatusKey(status);
  if (['available', 'ready', 'reserved', 'fulfilled'].includes(key)) return 'ok';
  if (['shortage'].includes(key)) return 'danger';
  if (['partial'].includes(key)) return 'warning';
  return 'muted';
}

function fulfillmentSetupMessage(plan, t) {
  if (!plan) return t('oms.orderDetail.fulfillment.planUnavailable', 'Fulfillment plan is not available for this order.');
  if (plan.status === 'shortage') {
    return t('oms.orderDetail.fulfillment.setupMessages.shortage', 'There is not enough stock to fulfill the order.');
  }
  if (plan.mode === 'split_suggested') {
    return t('oms.orderDetail.fulfillment.setupMessages.split', 'Some lines need another warehouse.');
  }
  if (plan.recommendedWarehouseName && plan.mode === 'single_warehouse') {
    return t('oms.orderDetail.fulfillment.setupMessages.single', 'This warehouse covers all order lines.');
  }
  if (plan.status === 'reserved') {
    return t('oms.orderDetail.fulfillment.setupMessages.reserved', 'Stock is already reserved for this order.');
  }
  if (['fulfilled', 'already_fulfilled'].includes(plan.status)) {
    return t('oms.orderDetail.fulfillment.setupMessages.fulfilled', 'The order has already been shipped.');
  }
  return t('oms.orderDetail.fulfillment.setupMessages.manual', 'Review stock availability before the next fulfillment step.');
}

function fulfillmentReserveState(plan, t) {
  if (!plan) return t('oms.orderDetail.fulfillment.states.unavailable', 'Unavailable');
  if (plan.canReserve) return t('oms.orderDetail.fulfillment.states.canReserve', 'The order can be reserved');
  if (plan.status === 'shortage') return t('oms.orderDetail.fulfillment.states.cannotReserve', 'Reservation is blocked by shortage');
  if (plan.status === 'reserved') return t('oms.orderDetail.fulfillment.states.alreadyReserved', 'Stock is reserved');
  return t('oms.orderDetail.fulfillment.states.readOnly', 'Read-only recommendation');
}

function fulfillmentShipState(plan, t) {
  if (!plan) return t('oms.orderDetail.fulfillment.states.unavailable', 'Unavailable');
  if (plan.canShip) return t('oms.orderDetail.fulfillment.states.canShip', 'Shipment can be prepared');
  if (plan.status === 'shortage') return t('oms.orderDetail.fulfillment.states.cannotShip', 'Shipment is blocked by shortage');
  if (['fulfilled', 'already_fulfilled'].includes(plan.status)) return t('oms.orderDetail.fulfillment.states.shipped', 'Order shipped');
  return t('oms.orderDetail.fulfillment.states.notReadyToShip', 'Shipment is not ready yet');
}

function fulfillmentNextStep(plan, t) {
  if (!plan) {
    return {
      title: t('oms.orderDetail.fulfillment.nextSteps.unavailableTitle', 'Fulfillment plan unavailable'),
      body: t('oms.orderDetail.fulfillment.nextSteps.unavailableBody', 'Fulfillment plan is not available for this order.'),
      action: t('oms.orderDetail.fulfillment.readOnlyPlan', 'Read-only plan'),
      tone: 'muted',
    };
  }
  if (plan.status === 'shortage') {
    return {
      title: t('oms.orderDetail.fulfillment.nextSteps.shortageTitle', 'Cannot fulfill the order completely'),
      body: t('oms.orderDetail.fulfillment.nextSteps.shortageBody', 'Check stock balances or adjust order lines before fulfillment.'),
      action: t('oms.orderDetail.fulfillment.actions.reviewStock', 'Review stock'),
      tone: 'danger',
    };
  }
  if (plan.status === 'reserved') {
    return {
      title: t('oms.orderDetail.fulfillment.nextSteps.reservedTitle', 'Stock is reserved'),
      body: t('oms.orderDetail.fulfillment.nextSteps.reservedBody', 'Shipment/WZ creation will be connected in the next step.'),
      action: t('oms.orderDetail.fulfillment.actions.createShipmentPrepared', 'Create shipment'),
      tone: 'ok',
    };
  }
  if (['fulfilled', 'already_fulfilled'].includes(plan.status)) {
    return {
      title: t('oms.orderDetail.fulfillment.nextSteps.fulfilledTitle', 'Order shipped'),
      body: t('oms.orderDetail.fulfillment.nextSteps.fulfilledBody', 'Fulfillment is complete for this order.'),
      action: t('oms.orderDetail.fulfillment.readOnlyPlan', 'Read-only plan'),
      tone: 'ok',
    };
  }
  if (plan.canReserve) {
    return {
      title: t('oms.orderDetail.fulfillment.nextSteps.reserveTitle', 'Next step: reserve stock'),
      body: t('oms.orderDetail.fulfillment.nextSteps.reserveBody', 'Reservation will be connected in the next fulfillment step.'),
      action: t('oms.orderDetail.fulfillment.actions.reservePrepared', 'Reserve'),
      tone: 'ok',
    };
  }
  return {
    title: t('oms.orderDetail.fulfillment.nextSteps.manualTitle', 'Review fulfillment setup'),
    body: t('oms.orderDetail.fulfillment.nextSteps.manualBody', 'Review warehouse availability before continuing.'),
    action: t('oms.orderDetail.fulfillment.readOnlyPlan', 'Read-only plan'),
    tone: 'muted',
  };
}

function fulfillmentReserveActionState(plan, t) {
  if (!plan) {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.unavailable', 'Fulfillment plan is not available.'),
    };
  }
  if (plan.status === 'reserved') {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.reserved', 'Shipment/WZ creation will be connected in the next step.'),
    };
  }
  if (['fulfilled', 'already_fulfilled'].includes(plan.status)) {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.fulfilled', 'Order is already fulfilled.'),
    };
  }
  if (plan.status === 'shortage') {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.shortage', 'Not enough stock to reserve the order.'),
    };
  }
  if (plan.mode === 'split_suggested') {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.split', 'Several warehouses are needed. Split reservation will be available later.'),
    };
  }
  if (!stockTrackedPlanLines(plan).length) {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.noStock', 'This order does not require stock reservation.'),
    };
  }
  if (!plan.recommendedWarehouseId) {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.noWarehouse', 'No recommended warehouse is available.'),
    };
  }
  if (!plan.canReserve) {
    return {
      canRun: false,
      reason: t('oms.orderDetail.fulfillment.reserveDisabled.default', 'Reservation is not available for this order.'),
    };
  }
  return {
    canRun: true,
    reason: t('oms.orderDetail.fulfillment.reserveEnabled', 'Ready to reserve stock.'),
  };
}

function fulfillmentShortageCount(plan) {
  return (Array.isArray(plan?.lines) ? plan.lines : []).filter((line) => asNumber(line.shortageQty, 0) > 0).length;
}

function stockTrackedPlanLines(plan = {}) {
  return (Array.isArray(plan?.lines) ? plan.lines : []).filter((line) => line?.status !== 'not_stock_tracked');
}

function buildFormFromOrder(order, searchParams) {
  if (!order?.id) {
    return {
      ...EMPTY_FORM,
      counterpartyId: searchParams.get('counterpartyId') || searchParams.get('customerId') || '',
      contactId: searchParams.get('contactId') || '',
    };
  }

  return {
    counterpartyId: order.counterpartyId || order.customerId || order.customer?.id || order.counterparty?.id || '',
    contactId: order.contactId || order.contact?.id || '',
    ownerId: order.ownerId || order.owner?.id || '',
    currencyCode: order.currencyCode || order.currency || 'PLN',
    placedAt: dateInput(order.placedAt),
    notes: order.notes || '',
    paymentTerms: order.paymentTerms || '',
    deliveryTerms: order.deliveryTerms || '',
    leadTime: order.leadTime || '',
  };
}

function normalizeItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return normalizeItemSortOrder(sortItemsBySortOrder(order.items).map(toEditorItem));
  }
  return normalizeItemSortOrder([createEmptyItem()]);
}

function buildDirtySnapshot(form, items) {
  return JSON.stringify({
    form: {
      counterpartyId: form?.counterpartyId || '',
      contactId: form?.contactId || '',
      ownerId: form?.ownerId || '',
      currencyCode: asText(form?.currencyCode).toUpperCase() || 'PLN',
      placedAt: form?.placedAt || '',
      notes: form?.notes || '',
      paymentTerms: form?.paymentTerms || '',
      deliveryTerms: form?.deliveryTerms || '',
      leadTime: form?.leadTime || '',
    },
    items: stableItemsHash(items || []),
  });
}

function getNextAction(order, availableActions, t) {
  if (!order?.id) return t('oms.orderDetail.next.create', 'Create the order');
  if (availableActions?.canConfirm) return t('oms.orderDetail.next.confirm', 'Confirm this order');
  if (availableActions?.canShip) return t('oms.orderDetail.next.ship', 'Ship this order');
  if (availableActions?.canComplete) return t('oms.orderDetail.next.complete', 'Complete this order');
  if (availableActions?.canConvertToInvoice) return t('oms.orderDetail.next.invoice', 'Convert to invoice');
  if (availableActions?.isTerminal) return t('oms.orderDetail.next.terminal', 'Terminal order');
  return t('oms.orderDetail.next.monitor', 'Monitor fulfillment and payment');
}

function getPrimaryActionKey(order, availableActions) {
  if (!order?.id) return 'create';
  if (availableActions?.canConfirm) return 'confirm';
  if (availableActions?.canShip) return 'ship';
  if (availableActions?.canComplete) return 'complete';
  if (availableActions?.canConvertToInvoice) return 'convert-to-invoice';
  return '';
}

function canOrderIssueInvoice(order, invoices, dueAmount) {
  if (!order?.id) return false;
  if (Array.isArray(invoices) && invoices.length) return false;
  if (asNumber(dueAmount, 0) <= 0) return false;
  const status = asText(order.status).toLowerCase();
  return !['cancelled', 'returned', 'refunded'].includes(status);
}

function axisTone(value) {
  const key = asText(value).toLowerCase();
  if (['fulfilled', 'paid', 'completed'].includes(key)) return 'ok';
  if (['partial', 'partially_refunded', 'shipped'].includes(key)) return 'warning';
  if (['refunded', 'returned', 'cancelled'].includes(key)) return 'danger';
  return 'muted';
}

function calcPaid(order) {
  if (Number.isFinite(Number(order?.amountPaid))) return Number(order.amountPaid);
  if (Number.isFinite(Number(order?.paidAmount))) return Number(order.paidAmount);
  if (order?.paymentStatus === 'paid') return asNumber(order.totalGross, 0);
  return 0;
}

function calcDue(order) {
  return Math.max(0, asNumber(order?.totalGross, 0) - calcPaid(order));
}

function mapInvoiceList(order) {
  const list = [];
  if (Array.isArray(order?.invoices)) list.push(...order.invoices.filter(Boolean));
  if (order?.invoice) list.push(order.invoice);
  if (order?.convertedInvoice) list.push(order.convertedInvoice);
  const map = new Map();
  list.forEach((item) => { if (item?.id && !map.has(item.id)) map.set(item.id, item); });
  return [...map.values()];
}

function Fact({ label, value, to }) {
  const content = value || '—';
  return (
    <div className={s.factLine}>
      <span>{label}</span>
      {to ? <Link to={to}>{content}</Link> : <strong>{content}</strong>}
    </div>
  );
}

function EmptyState({ children }) {
  return <div className={s.empty}>{children}</div>;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();

  const canReadOrder = can('order:read');
  const canCreateOrder = can('order:create');
  const canUpdateOrder = can('order:update');
  const canDeleteOrder = can('order:delete');
  const canConvertOrder = can('order:convert');

  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState(() => buildFormFromOrder(null, searchParams));
  const [items, setItems] = useState(() => normalizeItemSortOrder([createEmptyItem()]));
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const initRef = useRef('');
  const cleanRef = useRef('');

  const { data: order, isLoading, isFetching, isError, error, refetch } = useGetOrderByIdQuery(id, {
    skip: isCreate || !id,
    refetchOnMountOrArgChange: true,
  });
  const { data: meta } = useGetOrderMetaQuery({}, { refetchOnMountOrArgChange: false });
  const { data: counterpartiesData } = useListCounterpartiesQuery({
    limit: 150,
    sort: 'shortName',
    dir: 'ASC',
    excludeLeadClient: true,
  });
  const { data: contactsData } = useGetContactsByCounterpartyQuery(
    { counterpartyId: form.counterpartyId, limit: 100 },
    { skip: !form.counterpartyId }
  );
  const { data: ownersData } = useListCompanyUsersQuery({ limit: 200 });

  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();
  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderMutation();
  const [saveOrderItems, { isLoading: isSavingItems }] = useSaveOrderItemsMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const [confirmOrder] = useConfirmOrderMutation();
  const [shipOrder] = useShipOrderMutation();
  const [completeOrder] = useCompleteOrderMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const [returnOrder] = useReturnOrderMutation();
  const [issueInvoiceFromOrder, { isLoading: isIssuingInvoice }] = useIssueInvoiceFromOrderMutation();
  const [issuedInvoice, setIssuedInvoice] = useState(null);

  useEffect(() => {
    if (isCreate) {
      const snapshot = buildDirtySnapshot(form, items);
      if (!cleanRef.current) cleanRef.current = snapshot;
      return;
    }
    if (!order?.id || initRef.current === order.id) return;
    const nextForm = buildFormFromOrder(order, searchParams);
    const nextItems = normalizeItems(order);
    setForm(nextForm);
    setItems(nextItems);
    setErrors({});
    setActionError('');
    initRef.current = order.id;
    cleanRef.current = buildDirtySnapshot(nextForm, nextItems);
  }, [form, isCreate, items, order, searchParams]);

  const currentOrder = order || null;
  const availableActions = currentOrder?.availableActions || {};
  const editable = isCreate || (canUpdateOrder && isOrderEditable(currentOrder));
  const readonly = !editable;
  const isSaving = isCreating || isUpdating || isSavingItems;
  const currency = form.currencyCode || currentOrder?.currencyCode || currentOrder?.currency || 'PLN';
  const totals = useMemo(() => calculateTotals(items), [items]);
  const dirty = buildDirtySnapshot(form, items) !== cleanRef.current;
  const invoices = useMemo(() => mapInvoiceList(currentOrder), [currentOrder]);
  const canIssueInvoice = Boolean(
    (canConvertOrder || canUpdateOrder)
    && (
      availableActions?.canConvertToInvoice
      || canOrderIssueInvoice(currentOrder, invoices, isCreate ? totals.gross : calcDue(currentOrder))
    )
  );
  const counterparty = currentOrder?.counterparty || currentOrder?.customer;
  const selectedCounterparty = counterparty || (counterpartiesData?.items || []).find((row) => row.id === form.counterpartyId);
  const customerLabel = counterpartyName(selectedCounterparty) || t('oms.orderDetail.noCustomer', 'Customer not selected');
  const paidAmount = calcPaid(currentOrder);
  const dueAmount = isCreate ? totals.gross : calcDue(currentOrder);
  const nextAction = getNextAction(currentOrder, availableActions, t);

  const counterpartyOptions = useMemo(() => {
    const rows = counterpartiesData?.items || [];
    return [
      { value: '', label: t('documents.editor.selectCounterparty') },
      ...rows.map((row) => ({ value: row.id, label: counterpartyName(row) || row.id })),
    ];
  }, [counterpartiesData, t]);

  const contactOptions = useMemo(() => {
    const rows = contactsData?.items || [];
    return [
      { value: '', label: t('documents.editor.noContact') },
      ...rows.map((row) => ({ value: row.id, label: contactName(row) || row.id })),
    ];
  }, [contactsData, t]);

  const ownerOptions = useMemo(() => {
    const rows = ownersData?.items || [];
    return [
      { value: '', label: t('documents.editor.noOwner') },
      ...rows.map((row) => ({ value: row.userId || row.id, label: userName(row) || row.userId || row.id })),
    ];
  }, [ownersData, t]);

  const currencyOptions = useMemo(() => {
    const base = ['PLN', 'EUR', 'USD'];
    const current = asText(form.currencyCode).toUpperCase();
    if (current && !base.includes(current)) base.unshift(current);
    return base.map((code) => ({ value: code, label: code }));
  }, [form.currencyCode]);

  const discountTypeOptions = useMemo(() => {
    const source = Array.isArray(meta?.discountTypes) && meta.discountTypes.length
      ? meta.discountTypes
      : ['none', 'fixed', 'percent'];
    return source.map((type) => ({ value: type, label: type }));
  }, [meta?.discountTypes]);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const onItemsChange = useCallback((next) => {
    setItems(normalizeItemSortOrder(next));
  }, []);

  const validate = useCallback(() => {
    const nextErrors = {};
    if (!form.counterpartyId) nextErrors.counterpartyId = t('oms.orderDetail.validation.customerRequired', 'Customer is required.');
    items.forEach((item) => {
      if (!asText(item.name)) nextErrors[`item:${item.localId}:name`] = t('documents.editor.validation.itemNameRequired');
      if (asNumber(item.qty, 0) <= 0) nextErrors[`item:${item.localId}:qty`] = t('documents.editor.validation.qtyPositive');
      if (asNumber(item.priceNet, -1) < 0) nextErrors[`item:${item.localId}:priceNet`] = t('documents.editor.validation.priceNonNegative');
    });
    setErrors(nextErrors);
    return nextErrors;
  }, [form.counterpartyId, items, t]);

  const buildHeaderPayload = useCallback(() => ({
    counterpartyId: form.counterpartyId,
    customerId: form.counterpartyId,
    contactId: form.contactId || null,
    ownerId: form.ownerId || null,
    currencyCode: asText(form.currencyCode).toUpperCase() || 'PLN',
    placedAt: form.placedAt || null,
    notes: form.notes || '',
    paymentTerms: form.paymentTerms || '',
    deliveryTerms: form.deliveryTerms || '',
    leadTime: form.leadTime || '',
  }), [form]);

  const onSave = useCallback(async () => {
    setActionError('');
    const nextSnapshot = buildDirtySnapshot(form, items);
    if (!isCreate && nextSnapshot === cleanRef.current) {
      return null;
    }
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setActionError(nextErrors.counterpartyId || t('documents.editor.validation.itemNameRequired'));
      return null;
    }
    try {
      const payload = buildHeaderPayload();
      const itemPayload = mapLinesToPayload(items);
      if (isCreate) {
        const created = await createOrder({ ...payload, items: itemPayload }).unwrap();
        const createdId = created?.id || created?.data?.id;
        if (createdId) navigate(`/main/oms/orders/${createdId}`);
        return created;
      }
      await updateOrder({ id, payload }).unwrap();
      await saveOrderItems({ id, items: itemPayload }).unwrap();
      await refetch();
      cleanRef.current = nextSnapshot;
      return currentOrder;
    } catch (err) {
      setActionError(getErrorText(err, t('documents.editor.saveFailed')));
      return null;
    }
  }, [buildHeaderPayload, createOrder, currentOrder, form, id, isCreate, items, navigate, refetch, saveOrderItems, t, updateOrder, validate]);

  const runAction = useCallback(async (key, runner, options = {}) => {
    if (!id && key !== 'create') return null;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const result = await runner().unwrap();
      const redirect = typeof options.redirect === 'function' ? options.redirect(result) : null;
      if (redirect) {
        navigate(redirect);
        return result;
      }
      await refetch();
      return result;
    } catch (err) {
      const message = getOrderActionErrorText(err, t);
      setActionError(message);
      return null;
    } finally {
      setActionLoadingKey('');
    }
  }, [id, navigate, refetch, t]);

  const issueInvoice = useCallback(() => {
    if (!id) return;
    return void runAction('issue-invoice', () => issueInvoiceFromOrder({ orderId: id, payload: {} }), {
      redirect: (result) => {
        const invoiceId = getInvoiceId(result);
        setIssuedInvoice(invoiceId ? { id: invoiceId, ...(result?.invoice || result?.data?.invoice || result?.data || result || {}) } : null);
        return null;
      },
    });
  }, [id, issueInvoiceFromOrder, runAction]);

  const handleAction = useCallback((key) => {
    if (key === 'create') return void onSave();
    if (key === 'save') return void onSave();
    if (key === 'confirm') return void runAction('confirm', () => confirmOrder({ id, payload: {} }));
    if (key === 'ship') return void runAction('ship', () => shipOrder({ id, payload: {} }));
    if (key === 'complete') return void runAction('complete', () => completeOrder({ id, payload: {} }));
    if (key === 'cancel') {
      if (typeof window !== 'undefined' && !window.confirm(t('oms.orderDetail.confirmCancel', 'Cancel this order?'))) return;
      return void runAction('cancel', () => cancelOrder({ id, payload: {} }));
    }
    if (key === 'return') {
      if (typeof window !== 'undefined' && !window.confirm(t('oms.orderDetail.confirmReturn', 'Return this order?'))) return;
      return void runAction('return', () => returnOrder({ id, payload: {} }));
    }
    if (key === 'delete') {
      if (typeof window !== 'undefined' && !window.confirm(t('oms.orderDetail.confirmDelete', 'Delete this order?'))) return;
      return void runAction('delete', () => deleteOrder(id), { redirect: () => '/main/oms/orders' });
    }
    if (key === 'convert-to-invoice') {
      return issueInvoice();
    }
  }, [cancelOrder, completeOrder, confirmOrder, deleteOrder, id, issueInvoice, onSave, returnOrder, runAction, shipOrder, t]);

  const primaryActionKey = getPrimaryActionKey(currentOrder, availableActions);
  const primaryAction = useMemo(() => {
    if (isCreate) {
      return { key: 'create', label: t('oms.orderDetail.actions.create', 'Create order'), icon: <Save size={15} />, disabled: isSaving };
    }
    if (!primaryActionKey) return null;
    const labels = {
      confirm: t('oms.actionLabels.confirm'),
      ship: t('oms.actionLabels.ship'),
      complete: t('oms.actionLabels.complete'),
      'convert-to-invoice': t('oms.actionLabels.convertToInvoice'),
    };
    const icons = {
      confirm: <ClipboardCheck size={15} />,
      ship: <Truck size={15} />,
      complete: <BadgeCheck size={15} />,
      'convert-to-invoice': <ReceiptText size={15} />,
    };
    return {
      key: primaryActionKey,
      label: labels[primaryActionKey] || primaryActionKey,
      icon: icons[primaryActionKey],
      disabled: Boolean(actionLoadingKey) || (primaryActionKey === 'convert-to-invoice' && !canIssueInvoice),
    };
  }, [actionLoadingKey, canIssueInvoice, isCreate, isSaving, primaryActionKey, t]);

  const overflowActions = useMemo(() => [
    currentOrder?.id && canUpdateOrder && availableActions.canCancel ? { key: 'cancel', label: t('oms.actionLabels.cancel'), danger: true } : null,
    currentOrder?.id && canUpdateOrder && availableActions.canReturn ? { key: 'return', label: t('oms.actionLabels.return'), danger: true } : null,
    currentOrder?.id && canDeleteOrder && availableActions.canDelete ? { key: 'delete', label: t('common.delete'), danger: true } : null,
  ].filter(Boolean), [availableActions.canCancel, availableActions.canDelete, availableActions.canReturn, canDeleteOrder, canUpdateOrder, currentOrder?.id, t]);

  const smartButtons = useMemo(() => [
    currentOrder?.deal?.id ? {
      key: 'deal',
      label: t('oms.orderDetail.smart.deal', 'Deal'),
      value: currentOrder.deal.title || '1',
      to: `/main/deals/${currentOrder.deal.id}`,
      icon: <ShieldCheck size={14} />,
    } : null,
    currentOrder?.sourceOffer?.id ? {
      key: 'offer',
      label: t('oms.orderDetail.smart.offer', 'Offer'),
      value: currentOrder.sourceOffer.number || '1',
      to: `/main/oms/offers/${currentOrder.sourceOffer.id}`,
      icon: <FileText size={14} />,
    } : null,
    invoices.length ? {
      key: 'invoices',
      label: t('oms.orderDetail.smart.invoices', 'Invoices'),
      value: String(currentOrder?.counts?.invoices ?? invoices.length),
      to: invoices[0]?.id ? `/main/oms/invoices/${invoices[0].id}` : null,
      icon: <ReceiptText size={14} />,
    } : null,
    currentOrder?.counts?.payments ? {
      key: 'payments',
      label: t('oms.orderDetail.smart.payments', 'Payments'),
      value: String(currentOrder.counts.payments),
      icon: <ReceiptText size={14} />,
      onClick: () => setActiveTab('billing'),
    } : null,
    currentOrder?.availableActions?.canShip || currentOrder?.status === 'shipped' ? {
      key: 'wms',
      label: t('oms.orderDetail.smart.wms', 'WMS'),
      value: currentOrder?.counts?.shipments ? String(currentOrder.counts.shipments) : statusLabel(currentOrder?.fulfillmentStatus, t),
      icon: <PackageCheck size={14} />,
      onClick: () => setActiveTab('fulfillment'),
    } : null,
    { key: 'notes', label: t('oms.orderDetail.smart.notes', 'Notes'), value: '', icon: <FileText size={14} />, onClick: () => setActiveTab('notes') },
  ].filter(Boolean), [currentOrder, invoices, t]);

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.orderDetail.tabs.overview', 'Overview'),
      render: () => (
        <OverviewTab
          order={currentOrder}
          totals={totals}
          currency={currency}
          paidAmount={paidAmount}
          dueAmount={dueAmount}
          nextAction={nextAction}
          invoices={invoices}
          canIssueInvoice={canIssueInvoice}
          issueLoading={isIssuingInvoice || actionLoadingKey === 'issue-invoice'}
          issuedInvoice={issuedInvoice}
          onIssueInvoice={issueInvoice}
          t={t}
          locale={locale}
          onTab={setActiveTab}
        />
      ),
    },
    {
      key: 'items',
      label: t('oms.orderDetail.tabs.items', 'Items'),
      count: items.length,
      render: () => (
        <ItemsTab
          items={items}
          onItemsChange={onItemsChange}
          errors={errors}
          discountTypeOptions={discountTypeOptions}
          totals={totals}
          t={t}
          locale={locale}
          currency={currency}
          readonly={readonly}
        />
      ),
    },
    {
      key: 'fulfillment',
      label: t('oms.orderDetail.tabs.fulfillment', 'Fulfillment'),
      render: () => <FulfillmentTab order={currentOrder} t={t} locale={locale} />,
    },
    {
      key: 'billing',
      label: t('oms.orderDetail.tabs.billing', 'Billing'),
      render: () => (
        <BillingTab
          order={currentOrder}
          invoices={invoices}
          paidAmount={paidAmount}
          dueAmount={dueAmount}
          t={t}
          locale={locale}
          currency={currency}
          canIssueInvoice={canIssueInvoice}
          issueLoading={isIssuingInvoice || actionLoadingKey === 'issue-invoice'}
          issuedInvoice={issuedInvoice}
          onIssueInvoice={issueInvoice}
        />
      ),
    },
    {
      key: 'activity',
      label: t('oms.orderDetail.tabs.activity', 'Activity'),
      render: () => <ActivityTab order={currentOrder} t={t} locale={locale} />,
    },
    {
      key: 'notes',
      label: t('oms.orderDetail.tabs.notes', 'Notes'),
      render: () => (
        isCreate ? (
          <DetailSection title={t('oms.orderDetail.tabs.notes', 'Notes')}>
            <EmptyState>{t('oms.orderDetail.notes.saveFirst', 'Create the order before adding notes.')}</EmptyState>
          </DetailSection>
        ) : (
          <EntityNotesSection
            ownerType="order"
            ownerId={id}
            title={t('oms.orderDetail.notes.title', 'Order notes')}
            emptyTitle={t('oms.orderDetail.notes.emptyTitle', 'No notes yet')}
            emptyText={t('oms.orderDetail.notes.emptyText', 'Notes linked to this order will appear here.')}
            addNoteLabel={t('oms.orderDetail.notes.add', 'Add note')}
            compact
            hidePagerWhenSingle
          />
        )
      ),
    },
    {
      key: 'system',
      label: t('oms.orderDetail.tabs.system', 'System'),
      render: () => <SystemTab order={currentOrder} t={t} locale={locale} />,
    },
  ], [actionLoadingKey, canIssueInvoice, currency, currentOrder, discountTypeOptions, dueAmount, errors, id, invoices, isCreate, isIssuingInvoice, issueInvoice, issuedInvoice, items, locale, nextAction, onItemsChange, paidAmount, readonly, t, totals]);

  if ((isCreate && !canCreateOrder) || (!isCreate && !canReadOrder)) {
    return <div className={s.state}>{t('common.noPermission', 'No permission')}</div>;
  }
  if (!isCreate && (isLoading || (isFetching && !currentOrder))) {
    return <div className={s.state}>{t('common.loading', 'Loading')}</div>;
  }
  if (!isCreate && isError) {
    return <div className={s.state}>{getErrorText(error, t('oms.errors.orderLoadFailed'))}</div>;
  }
  if (!isCreate && !currentOrder) {
    return <div className={s.state}>{t('oms.errors.orderNotFound')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.orderDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/main/oms/orders')}>
              <ArrowLeft size={15} /> {t('oms.orders.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{statusLabel(currentOrder?.status || 'draft', t)}</span>
              {dirty ? <span>{t('oms.orderDetail.save.unsaved', 'Unsaved changes')}</span> : null}
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={s.heroIcon}><Truck size={26} /></div>
              <div className={s.heroText}>
                <span>{isCreate ? t('oms.orderDetail.create.draftNumber', 'Draft order') : `${t('oms.orderDetail.hero.orderNumberEyebrow', 'Order')} · ${currentOrder?.number || currentOrder?.id}`}</span>
                <h1>{customerLabel}</h1>
                <p>{t('oms.orderDetail.subtitle', 'Execution workspace')}</p>
              </div>
            </div>

            <div className={s.vitals}>
              <VitalTile
                label={t('oms.orderDetail.hero.fulfillment', 'Fulfillment')}
                value={statusLabel(currentOrder?.fulfillmentStatus || 'unfulfilled', t)}
                detail={t('oms.orderDetail.fulfillment.itemsProgress', '{{count}} order lines', { count: items.length })}
                tone={axisTone(currentOrder?.fulfillmentStatus)}
                icon={<PackageCheck size={18} />}
              />
              <VitalTile
                label={t('oms.orderDetail.hero.payment', 'Payment')}
                value={statusLabel(currentOrder?.paymentStatus || 'pending', t)}
                detail={formatMoney(dueAmount, currency, locale)}
                tone={axisTone(currentOrder?.paymentStatus)}
                icon={<ShieldCheck size={18} />}
              />
            </div>
          </div>

          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {smartButtons.map((button) => (
                button.to ? (
                  <Link key={button.key} className={s.smartBtn} to={button.to}>
                    {button.icon}<span>{button.label}</span>{button.value ? <strong>{button.value}</strong> : null}
                  </Link>
                ) : (
                  <button key={button.key} type="button" className={s.smartBtn} onClick={button.onClick}>
                    {button.icon}<span>{button.label}</span>{button.value ? <strong>{button.value}</strong> : null}
                  </button>
                )
              ))}
            </div>
            <div className={s.actionRow}>
              <span className={s.nextAction}>{nextAction}</span>
              {!isCreate && dirty ? (
                <button type="button" className={s.actionBtn} disabled={isSaving} onClick={() => handleAction('save')}>
                  <Save size={15} /> {t('common.save')}
                </button>
              ) : null}
              {primaryAction ? (
                <button
                  type="button"
                  className={s.primaryBtn}
                  disabled={primaryAction.disabled || actionLoadingKey === primaryAction.key}
                  onClick={() => handleAction(primaryAction.key)}
                >
                  {primaryAction.icon}
                  {actionLoadingKey === primaryAction.key ? t('common.loading') : primaryAction.label}
                </button>
              ) : null}
              {overflowActions.length ? (
                <details className={s.overflowMenu}>
                  <summary aria-label={t('oms.orderDetail.actions.more', 'More actions')}>•••</summary>
                  <div>
                    {overflowActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className={`${s.actionBtn} ${action.danger ? s.actionDanger : ''}`}
                        onClick={() => handleAction(action.key)}
                        disabled={isDeleting || Boolean(actionLoadingKey)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
          {actionError ? <div className={s.errorBar}>{actionError}</div> : null}
        </header>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.orderDetail.sections.customer', 'Customer')}>
            <div className={s.fieldStack}>
              <SelectField label={t('oms.detailLabels.counterparty')} value={form.counterpartyId} options={counterpartyOptions} onValueChange={(value) => { setField('counterpartyId', value); setField('contactId', ''); }} disabled={readonly} searchable clearable />
              <SelectField label={t('oms.detailLabels.contact')} value={form.contactId} options={contactOptions} onValueChange={(value) => setField('contactId', value)} disabled={readonly || !form.counterpartyId} searchable clearable />
              <SelectField label={t('oms.detailLabels.owner')} value={form.ownerId} options={ownerOptions} onValueChange={(value) => setField('ownerId', value)} disabled={readonly} searchable clearable />
            </div>
          </DetailCard>

          <DetailCard title={t('oms.orderDetail.sections.execution', 'Execution facts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.orderDetail.fields.warehouse', 'Warehouse')} value={currentOrder?.warehouse?.name || '—'} />
              <Fact label={t('oms.orderDetail.fields.shipTo', 'Ship-to address')} value={currentOrder?.shippingAddressSnapshot || '—'} />
              <Fact label={t('oms.orderDetail.fields.billTo', 'Bill-to address')} value={currentOrder?.billingAddressSnapshot || '—'} />
              <Fact label={t('oms.orderDetail.fields.priority', 'Priority')} value={currentOrder?.priority || '—'} />
              <Fact label={t('oms.orderDetail.fields.sourceOffer', 'Source offer')} value={currentOrder?.sourceOffer?.number || '—'} to={currentOrder?.sourceOffer?.id ? `/main/oms/offers/${currentOrder.sourceOffer.id}` : null} />
              <Fact label={t('oms.orderDetail.fields.salesChannel', 'Sales channel')} value={currentOrder?.salesChannel?.name || currentOrder?.salesChannelId || '—'} />
            </div>
          </DetailCard>

          <DetailCard title={t('oms.orderDetail.sections.commercial', 'Commercial terms')}>
            <div className={s.fieldStack}>
              <SelectField label={t('oms.summaryLabels.currency')} value={form.currencyCode} options={currencyOptions} onValueChange={(value) => setField('currencyCode', value)} disabled={readonly} />
              <TextField type="date" label={t('oms.detailLabels.placedAt')} value={form.placedAt} onValueChange={(value) => setField('placedAt', value)} disabled={readonly} />
              <TextField label={t('oms.detailLabels.paymentTerms')} value={form.paymentTerms} onValueChange={(value) => setField('paymentTerms', value)} disabled={readonly} />
              <TextField label={t('oms.detailLabels.deliveryTerms')} value={form.deliveryTerms} onValueChange={(value) => setField('deliveryTerms', value)} disabled={readonly} />
              <TextField label={t('oms.detailLabels.leadTime')} value={form.leadTime} onValueChange={(value) => setField('leadTime', value)} disabled={readonly} />
              <TextareaField label={t('oms.detailLabels.notes')} value={form.notes} onValueChange={(value) => setField('notes', value)} disabled={readonly} rows={4} />
            </div>
          </DetailCard>
        </aside>
      )}
      content={(
        <main className={s.content}>
          <div className={s.workspaceSurface}>
            <DetailTabs tabs={tabs} activeTab={activeTab} onActiveTabChange={setActiveTab} />
          </div>
        </main>
      )}
    />
  );
}

function VitalTile({ label, value, detail, tone, icon }) {
  return (
    <div className={`${s.vitalTile} ${s[`tone_${tone}`] || ''}`}>
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function OverviewTab({
  order,
  totals,
  currency,
  paidAmount,
  dueAmount,
  nextAction,
  invoices,
  canIssueInvoice,
  issueLoading,
  issuedInvoice,
  onIssueInvoice,
  t,
  locale,
  onTab,
}) {
  const gross = Number.isFinite(Number(totals?.gross)) ? totals.gross : order?.totalGross ?? 0;
  const visibleIssuedInvoice = issuedInvoice || invoices[0] || null;
  const fulfillmentPlan = order?.fulfillmentPlan || null;
  const shortageCount = fulfillmentShortageCount(fulfillmentPlan);
  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.orderDetail.overview.fulfillment', 'Fulfillment')} value={statusLabel(order?.fulfillmentStatus || 'unfulfilled', t)} />
        <Fact label={t('oms.orderDetail.overview.payment', 'Payment')} value={statusLabel(order?.paymentStatus || 'pending', t)} />
        <Fact label={t('oms.orderDetail.overview.total', 'Grand total')} value={formatMoney(gross, currency, locale)} />
        <Fact label={t('oms.orderDetail.overview.due', 'Amount due')} value={formatMoney(dueAmount, currency, locale)} />
        <Fact label={t('oms.orderDetail.overview.paid', 'Amount paid')} value={formatMoney(paidAmount, currency, locale)} />
        <Fact label={t('oms.orderDetail.overview.nextAction', 'Next action')} value={nextAction} />
      </div>
      <DetailSection title={t('oms.orderDetail.fulfillment.overviewTitle', 'Fulfillment readiness')}>
        <div className={`${s.nextStepCard} ${s[`tone_${fulfillmentTone(fulfillmentPlan?.status)}`] || ''}`}>
          <div>
            <strong>
              {fulfillmentPlan?.recommendedWarehouseName
                ? t('oms.orderDetail.fulfillment.recommendedWarehouse', 'Recommended warehouse: {{warehouse}}', { warehouse: fulfillmentPlan.recommendedWarehouseName })
                : fulfillmentPlanStatusLabel(fulfillmentPlan?.status || 'not_required', t)}
            </strong>
            <span>
              {fulfillmentPlan
                ? `${fulfillmentPlanStatusLabel(fulfillmentPlan.status, t)} · ${fulfillmentPlanModeLabel(fulfillmentPlan.mode, t)}${shortageCount ? ` · ${t('oms.orderDetail.fulfillment.shortageLines', '{{count}} shortage lines', { count: shortageCount })}` : ''}`
                : t('oms.orderDetail.fulfillment.planUnavailable', 'Fulfillment plan is not available for this order.')}
            </span>
          </div>
          <button type="button" className={s.actionBtn} onClick={() => onTab('fulfillment')}>
            {t('oms.orderDetail.actions.openFulfillment', 'Open fulfillment')}
          </button>
        </div>
      </DetailSection>
      <DetailSection title={t('oms.orderDetail.sections.documentChain', 'Document chain')}>
        <div className={s.chain}>
          {order?.sourceOffer?.id ? <Link to={`/main/oms/offers/${order.sourceOffer.id}`}>{t('oms.orderDetail.smart.offer', 'Offer')} · {order.sourceOffer.number || order.sourceOffer.id}</Link> : <span>{t('oms.orderDetail.chain.noOffer', 'No source offer')}</span>}
          {invoices.length ? invoices.map((invoice) => <Link key={invoice.id} to={`/main/oms/invoices/${invoice.id}`}>{t('oms.orderDetail.smart.invoices', 'Invoice')} · {invoice.number || invoice.id}</Link>) : <span>{t('oms.orderDetail.chain.noInvoice', 'No invoice yet')}</span>}
        </div>
      </DetailSection>
      {canIssueInvoice || visibleIssuedInvoice ? (
        <DetailSection title={t('oms.orderDetail.billing.issueInvoiceTitle', 'Issue invoice')}>
          <div className={s.nextStepCard}>
            <div>
              <strong>{visibleIssuedInvoice ? t('oms.orderDetail.billing.invoiceReady', 'Invoice is ready') : t('oms.orderDetail.billing.invoiceNextAction', 'Create the invoice for this order')}</strong>
              <span>
                {visibleIssuedInvoice
                  ? t('oms.orderDetail.billing.invoiceReadyHint', 'Open the created invoice or continue with payments.')
                  : t('oms.orderDetail.billing.invoiceNextActionHint', 'Billing starts here: issue an invoice, then register the payment.')}
              </span>
            </div>
            {visibleIssuedInvoice?.id ? (
              <Link className={s.actionBtn} to={`/main/oms/invoices/${visibleIssuedInvoice.id}`}>
                {t('oms.orderDetail.billing.openInvoice', 'Open invoice')}
              </Link>
            ) : (
              <button type="button" className={s.primaryBtn} onClick={onIssueInvoice} disabled={!canIssueInvoice || issueLoading}>
                {issueLoading ? t('common.loading', 'Loading') : t('oms.actionLabels.issueInvoice', 'Issue invoice')}
              </button>
            )}
          </div>
        </DetailSection>
      ) : null}
      <div className={s.anchorActions}>
        <button type="button" onClick={() => onTab('items')}>{t('oms.orderDetail.actions.openItems', 'Open items')}</button>
        <button type="button" onClick={() => onTab('fulfillment')}>{t('oms.orderDetail.actions.openFulfillment', 'Open fulfillment')}</button>
        <button type="button" onClick={() => onTab('billing')}>{t('oms.orderDetail.actions.openBilling', 'Open billing')}</button>
      </div>
    </div>
  );
}

function ItemsTab({ items, onItemsChange, errors, discountTypeOptions, totals, t, locale, currency, readonly }) {
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.orderDetail.sections.itemsSummary', 'Items summary')}>
        <div className={s.itemRows}>
          {items.map((item) => {
            const line = calculateLine(item);
            return (
              <div key={item.localId || item.id || item.name} className={s.itemRow}>
                <div>
                  <strong>{asText(item.name) || t('oms.orderDetail.items.unnamedLine', 'Unnamed line')}</strong>
                  <span>
                    {t('oms.orderDetail.items.quantityMeta', '{{qty}} pcs', { qty: asNumber(item.qty, 0) })}
                    {' · '}
                    {t('oms.orderDetail.items.taxMeta', 'VAT {{rate}}%', { rate: asNumber(item.taxRate, 0) })}
                  </span>
                </div>
                <MoneyAmount value={line.lineGross} currency={currency} locale={locale} />
              </div>
            );
          })}
        </div>
      </DetailSection>
      <DetailSection title={t('oms.orderDetail.tabs.items', 'Items')}>
        {readonly ? <div className={s.readonlyHint}>{t('oms.orderDetail.readonlyHint', 'Locked orders cannot be edited directly.')}</div> : null}
        <div className={s.proposalEditor}>
          <LineItemsEditor
            lines={items}
            onChange={onItemsChange}
            discountTypeOptions={discountTypeOptions}
            errors={errors}
            productPickerTitle={t('documents.lines.productPickerTitle')}
          />
        </div>
        <div className={s.totalsCrescendo}>
          <div><span>{t('oms.summaryLabels.net')}</span><strong>{formatMoney(totals.net, currency, locale)}</strong></div>
          <div><span>{t('oms.summaryLabels.vat')}</span><strong>{formatMoney(totals.vat, currency, locale)}</strong></div>
          <div className={s.grandTotalLine}><span>{t('oms.summaryLabels.gross')}</span><strong>{formatMoney(totals.gross, currency, locale)}</strong></div>
        </div>
      </DetailSection>
    </div>
  );
}

function FulfillmentSetupCard({
  plan,
  t,
  reserveAction,
  reserveConfirmOpen,
  onOpenReserveConfirm,
  onCloseReserveConfirm,
  onConfirmReserve,
  reserveLoading,
  reserveError,
  reserveSuccess,
}) {
  const nextStep = fulfillmentNextStep(plan, t);
  const stockLineCount = stockTrackedPlanLines(plan).length;
  return (
    <DetailSection title={t('oms.orderDetail.fulfillment.setupCardTitle', 'Fulfillment setup')}>
      <div className={`${s.fulfillmentSetup} ${s[`tone_${fulfillmentTone(plan?.status)}`] || ''}`}>
        <div className={s.fulfillmentSetupMain}>
          <span>{t('oms.orderDetail.fulfillment.setupEyebrow', 'Order fulfillment cabin')}</span>
          <strong>
            {plan?.recommendedWarehouseName
              ? t('oms.orderDetail.fulfillment.recommendedWarehouse', 'Recommended warehouse: {{warehouse}}', { warehouse: plan.recommendedWarehouseName })
              : fulfillmentPlanStatusLabel(plan?.status || 'not_required', t)}
          </strong>
          <p>{fulfillmentSetupMessage(plan, t)}</p>
        </div>
        <div className={s.fulfillmentSetupFacts}>
          <Fact label={t('oms.orderDetail.fulfillment.planMode', 'Fulfillment mode')} value={plan ? fulfillmentPlanModeLabel(plan.mode, t) : '—'} />
          <Fact label={t('oms.orderDetail.fulfillment.status', 'Fulfillment status')} value={plan ? fulfillmentPlanStatusLabel(plan.status, t) : '—'} />
          <Fact label={t('oms.orderDetail.fulfillment.reserveState', 'Reserve state')} value={fulfillmentReserveState(plan, t)} />
          <Fact label={t('oms.orderDetail.fulfillment.shipState', 'Ship state')} value={fulfillmentShipState(plan, t)} />
        </div>
        <div className={`${s.nextStepCard} ${s[`tone_${nextStep.tone}`] || ''}`}>
          <div>
            <strong>{nextStep.title}</strong>
            <span>{nextStep.body}</span>
          </div>
          <button
            type="button"
            className={reserveAction.canRun ? s.primaryBtn : s.actionBtn}
            disabled={!reserveAction.canRun || reserveLoading}
            title={reserveAction.canRun ? t('oms.orderDetail.fulfillment.reserveEnabled', 'Ready to reserve stock.') : reserveAction.reason}
            onClick={reserveAction.canRun ? onOpenReserveConfirm : undefined}
          >
            {reserveLoading ? t('common.loading', 'Loading') : nextStep.action}
          </button>
        </div>
        {!reserveAction.canRun ? (
          <div className={s.reserveHint}>{reserveAction.reason}</div>
        ) : null}
        {reserveConfirmOpen ? (
          <div className={s.reserveConfirm}>
            <div>
              <strong>{t('oms.orderDetail.fulfillment.reserveConfirm.title', 'Reserve stock?')}</strong>
              <span>
                {t(
                  'oms.orderDetail.fulfillment.reserveConfirm.text',
                  'The system will reserve available lines at the recommended warehouse: {{warehouse}}.',
                  { warehouse: plan?.recommendedWarehouseName || '—' }
                )}
              </span>
            </div>
            <div className={s.reserveConfirmFacts}>
              <Fact label={t('oms.orderDetail.fields.warehouse', 'Warehouse')} value={plan?.recommendedWarehouseName || '—'} />
              <Fact label={t('oms.orderDetail.fulfillment.stockTrackedLines', 'Stock-tracked lines')} value={stockLineCount} />
              <Fact label={t('oms.orderDetail.fulfillment.warningsTitle', 'Warnings')} value={Array.isArray(plan?.warnings) ? plan.warnings.length : 0} />
            </div>
            {Array.isArray(plan?.warnings) && plan.warnings.length ? (
              <div className={s.reserveConfirmWarnings}>
                {plan.warnings.map((warning, index) => (
                  <span key={`${warning.code}-${index}`}>{fulfillmentWarningLabel(warning.code, t)}</span>
                ))}
              </div>
            ) : null}
            <div className={s.reserveConfirmActions}>
              <button type="button" className={s.actionBtn} onClick={onCloseReserveConfirm} disabled={reserveLoading}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="button" className={s.primaryBtn} onClick={onConfirmReserve} disabled={reserveLoading}>
                {reserveLoading ? t('common.loading', 'Loading') : t('oms.orderDetail.fulfillment.actions.reserveStock', 'Reserve stock')}
              </button>
            </div>
          </div>
        ) : null}
        {reserveError ? <div className={s.errorBar}>{reserveError}</div> : null}
        {reserveSuccess ? <div className={s.successBar}>{reserveSuccess}</div> : null}
      </div>
    </DetailSection>
  );
}

function FulfillmentWarnings({ warnings, t }) {
  if (!warnings.length) {
    return (
      <div className={`${s.warningCard} ${s.tone_ok}`}>
        <strong>{t('oms.orderDetail.fulfillment.noWarnings', 'No fulfillment warnings.')}</strong>
        <span>{t('oms.orderDetail.fulfillment.noWarningsHint', 'The current read-only plan has no blocking warnings.')}</span>
      </div>
    );
  }
  return (
    <div className={s.warningGrid}>
      {warnings.map((warning, index) => (
        <div key={`${warning.code}-${warning.orderItemId || index}`} className={`${s.warningCard} ${warning.code === 'already_fulfilled' || warning.code === 'reservation_exists' ? s.tone_ok : s.tone_warning}`}>
          <strong>{fulfillmentWarningLabel(warning.code, t)}</strong>
          <span>
            {warning.orderItemId
              ? t('oms.orderDetail.fulfillment.warningLineHint', 'Linked to one order line.')
              : t('oms.orderDetail.fulfillment.warningOrderHint', 'Applies to the whole order.')}
          </span>
        </div>
      ))}
    </div>
  );
}

function WarehouseOptions({ line, t }) {
  const options = Array.isArray(line.warehouseOptions) ? line.warehouseOptions : [];
  if (!options.length) return null;
  return (
    <details className={s.warehouseOptions}>
      <summary>{t('oms.orderDetail.fulfillment.warehouseOptions', 'Availability by warehouse')}</summary>
      <div className={s.warehouseOptionRows}>
        {options.map((option) => (
          <div key={option.warehouseId || option.warehouseName} className={s.warehouseOptionRow}>
            <div>
              <strong>{option.warehouseName || option.warehouseId || '—'}</strong>
              <span>{option.canCoverLine ? t('oms.orderDetail.fulfillment.canCoverLine', 'Can cover line') : t('oms.orderDetail.fulfillment.cannotCoverLine', 'Cannot cover line')}</span>
            </div>
            <div className={s.fulfillmentNumbers}>
              <span><small>{t('oms.orderDetail.fulfillment.onHand', 'On hand')}</small>{asNumber(option.onHandQty, 0)}</span>
              <span><small>{t('oms.orderDetail.fulfillment.reserved', 'Reserved')}</small>{asNumber(option.reservedQty, 0)}</span>
              <span><small>{t('oms.orderDetail.fulfillment.available', 'Available')}</small>{asNumber(option.availableQty, 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function FulfillmentAvailabilityLine({ line, t }) {
  const statusKey = fulfillmentLineStatusKey(line.status);
  const isService = statusKey === 'not_stock_tracked';
  return (
    <div className={s.fulfillmentLine}>
      <div className={s.fulfillmentLineHeader}>
        <div>
          <strong>{line.name || line.sku || line.productId || t('oms.orderDetail.items.unnamedLine', 'Unnamed line')}</strong>
          <span>
            {line.sku ? `${line.sku} · ` : ''}
            {isService
              ? t('oms.orderDetail.fulfillment.noStockTracking', 'Does not require warehouse')
              : (line.recommendedWarehouseName || t('oms.orderDetail.fulfillment.noRecommendedWarehouse', 'No recommended warehouse'))}
          </span>
        </div>
        <span className={`${s.statusBadge} ${s[`tone_${fulfillmentTone(statusKey)}`] || ''}`}>
          {fulfillmentPlanStatusLabel(statusKey, t)}
        </span>
      </div>
      <div className={s.fulfillmentNumbers}>
        <span><small>{t('oms.orderDetail.fulfillment.required', 'Required')}</small>{asNumber(line.requiredQty, 0)}</span>
        <span><small>{t('oms.orderDetail.fulfillment.available', 'Available')}</small>{isService ? '—' : asNumber(line.availableQty, 0)}</span>
        <span><small>{t('oms.orderDetail.fulfillment.reserved', 'Reserved')}</small>{asNumber(line.reservedQty, 0)}</span>
        <span><small>{t('oms.orderDetail.fulfillment.fulfilled', 'Fulfilled')}</small>{asNumber(line.fulfilledQty, 0)}</span>
        <span><small>{t('oms.orderDetail.fulfillment.shortage', 'Shortage')}</small>{asNumber(line.shortageQty, 0)}</span>
      </div>
      {!isService ? <WarehouseOptions line={line} t={t} /> : null}
    </div>
  );
}

function FulfillmentTab({ order, t, locale }) {
  const shipments = Array.isArray(order?.shipments) ? order.shipments : [];
  const reservations = Array.isArray(order?.reservations) ? order.reservations : [];
  const plan = order?.fulfillmentPlan || null;
  const planLines = Array.isArray(plan?.lines) ? plan.lines : [];
  const planWarnings = Array.isArray(plan?.warnings) ? plan.warnings : [];
  const warehouseName = order?.warehouse?.name || order?.warehouseName || '';
  const deliveryAddress = order?.shippingAddressSnapshot || order?.deliveryAddressSnapshot || '';
  const [reserveOrder, { isLoading: reserveLoading }] = useReserveOrderMutation();
  const [reserveConfirmOpen, setReserveConfirmOpen] = useState(false);
  const [reserveError, setReserveError] = useState('');
  const [reserveSuccess, setReserveSuccess] = useState('');
  const reserveAction = fulfillmentReserveActionState(plan, t);

  const handleOpenReserveConfirm = useCallback(() => {
    if (!reserveAction.canRun) return;
    setReserveError('');
    setReserveSuccess('');
    setReserveConfirmOpen(true);
  }, [reserveAction.canRun]);

  const handleConfirmReserve = useCallback(async () => {
    if (!order?.id || !reserveAction.canRun) return;
    setReserveError('');
    setReserveSuccess('');
    try {
      await reserveOrder({ id: order.id, payload: {} }).unwrap();
      setReserveConfirmOpen(false);
      setReserveSuccess(t('oms.orderDetail.fulfillment.reserveSuccess', 'Stock reserved for this order.'));
    } catch (error) {
      setReserveError(getReserveOrderErrorText(error, t));
    }
  }, [order?.id, reserveAction.canRun, reserveOrder, t]);

  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.orderDetail.fulfillment.status', 'Fulfillment status')} value={statusLabel(order?.fulfillmentStatus || 'unfulfilled', t)} />
        <Fact label={t('oms.orderDetail.fields.warehouse', 'Warehouse')} value={plan?.recommendedWarehouseName || warehouseName || '—'} />
        <Fact label={t('oms.orderDetail.fields.shipTo', 'Ship-to address')} value={deliveryAddress || '—'} />
        <Fact
          label={t('oms.orderDetail.fulfillment.nextStep', 'Next step')}
          value={plan ? fulfillmentPlanStatusLabel(plan.status, t) : (shipments.length ? t('oms.orderDetail.fulfillment.trackShipment', 'Track shipment') : t('oms.orderDetail.fulfillment.setupNext', 'Set up fulfillment'))}
        />
        <Fact label={t('oms.orderDetail.fulfillment.lifecycle', 'Lifecycle status')} value={statusLabel(order?.status || 'draft', t)} />
        <Fact label={t('oms.orderDetail.fulfillment.planMode', 'Fulfillment mode')} value={plan ? fulfillmentPlanModeLabel(plan.mode, t) : '—'} />
        <Fact label={t('oms.orderDetail.fulfillment.shippedAt', 'Shipped at')} value={formatDateTime(order?.statusMetadata?.shippedAt, locale)} />
        <Fact label={t('oms.orderDetail.fulfillment.completedAt', 'Completed at')} value={formatDateTime(order?.statusMetadata?.completedAt, locale)} />
      </div>
      {plan ? (
        <>
          <FulfillmentSetupCard
            plan={plan}
            t={t}
            reserveAction={reserveAction}
            reserveConfirmOpen={reserveConfirmOpen}
            onOpenReserveConfirm={handleOpenReserveConfirm}
            onCloseReserveConfirm={() => setReserveConfirmOpen(false)}
            onConfirmReserve={handleConfirmReserve}
            reserveLoading={reserveLoading}
            reserveError={reserveError}
            reserveSuccess={reserveSuccess}
          />
          <DetailSection title={t('oms.orderDetail.fulfillment.warningsTitle', 'Warnings')}>
            <FulfillmentWarnings warnings={planWarnings} t={t} />
          </DetailSection>
          <DetailSection title={t('oms.orderDetail.fulfillment.availabilityTitle', 'Availability')}>
            {planLines.length ? (
              <div className={s.fulfillmentLines}>
                {planLines.map((line) => (
                  <FulfillmentAvailabilityLine
                    key={line.orderItemId || `${line.productId}-${line.name}`}
                    line={line}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>{t('oms.orderDetail.fulfillment.noPlanLines', 'This order does not require warehouse fulfillment.')}</EmptyState>
            )}
          </DetailSection>
        </>
      ) : (
        <DetailSection title={t('oms.orderDetail.fulfillment.setupCardTitle', 'Fulfillment setup')}>
          <EmptyState>{t('oms.orderDetail.fulfillment.planUnavailable', 'Fulfillment plan is not available for this order.')}</EmptyState>
        </DetailSection>
      )}
      <DetailSection title={t('oms.orderDetail.fulfillment.shipments', 'Shipments')}>
        {shipments.length ? (
          <div className={s.itemRows}>
            {shipments.map((shipment) => (
              <div key={shipment.id} className={s.itemRow}>
                <div>
                  <strong>{shipment.number || shipment.id}</strong>
                  <span>
                    {statusLabel(shipment.status, t)}
                    {shipment.warehouse?.name ? ` · ${shipment.warehouse.name}` : ''}
                    {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
                  </span>
                </div>
                <span>{formatDateTime(shipment.shippedAt || shipment.createdAt, locale)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.orderDetail.fulfillment.noShipments', 'Shipment details are not exposed by the current order DTO yet.')}</EmptyState>
        )}
      </DetailSection>
      <DetailSection title={t('oms.orderDetail.fulfillment.reservations', 'Reservations')}>
        {reservations.length ? (
          <div className={s.itemRows}>
            {reservations.map((reservation) => (
              <div key={reservation.id} className={s.itemRow}>
                <div>
                  <strong>{reservation.product?.name || reservation.productId || reservation.id}</strong>
                  <span>
                    {statusLabel(reservation.status, t)}
                    {reservation.warehouse?.name ? ` · ${reservation.warehouse.name}` : ''}
                  </span>
                </div>
                <span>{asNumber(reservation.qty, 0)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.orderDetail.fulfillment.noReservations', 'Reservation details will appear here when WMS exposes them for this order.')}</EmptyState>
        )}
      </DetailSection>
    </div>
  );
}

function BillingTab({
  order,
  invoices,
  paidAmount,
  dueAmount,
  t,
  locale,
  currency,
  canIssueInvoice,
  issueLoading,
  issuedInvoice,
  onIssueInvoice,
}) {
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const creditNotes = Array.isArray(order?.creditNotes) ? order.creditNotes : [];
  const visibleIssuedInvoice = issuedInvoice || invoices[0] || null;
  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.orderDetail.billing.paymentStatus', 'Payment status')} value={statusLabel(order?.paymentStatus || 'pending', t)} />
        <Fact label={t('oms.orderDetail.billing.amountPaid', 'Amount paid')} value={formatMoney(paidAmount, currency, locale)} />
        <Fact label={t('oms.orderDetail.billing.amountDue', 'Amount due')} value={formatMoney(dueAmount, currency, locale)} />
        <Fact label={t('oms.orderDetail.billing.invoicesCount', 'Invoices')} value={String(invoices.length)} />
      </div>
      {(canIssueInvoice || visibleIssuedInvoice) ? (
        <DetailSection title={t('oms.orderDetail.billing.issueInvoiceTitle', 'Issue invoice')}>
          <div className={s.nextStepCard}>
            <div>
              <strong>{visibleIssuedInvoice ? t('oms.orderDetail.billing.invoiceReady', 'Invoice is ready') : t('oms.orderDetail.billing.invoiceNextAction', 'Create the invoice for this order')}</strong>
              <span>
                {visibleIssuedInvoice
                  ? t('oms.orderDetail.billing.invoiceReadyHint', 'Open the created invoice or continue with payments.')
                  : t('oms.orderDetail.billing.issueInvoiceHint', 'This creates an invoice from the current order totals and refreshes billing immediately.')}
              </span>
            </div>
            {visibleIssuedInvoice?.id ? (
              <Link className={s.actionBtn} to={`/main/oms/invoices/${visibleIssuedInvoice.id}`}>
                {t('oms.orderDetail.billing.openInvoice', 'Open invoice')}
              </Link>
            ) : (
              <button type="button" className={s.primaryBtn} onClick={onIssueInvoice} disabled={!canIssueInvoice || issueLoading}>
                {issueLoading ? t('common.loading', 'Loading') : t('oms.actionLabels.issueInvoice', 'Issue invoice')}
              </button>
            )}
          </div>
        </DetailSection>
      ) : null}
      <DetailSection title={t('oms.orderDetail.billing.invoices', 'Invoices')}>
        {invoices.length ? (
          <div className={s.chain}>
            {invoices.map((invoice) => (
              <Link key={invoice.id} to={`/main/oms/invoices/${invoice.id}`}>
                {invoice.number || invoice.id} · {formatMoney(invoice.totalGross, invoice.currencyCode || currency, locale)}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.orderDetail.billing.noInvoices', 'No invoices yet.')}</EmptyState>
        )}
      </DetailSection>
      <DetailSection title={t('oms.orderDetail.billing.payments', 'Payments')}>
        {payments.length ? (
          <div className={s.itemRows}>
            {payments.map((payment) => (
              <div key={payment.id} className={s.itemRow}>
                <div>
                  <strong>
                    <Link to={`/main/oms/payments/${payment.id}${order?.id ? `?orderId=${encodeURIComponent(order.id)}` : ''}`}>
                      {payment.reference || statusLabel(payment.status, t)}
                    </Link>
                  </strong>
                  <span>
                    {paymentMethodLabel(payment.method, t)}
                    {' · '}
                    {formatDateTime(payment.paidAt || payment.createdAt, locale)}
                  </span>
                </div>
                <MoneyAmount value={payment.amount} currency={payment.currencyCode || payment.currency || currency} locale={locale} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.orderDetail.billing.noPayments', 'Payment details are not exposed by the current order DTO yet.')}</EmptyState>
        )}
      </DetailSection>
      <DetailSection title={t('oms.orderDetail.billing.creditNotes', 'Credit notes')}>
        {creditNotes.length ? (
          <div className={s.itemRows}>
            {creditNotes.map((creditNote) => (
              <div key={creditNote.id} className={s.itemRow}>
                <div>
                  <strong>{creditNote.number || creditNote.id}</strong>
                  <span>{creditNote.reason || statusLabel(creditNote.status, t)}</span>
                </div>
                <MoneyAmount value={creditNote.amountGross ?? creditNote.amount} currency={creditNote.currencyCode || creditNote.currency || currency} locale={locale} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.orderDetail.billing.noCreditNotes', 'No credit notes yet.')}</EmptyState>
        )}
      </DetailSection>
    </div>
  );
}

function ActivityTab({ order, t, locale }) {
  const {
    data: timelineData,
    isFetching,
    isError,
  } = useListEntityTimelineQuery(
    { entityType: 'order', entityId: order?.id, limit: 30 },
    { skip: !order?.id }
  );
  const events = useMemo(
    () => (Array.isArray(timelineData?.items) ? timelineData.items.map((event) => localizeOrderTimelineEvent(event, t)) : []),
    [t, timelineData]
  );

  return (
    <DetailSection title={t('oms.orderDetail.tabs.activity', 'Activity')}>
      <EntityTimeline
        events={events}
        loading={isFetching}
        error={isError}
        formatDate={(value) => formatDateTime(value, locale)}
        loadingText={t('oms.orderDetail.activity.loading', 'Loading activity')}
        errorTitle={t('oms.orderDetail.activity.errorTitle', 'Activity is unavailable')}
        errorText={t('oms.orderDetail.activity.errorText', 'Could not load order activity.')}
        emptyTitle={t('oms.orderDetail.activity.emptyTitle', 'No activity yet')}
        emptyText={t('oms.orderDetail.activity.emptyText', 'Order activity will appear here after business actions.')}
      />
    </DetailSection>
  );
}

function SystemTab({ order, t, locale }) {
  return (
    <div className={s.systemGrid}>
      <Fact label="ID" value={order?.id || '—'} />
      <Fact label={t('oms.orderDetail.hero.orderNumberEyebrow', 'Order')} value={order?.number || '—'} />
      <Fact label={t('oms.detailLabels.status')} value={statusLabel(order?.status, t)} />
      <Fact label={t('oms.detailLabels.paymentStatus')} value={statusLabel(order?.paymentStatus, t)} />
      <Fact label={t('oms.detailLabels.fulfillmentStatus')} value={statusLabel(order?.fulfillmentStatus, t)} />
      <Fact label={t('oms.orderDetail.system.createdBy', 'Created by')} value={userName(order?.createdByUser)} />
      <Fact label={t('oms.orderDetail.system.updatedBy', 'Updated by')} value={userName(order?.updatedByUser)} />
      <Fact label={t('common.createdAt', 'Created at')} value={formatDateTime(order?.createdAt, locale)} />
      <Fact label={t('common.updatedAt', 'Updated at')} value={formatDateTime(order?.updatedAt, locale)} />
    </div>
  );
}
