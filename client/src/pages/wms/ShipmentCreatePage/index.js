import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import OmsProductPicker from '../../../components/oms/OmsProductPicker';
import ThemedSelect from '../../../components/inputs/RadixSelect';
import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useListCounterpartiesQuery,
} from '../../../store/rtk/counterpartyApi';
import {
  useCreateShipmentMutation,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { useListOrdersQuery } from '../../../store/rtk/ordersApi';
import { useListProductVariantsQuery } from '../../../store/rtk/productsApi';
import { formatVariantLabel } from '../../../components/documents/DocumentEngine/wmsDisplay';
import { isWmsShellWzCreateEnabled } from '../../../config/featureFlags';
import { buildShipmentPayload } from '../documentAdapters/payloadBuilders';
import WzCreateShellPage from '../WmsDocumentShell/WzCreateShellPage';
import s from './ShipmentCreatePage.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getErrorText(error, fallback = 'Failed to create shipment') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function createShipmentItem() {
  return {
    localId: uid(),
    productId: '',
    productName: '',
    productSku: '',
    variantId: '',
    qty: '1',
  };
}

function asOrderLabel(order, t) {
  const number = asText(order?.number) || order?.id;
  const status = asText(order?.status);
  const counterparty = asText(order?.counterparty?.shortName)
    || asText(order?.counterparty?.fullName)
    || asText(order?.customer?.shortName)
    || asText(order?.customer?.fullName);

  if (!number && !counterparty && !status) return '-';

  const statusText = status ? t(`statuses.${status.toLowerCase()}`, status) : '';
  return [number, counterparty, statusText].filter(Boolean).join(' — ');
}

function getProductLabel(item) {
  const name = asText(item?.productName);
  const sku = asText(item?.productSku);
  const parts = [name, sku].filter(Boolean);
  return parts.length ? parts.join(' — ') : '—';
}

function applyProductToItem(item, product) {
  return {
    ...item,
    productId: asText(product?.id),
    productName: asText(product?.name),
    productSku: asText(product?.sku),
    variantId: '',
  };
}

function LegacyShipmentCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can, isLoading: isLoadingAcl, hasResolvedPermissions } = useAclPermissions();
  const canCreateShipment = can('wms:document:create');

  const [form, setForm] = useState({
    warehouseId: '',
    counterpartyId: '',
    orderId: '',
    notes: '',
  });
  const [items, setItems] = useState(() => [createShipmentItem()]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState('');

  const [createShipment, { isLoading: isSaving }] = useCreateShipmentMutation();

  const skipLookup = !canCreateShipment;
  const { data: warehousesData, isLoading: isLoadingWarehouses, isError: isWarehousesError, error: warehousesError } = useListWarehousesQuery(
    { limit: 200, sort: 'name', dir: 'ASC' },
    { skip: skipLookup }
  );
  const { data: counterpartiesData, isLoading: isLoadingCounterparties, isError: isCounterpartiesError, error: counterpartiesError } = useListCounterpartiesQuery(
    { limit: 200, sort: 'shortName', dir: 'ASC', excludeLeadClient: true },
    { skip: skipLookup }
  );
  const { data: ordersData, isLoading: isLoadingOrders, isError: isOrdersError, error: ordersError } = useListOrdersQuery(
    {
      limit: 200,
      sort: 'createdAt',
      dir: 'DESC',
      counterpartyId: asText(form.counterpartyId) || undefined,
    },
    { skip: skipLookup }
  );
  const { data: variantsData } = useListProductVariantsQuery(
    { page: 1, limit: 500 },
    { skip: skipLookup }
  );

  const warehouseOptions = useMemo(() => {
    const rows = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
    return [
      { value: '', label: t('wms.create.selectWarehouse', 'Select warehouse') },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.name)].filter(Boolean).join(' — ') || row.id,
      })),
    ];
  }, [t, warehousesData?.items]);

  const counterpartyOptions = useMemo(() => {
    const rows = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return [
      { value: '', label: t('documents.editor.noCounterparty', 'No counterparty') },
      ...rows.map((row) => ({
        value: row.id,
        label: row.shortName || row.fullName || row.name || row.id,
      })),
    ];
  }, [counterpartiesData?.items, t]);

  const orderOptions = useMemo(() => {
    const rows = Array.isArray(ordersData?.items) ? ordersData.items : [];
    return [
      { value: '', label: t('wms.shipments.new.noOrder', 'No order') },
      ...rows.map((order) => ({
        value: order.id,
        label: asOrderLabel(order, t),
      })),
    ];
  }, [ordersData?.items, t]);

  const variants = useMemo(() => (Array.isArray(variantsData?.items) ? variantsData.items : []), [variantsData?.items]);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: asText(value) };
      if (key === 'counterpartyId' && next.counterpartyId !== prev.counterpartyId) {
        next.orderId = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setItemField = (localId, field, value) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    setErrors((prev) => ({ ...prev, [`item:${localId}:${field}`]: undefined }));
  };

  const addItem = () => setItems((prev) => [...prev, createShipmentItem()]);

  const removeItem = (localId) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.localId !== localId);
      return next.length ? next : [createShipmentItem()];
    });
  };

  const onOpenPicker = (localId) => {
    setPickerTargetId(localId);
    setPickerOpen(true);
  };

  const onPickProduct = (product) => {
    if (!pickerTargetId) return;
    setItems((prev) => prev.map((item) => (item.localId === pickerTargetId ? applyProductToItem(item, product) : item)));
    setPickerOpen(false);
    setPickerTargetId('');
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerTargetId('');
  };

  const variantOptionsFor = (item) => {
    const options = variants
      .filter((variant) => !item.productId || asText(variant.productId) === asText(item.productId))
      .map((variant) => ({
        value: asText(variant.id),
        label: formatVariantLabel(variant),
      }));

    if (item.variantId && !options.some((option) => option.value === item.variantId)) {
      options.push({
        value: item.variantId,
        label: formatVariantLabel({ id: item.variantId, ...item }),
      });
    }

    return [
      { value: '', label: t('wms.shipments.new.noVariant', 'No variant') },
      ...options,
    ];
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.warehouseId) {
      nextErrors.warehouseId = t('wms.validation.warehouseRequired', 'Warehouse is required');
    }

    items.forEach((item) => {
      if (!asText(item.productId)) {
        nextErrors[`item:${item.localId}:productId`] = t('wms.validation.productRequired', 'Product is required');
      }
      if (asNumber(item.qty, 0) <= 0) {
        nextErrors[`item:${item.localId}:qty`] = t('wms.validation.qtyPositive', 'Qty must be greater than 0');
      }
    });

    const hasAnyProduct = items.some((item) => asText(item.productId));
    if (!hasAnyProduct) {
      nextErrors.items = t('wms.shipments.validation.itemRequired', 'At least one shipment line is required');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const payload = useMemo(() => buildShipmentPayload({ form, items }), [form, items]);

  const onCreate = async () => {
    setSubmitError('');
    if (!validate()) return;

    try {
      const created = await createShipment(payload).unwrap();
      const createdId = created?.id;
      if (!createdId) {
        throw new Error('Shipment id missing in response');
      }
      navigate(`/main/wms/shipments/${createdId}`);
    } catch (error) {
      setSubmitError(getErrorText(error, t('wms.shipments.new.createFailed', 'Failed to create shipment')));
    }
  };

  if (isLoadingAcl && !hasResolvedPermissions) {
    return <div className={s.state}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canCreateShipment) {
    return (
      <div className={s.noPermission}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.shipments.new.noPermission', 'You do not have permission to create warehouse shipments.')}</p>
      </div>
    );
  }

  if (isLoadingWarehouses) {
    return <div className={s.state}>{t('common.loading', 'Loading...')}</div>;
  }

  if (isWarehousesError) {
    return (
      <div className={s.state}>
        {getErrorText(warehousesError, t('wms.shipments.new.loadWarehousesFailed', 'Failed to load warehouses'))}
      </div>
    );
  }

  const warehouses = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
  if (!warehouses.length) {
    return <div className={s.state}>{t('wms.shipments.new.noWarehouses', 'No warehouses configured.')}</div>;
  }

  return (
    <div className={s.page}>
      <section className={s.mainCard}>
        <div className={s.header}>
          <div>
            <h1 className={s.title}>{t('wms.shipments.new.title', 'New shipment')}</h1>
            <p className={s.subtle}>{t('wms.shipments.new.subtitle', 'Create shipment document and add lines manually.')}</p>
          </div>
          <div className={s.headerActions}>
            <button
              type="button"
              className={s.button}
              onClick={() => navigate('/main/wms/shipments')}
              disabled={isSaving}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className={s.primaryButton}
              onClick={onCreate}
              disabled={isSaving}
            >
              {isSaving ? t('common.saving', 'Saving...') : t('wms.create.create', 'Create')}
            </button>
          </div>
        </div>

        {submitError ? <div className={s.errorBanner}>{submitError}</div> : null}

        {isCounterpartiesError ? (
          <div className={s.warningBanner}>
            {getErrorText(counterpartiesError, t('wms.shipments.new.loadCounterpartiesFailed', 'Failed to load counterparties'))}
          </div>
        ) : null}

        {isOrdersError ? (
          <div className={s.warningBanner}>
            {getErrorText(ordersError, t('wms.shipments.new.loadOrdersFailed', 'Failed to load orders'))}
          </div>
        ) : null}

        <div className={s.section}>
          <h2 className={s.sectionTitle}>{t('documents.labels.header', 'Header')}</h2>
          <div className={s.grid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>{t('wms.print.warehouse', 'Warehouse')} *</label>
              <ThemedSelect
                value={form.warehouseId}
                onChange={(value) => setField('warehouseId', value)}
                options={warehouseOptions}
                placeholder={t('wms.create.selectWarehouse', 'Select warehouse')}
                disabled={isSaving}
              />
              {errors.warehouseId ? <span className={s.fieldError}>{errors.warehouseId}</span> : null}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>{t('wms.shipments.new.counterparty', 'Counterparty')}</label>
              <ThemedSelect
                value={form.counterpartyId}
                onChange={(value) => setField('counterpartyId', value)}
                options={counterpartyOptions}
                placeholder={t('documents.editor.selectCounterparty', 'Select counterparty')}
                disabled={isLoadingCounterparties || isSaving}
              />
              {isLoadingCounterparties ? <span className={s.fieldHint}>{t('common.loading', 'Loading…')}</span> : null}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>{t('wms.shipments.new.order', 'Order')}</label>
              <ThemedSelect
                value={form.orderId}
                onChange={(value) => setField('orderId', value)}
                options={orderOptions}
                placeholder={t('wms.shipments.new.selectOrder', 'Select order')}
                disabled={isLoadingOrders || isSaving}
              />
              {isLoadingOrders ? <span className={s.fieldHint}>{t('common.loading', 'Loading…')}</span> : null}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>{t('wms.shipments.new.notes', 'Notes')}</label>
              <textarea
                className={s.textarea}
                rows={3}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
                placeholder={t('wms.shipments.new.notesPlaceholder', 'Optional notes')}
                disabled={isSaving}
              />
              <span className={s.fieldHint}>
                {t(
                  'wms.shipments.new.notesNote',
                  'Notes are currently not part of WMS shipment create payload and will not be persisted.'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{t('wms.shipments.new.items', 'Shipment items')}</h2>
            <button type="button" className={s.secondaryButton} onClick={addItem} disabled={isSaving}>
              {t('wms.create.addLine', 'Add line')}
            </button>
          </div>

          {errors.items ? <div className={s.fieldError}>{errors.items}</div> : null}

          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('wms.create.product', 'Product')}</th>
                  <th>{t('wms.create.variantOptional', 'Variant (optional)')}</th>
                  <th>{t('wms.columns.qty', 'Qty')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.localId}>
                    <td>
                      <div className={s.itemCell}>
                        <button type="button" className={s.pickButton} onClick={() => onOpenPicker(item.localId)} disabled={isSaving}>
                          {asText(item.productName)
                            ? t('wms.create.changeProduct', 'Change product')
                            : t('wms.create.selectProduct', 'Select product')}
                          }
                        </button>
                        <div className={s.itemText}>{getProductLabel(item)}</div>
                      </div>
                      {errors[`item:${item.localId}:productId`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:productId`]}</div> : null}
                    </td>
                    <td>
                      <ThemedSelect
                        value={item.variantId}
                        onChange={(value) => setItemField(item.localId, 'variantId', value)}
                        options={variantOptionsFor(item)}
                        placeholder={t('wms.create.selectVariant', 'Select variant')}
                        disabled={isSaving || !asText(item.productId)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={s.input}
                        min="0"
                        step="0.0001"
                        value={item.qty}
                        onChange={(event) => setItemField(item.localId, 'qty', event.target.value)}
                        disabled={isSaving}
                      />
                      {errors[`item:${item.localId}:qty`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qty`]}</div> : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={s.removeButton}
                        onClick={() => removeItem(item.localId)}
                        disabled={isSaving}
                      >
                        {t('documents.lines.remove', 'Remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <OmsProductPicker
        open={pickerOpen}
        onClose={closePicker}
        onSelect={onPickProduct}
        title={t('wms.create.selectProduct', 'Select product')}
      />
    </div>
  );
}

export default function ShipmentCreatePage() {
  if (isWmsShellWzCreateEnabled()) {
    return <WzCreateShellPage />;
  }

  return <LegacyShipmentCreatePage />;
}
