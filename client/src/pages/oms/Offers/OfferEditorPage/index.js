import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ThemedSelect from '../../../../components/inputs/RadixSelect';
import DateTimePicker from '../../../../components/inputs/DateTimePicker';
import OmsProductPicker from '../../../../components/oms/OmsProductPicker';
import {
  useCreateOfferMutation,
  useGetOfferByIdQuery,
  useGetOfferMetaQuery,
  useSaveOfferItemsMutation,
  useUpdateOfferMutation,
} from '../../../../store/rtk/offersApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsByCounterpartyQuery } from '../../../../store/rtk/contactsApi';
import { useListCompanyUsersQuery } from '../../../../store/rtk/companyUsersApi';
import s from './OfferEditorPage.module.css';

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
  const totals = items.reduce((acc, item) => {
    const line = calculateLine(item);
    acc.net += line.lineNet;
    acc.vat += line.lineVat;
    acc.gross += line.lineGross;
    return acc;
  }, { net: 0, vat: 0, gross: 0 });

  return {
    net: roundMoney(totals.net),
    vat: roundMoney(totals.vat),
    gross: roundMoney(totals.gross),
  };
}

function getErrorText(error, fallback = 'Failed to save offer') {
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

function stableItemsHash(items) {
  return JSON.stringify(
    (items || []).map((item, index) => ({
      id: item.id || null,
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
    }))
  );
}

export default function OfferEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [form, setForm] = useState({
    counterpartyId: '',
    contactId: '',
    ownerId: '',
    currencyCode: 'PLN',
    issueDate: '',
    validUntil: '',
    title: '',
    subject: '',
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
  const initialItemsHashRef = useRef('[]');

  const { data: offer, isLoading: isOfferLoading, isError: isOfferError, error: offerError } = useGetOfferByIdQuery(id, {
    skip: !isEdit,
    refetchOnMountOrArgChange: true,
  });

  const { data: meta } = useGetOfferMetaQuery({}, { refetchOnMountOrArgChange: false });
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

  const [createOffer, { isLoading: isCreating }] = useCreateOfferMutation();
  const [updateOffer, { isLoading: isUpdating }] = useUpdateOfferMutation();
  const [saveOfferItems, { isLoading: isSavingItems }] = useSaveOfferItemsMutation();

  useEffect(() => {
    if (!isEdit || initialized || !offer) return;

    setForm({
      counterpartyId: offer.counterpartyId || offer.counterparty?.id || '',
      contactId: offer.contactId || offer.contact?.id || '',
      ownerId: offer.ownerId || offer.owner?.id || '',
      currencyCode: offer.currency || offer.currencyCode || 'PLN',
      issueDate: asText(offer.issueDate).slice(0, 10),
      validUntil: asText(offer.validUntil).slice(0, 10),
      title: offer.title || '',
      subject: offer.subject || '',
      notes: offer.notes || '',
      paymentTerms: offer.paymentTerms || '',
      deliveryTerms: offer.deliveryTerms || '',
      leadTime: offer.leadTime || '',
    });

    const mappedItems = Array.isArray(offer.items) && offer.items.length
      ? offer.items.map(toEditorItem)
      : [createEmptyItem()];
    setItems(mappedItems);
    initialItemsHashRef.current = stableItemsHash(mappedItems);
    setInitialized(true);
  }, [isEdit, initialized, offer]);

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
    currency: asText(form.currencyCode).toUpperCase() || 'PLN',
    issueDate: form.issueDate || null,
    validUntil: form.validUntil || null,
    title: form.title || '',
    subject: form.subject || '',
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
        await updateOffer({ id, payload: headerPayload }).unwrap();

        const nextHash = stableItemsHash(items);
        if (nextHash !== initialItemsHashRef.current) {
          await saveOfferItems({ id, items: itemsPayload }).unwrap();
          initialItemsHashRef.current = nextHash;
        }

        navigate(`/main/oms/offers/${id}`);
        return;
      }

      const created = await createOffer({ ...headerPayload, items: itemsPayload }).unwrap();
      const createdId = created?.id || created?.data?.id;
      if (createdId) {
        navigate(`/main/oms/offers/${createdId}`);
        return;
      }
      navigate('/main/oms/offers');
    } catch (error) {
      setSaveError(getErrorText(error));
    }
  };

  if (isEdit && isOfferLoading) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Loading offer...</h2>
          <p className={s.stateText}>Preparing offer editor.</p>
        </section>
      </div>
    );
  }

  if (isEdit && isOfferError) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Failed to load offer</h2>
          <p className={s.stateText}>{getErrorText(offerError, 'Failed to load offer')}</p>
        </section>
      </div>
    );
  }

  if (isEdit && !offer) {
    return (
      <div className={s.page}>
        <section className={s.stateCard}>
          <h2 className={s.stateTitle}>Offer not found</h2>
          <p className={s.stateText}>No offer data available in current company scope.</p>
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
              <h1 className={s.title}>{isEdit ? 'Edit offer' : 'New offer'}</h1>
              <p className={s.subtle}>{isEdit ? (offer?.number || offer?.id) : 'Create offer'}</p>
            </div>
            <div className={s.headerActions}>
              <button
                type="button"
                className={s.button}
                onClick={() => navigate(isEdit ? `/main/oms/offers/${id}` : '/main/oms/offers')}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button type="button" className={s.primaryButton} onClick={onSave} disabled={isSaving}>
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
                <label className={s.fieldLabel}>Issue date</label>
                <DateTimePicker
                  value={form.issueDate}
                  onChange={(value) => setField('issueDate', value)}
                  withTime={false}
                  locale={i18n.language === 'pl' ? 'pl-PL' : i18n.language === 'en' ? 'en-US' : 'ru-RU'}
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Valid until</label>
                <DateTimePicker
                  value={form.validUntil}
                  onChange={(value) => setField('validUntil', value)}
                  withTime={false}
                  locale={i18n.language === 'pl' ? 'pl-PL' : i18n.language === 'en' ? 'en-US' : 'ru-RU'}
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Title</label>
                <input
                  className={s.input}
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  placeholder="Offer title"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Subject</label>
                <input
                  className={s.input}
                  value={form.subject}
                  onChange={(event) => setField('subject', event.target.value)}
                  placeholder="Offer subject"
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

              <div className={s.field}>
                <label className={s.fieldLabel}>Lead time</label>
                <input
                  className={s.input}
                  value={form.leadTime}
                  onChange={(event) => setField('leadTime', event.target.value)}
                  placeholder="e.g. 5 days"
                />
              </div>
            </div>

            <div className={s.field} style={{ marginTop: 10 }}>
              <label className={s.fieldLabel}>Notes</label>
              <textarea
                className={s.textarea}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
                placeholder="Offer notes"
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
