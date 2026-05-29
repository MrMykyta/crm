import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ThemedSelect from '../../../../components/inputs/RadixSelect';
import DateTimePicker from '../../../../components/inputs/DateTimePicker';
import OmsProductPicker from '../../../../components/oms/OmsProductPicker';
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
import s from './OrderEditorPage.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatMoney(value, currency = 'PLN', locale = 'en') {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value, 0))} ${currency}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem() {
  return {
    localId: uid(),
    id: null,
    productId: null,
    variantId: null,
    unitId: null,
    uomId: null,
    skuSnapshot: '',
    name: '',
    descriptionSnapshot: '',
    unitSnapshot: '',
    vatRateSnapshot: '23',
    productTypeSnapshot: '',
    metadataSnapshot: null,
    qty: '1',
    priceNet: '0',
    taxRate: '23',
    discountType: 'none',
    discountValue: '0',
    isCustomLine: true,
  };
}

function createProductItem(product) {
  const unitSnapshot = asText(
    product?.uom?.symbol
    || product?.uom?.code
    || product?.uom?.name
    || product?.unit
  );
  const vatRate = asNumber(product?.taxCategory?.rate ?? product?.vatRate ?? product?.taxRate, 0);
  const netPrice = asNumber(product?.price ?? product?.netPrice ?? product?.salePrice, 0);
  const variantId = product?.variantId || product?.defaultVariantId || product?.defaultVariant?.id || null;

  return {
    localId: uid(),
    id: null,
    productId: product?.id || null,
    variantId,
    unitId: product?.uom?.id || null,
    uomId: product?.uom?.id || null,
    skuSnapshot: asText(product?.sku),
    name: asText(product?.name),
    descriptionSnapshot: asText(product?.description),
    unitSnapshot,
    vatRateSnapshot: String(vatRate),
    productTypeSnapshot: asText(product?.type?.code || product?.type?.name),
    metadataSnapshot: product?.metadata || product?.meta || null,
    qty: '1',
    priceNet: String(netPrice),
    taxRate: String(vatRate),
    discountType: 'none',
    discountValue: '0',
    isCustomLine: false,
  };
}

function calculateLine(item) {
  const qty = Math.max(0, asNumber(item.qty, 0));
  const priceNet = Math.max(0, asNumber(item.priceNet, 0));
  const taxRate = Math.max(0, asNumber(item.taxRate, 0));
  const discountValue = Math.max(0, asNumber(item.discountValue, 0));

  const baseNet = qty * priceNet;

  let discountAmount = 0;
  if (item.discountType === 'fixed') {
    discountAmount = Math.min(discountValue, baseNet);
  } else if (item.discountType === 'percent') {
    discountAmount = baseNet * (discountValue / 100);
  }

  const lineNet = Math.max(0, baseNet - discountAmount);
  const lineVat = lineNet * (taxRate / 100);
  const lineGross = lineNet + lineVat;

  return {
    lineNet: roundMoney(lineNet),
    lineVat: roundMoney(lineVat),
    lineGross: roundMoney(lineGross),
  };
}

function calculateTotals(items = []) {
  return items.reduce((acc, item) => {
    const line = calculateLine(item);
    acc.net += line.lineNet;
    acc.vat += line.lineVat;
    acc.gross += line.lineGross;
    return acc;
  }, { net: 0, vat: 0, gross: 0 });
}

