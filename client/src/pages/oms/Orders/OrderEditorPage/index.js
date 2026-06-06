import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEditor from '../../../../components/documents/DocumentEditor';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import {
  asNumber,
  asText,
  calculateTotals,
  createEmptyItem,
  mapLinesToPayload,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import { formatMoney } from '../../../../lib/format';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useCreateOrderMutation,
  useGetOrderByIdQuery,
  useGetOrderMetaQuery,
  useSaveOrderItemsMutation,
  useUpdateOrderMutation,
} from '../../../../store/rtk/ordersApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsByCounterpartyQuery } from '../../../../store/rtk/contactsApi';
import { useListCompanyUsersQuery } from '../../../../store/rtk/companyUsersApi';

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

export default function OrderEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { can } = useAclPermissions();
  const canReadOrder = can('order:read');
  const canCreateOrder = can('order:create');
  const canUpdateOrder = can('order:update');

  const [form, setForm] = useState({
    counterpartyId: '',
    contactId: '',
    ownerId: '',
    currencyCode: 'PLN',
    placedAt: '',
    notes: '',
    paymentTerms: '',
    deliveryTerms: '',
    leadTime: '',
  });
  const [items, setItems] = useState([createEmptyItem()]);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [initialized, setInitialized] = useState(!isEdit);

  const { data: order, isLoading: isOrderLoading, isError: isOrderError, error: orderError } = useGetOrderByIdQuery(id, {
    skip: !isEdit,
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

  useEffect(() => {
    if (!isEdit || initialized || !order) return;

    setForm({
      counterpartyId: order.counterpartyId || order.customerId || order.counterparty?.id || '',
      contactId: order.contactId || order.contact?.id || '',
      ownerId: order.ownerId || order.owner?.id || '',
      currencyCode: order.currencyCode || order.currency || 'PLN',
      placedAt: asText(order.placedAt).slice(0, 10),
      notes: order.notes || '',
      paymentTerms: order.paymentTerms || '',
      deliveryTerms: order.deliveryTerms || '',
      leadTime: order.leadTime || '',
    });

    const mappedItems = Array.isArray(order.items) && order.items.length
      ? normalizeItemSortOrder(sortItemsBySortOrder(order.items).map(toEditorItem))
      : normalizeItemSortOrder([createEmptyItem()]);
    setItems(mappedItems);
    setInitialized(true);
  }, [isEdit, initialized, order]);

  const counterpartyOptions = useMemo(() => {
    const rows = counterpartiesData?.items || [];
    return [
      { value: '', label: t('documents.editor.selectCounterparty') },
      ...rows.map((row) => ({ value: row.id, label: row.shortName || row.fullName || row.name || row.id })),
    ];
  }, [counterpartiesData, t]);

  const contactOptions = useMemo(() => {
    const rows = contactsData?.items || [];
    return [
      { value: '', label: t('documents.editor.noContact') },
      ...rows.map((row) => ({
        value: row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.id,
      })),
    ];
  }, [contactsData, t]);

  const ownerOptions = useMemo(() => {
    const rows = ownersData?.items || [];
    return [
      { value: '', label: t('documents.editor.noOwner') },
      ...rows.map((row) => ({
        value: row.userId || row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.userId || row.id,
      })),
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

  const totals = useMemo(() => calculateTotals(items), [items]);
  const isSaving = isCreating || isUpdating || isSavingItems;
  const currency = form.currencyCode || 'PLN';

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const dateLocale = i18n.language === 'pl' ? 'pl-PL' : 'ru-RU';

  const fields = [
    {
      name: 'counterpartyId',
      label: t('oms.detailLabels.counterparty'),
      type: 'select',
      value: form.counterpartyId,
      onChange: (value) => { setField('counterpartyId', value); setField('contactId', ''); },
      options: counterpartyOptions,
      placeholder: t('documents.editor.selectCounterparty'),
      required: true,
      error: errors.counterpartyId,
    },
    { name: 'contactId', label: t('oms.detailLabels.contact'), type: 'select', value: form.contactId, onChange: (v) => setField('contactId', v), options: contactOptions, placeholder: t('documents.editor.noContact') },
    { name: 'ownerId', label: t('oms.detailLabels.owner'), type: 'select', value: form.ownerId, onChange: (v) => setField('ownerId', v), options: ownerOptions, placeholder: t('documents.editor.noOwner') },
    { name: 'currencyCode', label: t('oms.summaryLabels.currency'), type: 'select', value: form.currencyCode, onChange: (v) => setField('currencyCode', v), options: currencyOptions, placeholder: t('documents.editor.selectCurrency') },
    { name: 'placedAt', label: t('oms.detailLabels.placedAt'), type: 'date', value: form.placedAt, onChange: (v) => setField('placedAt', v), withTime: false, locale: dateLocale },
    { name: 'leadTime', label: t('oms.detailLabels.leadTime'), type: 'text', value: form.leadTime, onChange: (v) => setField('leadTime', v) },
    { name: 'paymentTerms', label: t('oms.detailLabels.paymentTerms'), type: 'text', value: form.paymentTerms, onChange: (v) => setField('paymentTerms', v) },
    { name: 'deliveryTerms', label: t('oms.detailLabels.deliveryTerms'), type: 'text', value: form.deliveryTerms, onChange: (v) => setField('deliveryTerms', v) },
    { name: 'notes', label: t('oms.detailLabels.notes'), type: 'textarea', value: form.notes, onChange: (v) => setField('notes', v), colSpan: 2 },
  ];

  const summary = [
    { label: t('oms.summaryLabels.net'), value: formatMoney(totals.net, currency, i18n.language) },
    { label: t('oms.summaryLabels.vat'), value: formatMoney(totals.vat, currency, i18n.language) },
    { label: t('oms.summaryLabels.gross'), value: formatMoney(totals.gross, currency, i18n.language), strong: true },
    { label: t('oms.summaryLabels.currency'), value: currency, strong: true },
  ];

  const validate = () => {
    const nextErrors = {};
    if (!form.counterpartyId) nextErrors.counterpartyId = t('documents.editor.validation.counterpartyRequired');
    items.forEach((item) => {
      if (!asText(item.name)) nextErrors[`item:${item.localId}:name`] = t('documents.editor.validation.itemNameRequired');
      if (asNumber(item.qty, 0) <= 0) nextErrors[`item:${item.localId}:qty`] = t('documents.editor.validation.qtyPositive');
      if (asNumber(item.priceNet, -1) < 0) nextErrors[`item:${item.localId}:priceNet`] = t('documents.editor.validation.priceNonNegative');
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildHeaderPayload = () => ({
    counterpartyId: form.counterpartyId,
    contactId: form.contactId || null,
    ownerId: form.ownerId || null,
    currencyCode: asText(form.currencyCode).toUpperCase() || 'PLN',
    placedAt: form.placedAt || null,
    notes: form.notes || '',
    paymentTerms: form.paymentTerms || '',
    deliveryTerms: form.deliveryTerms || '',
    leadTime: form.leadTime || '',
  });

  const onSave = async () => {
    setSaveError('');
    if (!validate()) return;

    const headerPayload = buildHeaderPayload();
    const itemsPayload = mapLinesToPayload(items);

    try {
      if (isEdit) {
        await updateOrder({ id, payload: headerPayload }).unwrap();
        await saveOrderItems({ id, items: itemsPayload }).unwrap();
        navigate(`/main/oms/orders/${id}`);
        return;
      }

      const created = await createOrder({ ...headerPayload, items: itemsPayload }).unwrap();
      const createdId = created?.id || created?.data?.id;
      navigate(createdId ? `/main/oms/orders/${createdId}` : '/main/oms/orders');
    } catch (error) {
      setSaveError(getErrorText(error, t('documents.editor.saveFailed')));
    }
  };

  if (isEdit && isOrderLoading) {
    return <DocumentEditor.State title={t('common.loading')} text={t('documents.editor.loadingHint')} />;
  }
  if ((isEdit && !canReadOrder) || (isEdit && !canUpdateOrder) || (!isEdit && !canCreateOrder)) {
    return <DocumentEditor.State title={t('documents.editor.noPermission')} text={t('documents.editor.noPermissionHint')} />;
  }
  if (isEdit && isOrderError) {
    return <DocumentEditor.State title={t('documents.editor.loadFailed')} text={getErrorText(orderError, t('documents.editor.loadFailed'))} />;
  }
  if (isEdit && !order) {
    return <DocumentEditor.State title={t('documents.editor.notFound')} text={t('documents.editor.notFoundHint')} />;
  }

  const actions = [
    {
      key: 'cancel',
      label: t('common.cancel'),
      variant: 'secondary',
      disabled: isSaving,
      onClick: () => navigate(isEdit ? `/main/oms/orders/${id}` : '/main/oms/orders'),
    },
    {
      key: 'save',
      label: isSaving ? t('common.saving') : t('common.save'),
      variant: 'primary',
      loading: isSaving,
      disabled: isSaving || (isEdit ? !canUpdateOrder : !canCreateOrder),
      onClick: onSave,
    },
  ];

  return (
    <DocumentEditor
      documentType={t('documents.types.order')}
      mode={isEdit ? 'edit' : 'create'}
      title={isEdit ? t('oms.orders.editTitle') : t('oms.orders.newTitle')}
      number={isEdit ? (order?.number || order?.id) : t('common.new')}
      status={isEdit ? order?.status : undefined}
      breadcrumbs={[
        { label: t('menu.orders'), to: '/main/oms/orders' },
        { label: isEdit ? (order?.number || order?.id) : t('common.new') },
      ]}
      actions={actions}
      fields={fields}
      fieldsTitle={t('documents.editor.header')}
      summary={summary}
      summaryTitle={t('documents.editor.summaryTitle')}
      error={saveError}
    >
      <LineItemsEditor
        lines={items}
        onChange={setItems}
        discountTypeOptions={discountTypeOptions}
        errors={errors}
        productPickerTitle={t('documents.lines.productPickerTitle')}
      />
    </DocumentEditor>
  );
}