function getErrorText(error, fallback = 'Failed to save order') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function toEditorItem(item) {
  return {
    localId: uid(),
    id: item?.id || null,
    productId: item?.productId || item?.product?.id || null,
    variantId: item?.variantId || null,
    unitId: item?.unitId || item?.uomId || item?.unit?.id || null,
    uomId: item?.uomId || item?.unitId || item?.unit?.id || null,
    skuSnapshot: item?.skuSnapshot || item?.sku || item?.product?.sku || '',
    name: item?.nameSnapshot || item?.name || item?.product?.name || '',
    descriptionSnapshot: item?.descriptionSnapshot || item?.description || '',
    unitSnapshot: item?.unitSnapshot || item?.unit?.symbol || item?.unit?.code || item?.unit?.name || '',
    vatRateSnapshot: String(item?.vatRateSnapshot ?? item?.vatRate ?? item?.taxRate ?? '0'),
    productTypeSnapshot: item?.productTypeSnapshot || '',
    metadataSnapshot: item?.metadataSnapshot || null,
    qty: String(item?.qty ?? item?.quantity ?? '1'),
    priceNet: String(item?.priceNet ?? item?.unitPriceNet ?? '0'),
    taxRate: String(item?.vatRateSnapshot ?? item?.vatRate ?? item?.taxRate ?? '0'),
    discountType: item?.discountType || 'none',
    discountValue: String(item?.discountValue ?? '0'),
    isCustomLine: item?.isCustomLine !== undefined ? Boolean(item?.isCustomLine) : !item?.productId,
  };
}

export default function OrderEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
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
  const [isProductPickerOpen, setProductPickerOpen] = useState(false);

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
      ? order.items.map(toEditorItem)
      : [createEmptyItem()];
    setItems(mappedItems);
    setInitialized(true);
  }, [isEdit, initialized, order]);

  const counterpartyOptions = useMemo(() => {
    const rows = counterpartiesData?.items || [];
    return [
      { value: '', label: 'Select counterparty' },
      ...rows.map((row) => ({
        value: row.id,
        label: row.shortName || row.fullName || row.name || row.id,
      })),
    ];
  }, [counterpartiesData]);

  const contactOptions = useMemo(() => {
    const rows = contactsData?.items || [];
    return [
      { value: '', label: 'No contact' },
      ...rows.map((row) => ({
        value: row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.id,
      })),
    ];
  }, [contactsData]);

  const ownerOptions = useMemo(() => {
    const rows = ownersData?.items || [];
    return [
      { value: '', label: 'No owner' },
      ...rows.map((row) => ({
        value: row.userId || row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.userId || row.id,
      })),
    ];
  }, [ownersData]);

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

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setItemField = (localId, key, value) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, [key]: value } : item)));
    setErrors((prev) => ({ ...prev, [`item:${localId}:${key}`]: undefined }));
  };

  const addCustomItem = () => setItems((prev) => [...prev, createEmptyItem()]);

  const addProductItem = (product) => {
    setItems((prev) => [...prev, createProductItem(product)]);
    setProductPickerOpen(false);
  };

  const removeItem = (localId) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.localId !== localId);
      return next.length ? next : [createEmptyItem()];
    });
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.counterpartyId) {
      nextErrors.counterpartyId = 'Counterparty is required';
    }

    items.forEach((item) => {
      if (!asText(item.name)) {
        nextErrors[`item:${item.localId}:name`] = 'Item name is required';
      }
      if (asNumber(item.qty, 0) <= 0) {
        nextErrors[`item:${item.localId}:qty`] = 'Qty must be greater than 0';
      }
      if (asNumber(item.priceNet, -1) < 0) {
        nextErrors[`item:${item.localId}:priceNet`] = 'Price must be non-negative';
      }
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

  const buildItemsPayload = () => items.map((item, index) => ({
    id: item.id || undefined,
    sortOrder: index,
    productId: item.productId || null,
    variantId: item.variantId || null,
    unitId: item.unitId || item.uomId || null,
    uomId: item.uomId || item.unitId || null,
    skuSnapshot: asText(item.skuSnapshot) || null,
    nameSnapshot: asText(item.name),
    descriptionSnapshot: asText(item.descriptionSnapshot) || null,
    unitSnapshot: asText(item.unitSnapshot) || null,
    vatRateSnapshot: asNumber(item.vatRateSnapshot, asNumber(item.taxRate, 0)),
    productTypeSnapshot: asText(item.productTypeSnapshot) || null,
    metadataSnapshot: item.metadataSnapshot || null,
    quantity: asNumber(item.qty, 0),
    unitPriceNet: asNumber(item.priceNet, 0),
    taxRate: asNumber(item.taxRate, 0),
    vatRate: asNumber(item.taxRate, 0),
    discountType: item.discountType || 'none',
    discountValue: asNumber(item.discountValue, 0),
    isCustomLine: Boolean(item.isCustomLine),
  }));

  const onSave = async () => {
    setSaveError('');
    if (!validate()) return;

    const headerPayload = buildHeaderPayload();
    const itemsPayload = buildItemsPayload();

    try {
      if (isEdit) {
        await updateOrder({ id, payload: headerPayload }).unwrap();
        await saveOrderItems({ id, items: itemsPayload }).unwrap();
        navigate(`/main/oms/orders/${id}`);
        return;
      }

      const created = await createOrder({ ...headerPayload, items: itemsPayload }).unwrap();
      const createdId = created?.id || created?.data?.id;
      if (createdId) {
        navigate(`/main/oms/orders/${createdId}`);
        return;
      }
      navigate('/main/oms/orders');
    } catch (error) {
      setSaveError(getErrorText(error));
    }
  };

  if (isEdit && isOrderLoading) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Loading order...</h2>
          <p className={s.stateText}>Preparing order editor.</p>
        </section>
      </div>
    );
  }

  if ((isEdit && !canReadOrder) || (isEdit && !canUpdateOrder) || (!isEdit && !canCreateOrder)) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>No permission</h2>
          <p className={s.stateText}>You do not have enough permissions to access order editor.</p>
        </section>
      </div>
    );
  }

  if (isEdit && isOrderError) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Failed to load order</h2>
          <p className={s.stateText}>{getErrorText(orderError, 'Failed to load order')}</p>
        </section>
      </div>
    );
  }

  if (isEdit && !order) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Order not found</h2>
          <p className={s.stateText}>No order data available in current company scope.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <section className={s.mainCard}>
          <div className={s.header}>
            <div>
              <h1 className={s.title}>{isEdit ? 'Edit order' : 'New order'}</h1>
              <p className={s.subtle}>{isEdit ? (order?.number || order?.id) : 'Create order'}</p>
            </div>
            <div className={s.headerActions}>
              <button
                type="button"
                className={s.button}
                onClick={() => navigate(isEdit ? `/main/oms/orders/${id}` : '/main/oms/orders')}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button type="button" className={s.primaryButton} onClick={onSave} disabled={isSaving || (isEdit ? !canUpdateOrder : !canCreateOrder)}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {saveError ? <div className={s.errorBanner}>{saveError}</div> : null}

          <div className={s.section}>
            <h2 className={s.sectionTitle}>Header</h2>
            <div className={s.grid}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Counterparty *</label>
                <ThemedSelect
                  value={form.counterpartyId}
                  onChange={(value) => {
                    setField('counterpartyId', value);
                    setField('contactId', '');
                  }}
                  options={counterpartyOptions}
                  placeholder="Select counterparty"
                />
                {errors.counterpartyId ? <span className={s.fieldError}>{errors.counterpartyId}</span> : null}
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Contact</label>
                <ThemedSelect
                  value={form.contactId}
                  onChange={(value) => setField('contactId', value)}
                  options={contactOptions}
                  placeholder="Select contact"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Owner</label>
                <ThemedSelect
                  value={form.ownerId}
                  onChange={(value) => setField('ownerId', value)}
                  options={ownerOptions}
                  placeholder="Select owner"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Currency</label>
                <ThemedSelect
                  value={form.currencyCode}
                  onChange={(value) => setField('currencyCode', value)}
                  options={currencyOptions}
                  placeholder="Select currency"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Placed at</label>
                <DateTimePicker
                  value={form.placedAt}
                  onChange={(value) => setField('placedAt', value)}
                  withTime={false}
                  locale={i18n.language === 'pl' ? 'pl-PL' : 'ru-RU'}
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Lead time</label>
                <input
                  className={s.input}
                  value={form.leadTime}
                  onChange={(event) => setField('leadTime', event.target.value)}
                  placeholder="e.g. 5 days"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Payment terms</label>
                <input
                  className={s.input}
                  value={form.paymentTerms}
                  onChange={(event) => setField('paymentTerms', event.target.value)}
                  placeholder="e.g. 14 days"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Delivery terms</label>
                <input
                  className={s.input}
                  value={form.deliveryTerms}
                  onChange={(event) => setField('deliveryTerms', event.target.value)}
                  placeholder="Delivery terms"
                />
              </div>
            </div>

            <div className={s.field} style={{ marginTop: 10 }}>
              <label className={s.fieldLabel}>Notes</label>
              <textarea
                className={s.textarea}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
                placeholder="Order notes"
              />
            </div>
          </div>

          <div className={s.section}>
            <div className={s.itemsHeader}>
              <h2 className={s.sectionTitle}>Items</h2>
              <div className={s.itemsActions}>
                <button type="button" className={s.addRowButton} onClick={addCustomItem}>
                  Dodaj pozycję własną / Add custom line
                </button>
                <button type="button" className={s.addRowButton} onClick={() => setProductPickerOpen(true)}>
                  Dodaj produkt / Add product
                </button>
              </div>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Name *</th>
                    <th>Qty</th>
                    <th>Price net</th>
                    <th>Tax rate %</th>
                    <th>Discount type</th>
                    <th>Discount value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.localId}>
                      <td>
                        <input
                          className={s.input}
                          value={item.name}
                          onChange={(event) => setItemField(item.localId, 'name', event.target.value)}
                          placeholder={item.productId ? 'Product name' : 'Custom line name'}
                        />
                        {item.productId ? (
                          <div className={s.itemMeta}>
                            {item.skuSnapshot ? `SKU: ${item.skuSnapshot}` : 'Product item'}
                          </div>
                        ) : null}
                        {errors[`item:${item.localId}:name`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:name`]}</div> : null}
                      </td>
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.qty}
                          onChange={(event) => setItemField(item.localId, 'qty', event.target.value)}
                        />
                        {errors[`item:${item.localId}:qty`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qty`]}</div> : null}
                      </td>
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.priceNet}
                          onChange={(event) => setItemField(item.localId, 'priceNet', event.target.value)}
                        />
                        {errors[`item:${item.localId}:priceNet`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:priceNet`]}</div> : null}
                      </td>
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.taxRate}
                          onChange={(event) => setItemField(item.localId, 'taxRate', event.target.value)}
                        />
                      </td>
                      <td>
                        <ThemedSelect
                          value={item.discountType}
                          onChange={(value) => setItemField(item.localId, 'discountType', value)}
                          options={discountTypeOptions}
                          placeholder="Discount"
                        />
                      </td>
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discountValue}
                          onChange={(event) => setItemField(item.localId, 'discountValue', event.target.value)}
                        />
                      </td>
                      <td>
                        <button type="button" className={s.removeButton} onClick={() => removeItem(item.localId)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <OmsProductPicker
            open={isProductPickerOpen}
            onClose={() => setProductPickerOpen(false)}
            onSelect={addProductItem}
            title="Dodaj produkt / Add product"
          />
        </section>

        <aside className={s.summaryCard}>
          <h2 className={s.summaryTitle}>Totals preview</h2>
          <div className={s.summaryRows}>
            <div className={s.summaryRow}>
              <span>Net</span>
              <span className={s.summaryValue}>{formatMoney(totals.net, form.currencyCode || 'PLN', i18n.language)}</span>
            </div>
            <div className={s.summaryRow}>
              <span>VAT</span>
              <span className={s.summaryValue}>{formatMoney(totals.vat, form.currencyCode || 'PLN', i18n.language)}</span>
            </div>
            <div className={s.summaryRow}>
              <span>Gross</span>
              <span className={s.summaryValue}>{formatMoney(totals.gross, form.currencyCode || 'PLN', i18n.language)}</span>
            </div>
            <div className={s.summaryRow}>
              <span>Currency</span>
              <span className={s.summaryValue}>{form.currencyCode || 'PLN'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
