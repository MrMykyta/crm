import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

import OmsProductPicker from '../../../components/oms/OmsProductPicker';
import { NumberField, SelectField, TextField } from '../../../components/ui/fields';
import {
  buildLookupMap,
  formatLocationLabel,
  formatProductLabel,
  formatVariantLabel,
  formatWarehouseLabel,
} from '../../../components/documents/DocumentEngine/wmsDisplay';
import {
  useAddCycleCountItemsMutation,
  useGetCycleCountByIdQuery,
  useListInventoryItemsQuery,
  useListLocationsQuery,
  useReconcileCycleCountMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import { buildCycleCountItemsPayload } from '../documentAdapters/payloadBuilders';
import CcReconcileShellPage from '../WmsDocumentShell/CcReconcileShellPage';
import s from '../CycleCountPage.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function formatQty(value, locale = 'en') {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(asNumber(value, 0));
}

function getErrorText(error, fallback = 'Operation failed') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function warehouseLevelStockText(t) {
  return t('wms.locationOptional.warehouseLevelStock', 'Warehouse-level stock');
}

function warehouseLevelHint(t) {
  return t('wms.locationOptional.warehouseLevelHint', 'No location selected; this document will use warehouse-level stock.');
}

function formatOptionalLocationLabel(locationOrId, locationsById, t) {
  const id = typeof locationOrId === 'object' ? asText(locationOrId?.id) : asText(locationOrId);
  return id ? formatLocationLabel(locationOrId, locationsById) : warehouseLevelStockText(t);
}

function createDraftRow() {
  return {
    localId: uid(),
    locationId: '',
    productId: '',
    productName: '',
    sku: '',
    variantId: '',
    lotId: '',
    serialId: '',
    qtyCounted: '0',
  };
}

function lineKey(row) {
  return [
    row?.locationId || 'null',
    row?.productId || 'null',
    row?.variantId || 'null',
    row?.lotId || 'null',
    row?.serialId || 'null',
  ].join('|');
}

function LegacyCycleCountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [draftItems, setDraftItems] = useState([createDraftRow()]);
  const [errors, setErrors] = useState({});
  const [errorText, setErrorText] = useState('');
  const [reconcileInfo, setReconcileInfo] = useState(null);
  const [pickerTargetId, setPickerTargetId] = useState('');
  const [isPickerOpen, setPickerOpen] = useState(false);

  const {
    data: cycleCount,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetCycleCountByIdQuery(id, { skip: !id, refetchOnMountOrArgChange: true });

  const warehouseId = cycleCount?.warehouseId || '';
  const currentStatus = asText(cycleCount?.status).toLowerCase();
  const isReconciled = currentStatus === 'reconciled';

  const { data: locationsData } = useListLocationsQuery(
    {
      warehouseId: warehouseId || undefined,
      limit: 200,
      sort: 'code',
      dir: 'ASC',
    },
    { skip: !warehouseId }
  );
  const { data: inventoryItemsData } = useListInventoryItemsQuery(
    {
      warehouseId: warehouseId || undefined,
      limit: 1000,
      sort: 'updatedAt',
      dir: 'DESC',
    },
    { skip: !warehouseId }
  );

  const [addItems, { isLoading: isAddingItems }] = useAddCycleCountItemsMutation();
  const [reconcile, { isLoading: isReconciling }] = useReconcileCycleCountMutation();

  const locationOptions = useMemo(() => {
    const rows = Array.isArray(locationsData?.items) ? locationsData.items : [];
    return [
      { value: '', label: warehouseLevelStockText(t) },
      ...rows.map((row) => ({
        value: row.id,
        label: formatLocationLabel(row),
      })),
    ];
  }, [locationsData?.items, t]);

  const inventoryItems = useMemo(
    () => (Array.isArray(inventoryItemsData?.items) ? inventoryItemsData.items : []),
    [inventoryItemsData?.items]
  );

  const locationsById = useMemo(() => {
    const rows = [
      ...(Array.isArray(locationsData?.items) ? locationsData.items : []),
      ...(Array.isArray(cycleCount?.items) ? cycleCount.items.map((row) => row?.location).filter(Boolean) : []),
      ...inventoryItems.map((row) => row?.location).filter(Boolean),
    ];
    return buildLookupMap(rows);
  }, [cycleCount?.items, inventoryItems, locationsData?.items]);

  const productsById = useMemo(() => {
    const rows = [
      ...(Array.isArray(cycleCount?.items) ? cycleCount.items.map((row) => row?.product).filter(Boolean) : []),
      ...inventoryItems.map((row) => row?.product).filter(Boolean),
    ];
    return buildLookupMap(rows);
  }, [cycleCount?.items, inventoryItems]);

  const variantsById = useMemo(() => {
    const rows = [
      ...(Array.isArray(cycleCount?.items) ? cycleCount.items.map((row) => row?.variant).filter(Boolean) : []),
      ...inventoryItems.map((row) => row?.variant).filter(Boolean),
    ];
    return buildLookupMap(rows);
  }, [cycleCount?.items, inventoryItems]);

  const inventoryRowsByKey = useMemo(() => {
    const map = new Map();
    inventoryItems.forEach((row) => {
      const key = lineKey(row);
      if (!map.has(key)) map.set(key, row);
    });
    return map;
  }, [inventoryItems]);

  const differenceRows = useMemo(() => {
    const countedItems = Array.isArray(cycleCount?.items) ? cycleCount.items : [];
    const groupedCounted = new Map();
    countedItems.forEach((item) => {
      const key = lineKey(item);
      groupedCounted.set(key, round4((groupedCounted.get(key) || 0) + asNumber(item?.qtyCounted, 0)));
    });

    const groupedSystem = new Map();
    inventoryItems.forEach((row) => {
      const key = lineKey(row);
      groupedSystem.set(key, round4((groupedSystem.get(key) || 0) + asNumber(row?.qtyOnHand, 0)));
    });

    return Array.from(groupedCounted.entries()).map(([key, countedQty]) => {
      const source = countedItems.find((item) => lineKey(item) === key) || {};
      const systemSource = inventoryRowsByKey.get(key) || {};
      const systemQty = round4(groupedSystem.get(key) || 0);
      const difference = round4(countedQty - systemQty);
      return {
        key,
        locationId: source.locationId || '',
        location: source.location || systemSource.location || null,
        productId: source.productId || '',
        product: source.product || systemSource.product || null,
        variantId: source.variantId || '',
        variant: source.variant || systemSource.variant || null,
        lotId: source.lotId || '',
        serialId: source.serialId || '',
        countedQty,
        systemQty,
        difference,
      };
    });
  }, [cycleCount?.items, inventoryItems, inventoryRowsByKey]);

  const summary = useMemo(() => {
    return differenceRows.reduce((acc, row) => {
      if (row.difference > 0) acc.pw += row.difference;
      else if (row.difference < 0) acc.rw += Math.abs(row.difference);
      else acc.equal += 1;
      return acc;
    }, { pw: 0, rw: 0, equal: 0 });
  }, [differenceRows]);

  const addRow = () => setDraftItems((prev) => [...prev, createDraftRow()]);
  const removeRow = (localId) => {
    setDraftItems((prev) => {
      const next = prev.filter((item) => item.localId !== localId);
      return next.length ? next : [createDraftRow()];
    });
  };

  const setDraftField = (localId, field, value) => {
    setDraftItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    setErrors((prev) => ({ ...prev, [`item:${localId}:${field}`]: undefined }));
  };

  const onPickProduct = (product) => {
    if (!pickerTargetId) return;
    setDraftItems((prev) => prev.map((item) => (
      item.localId === pickerTargetId
        ? {
          ...item,
          productId: asText(product?.id),
          productName: asText(product?.name),
          sku: asText(product?.sku),
          variantId: asText(product?.defaultVariantId || product?.variantId || product?.defaultVariant?.id),
        }
        : item
    )));
    setPickerOpen(false);
    setPickerTargetId('');
  };

  const validateItems = () => {
    const nextErrors = {};
    draftItems.forEach((item) => {
      if (!asText(item.productId)) {
        nextErrors[`item:${item.localId}:productId`] = t('wms.cycleCounts.validation.productRequired', 'Product is required');
      }
      if (asNumber(item.qtyCounted, NaN) < 0 || Number.isNaN(asNumber(item.qtyCounted, NaN))) {
        nextErrors[`item:${item.localId}:qtyCounted`] = t('wms.cycleCounts.validation.qtyNonNegative', 'Qty counted must be >= 0');
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onAddCountedItems = async () => {
    if (!id || !validateItems()) return;
    setErrorText('');
    try {
      const payload = buildCycleCountItemsPayload({ rows: draftItems });
      await addItems({ id, items: payload.items }).unwrap();
      setDraftItems([createDraftRow()]);
      setErrors({});
      await refetch();
    } catch (apiError) {
      setErrorText(getErrorText(apiError, t('wms.cycleCounts.errors.addItems', 'Failed to add counted items')));
    }
  };

  const onReconcile = async () => {
    if (!id || isReconciled) return;
    setErrorText('');
    try {
      const result = await reconcile({ id }).unwrap();
      setReconcileInfo(result);
      await refetch();
    } catch (apiError) {
      setErrorText(getErrorText(apiError, t('wms.cycleCounts.errors.reconcile', 'Failed to reconcile sheet')));
    }
  };

  if (isLoading || isFetching) {
    return (
      <div className={s.page}>
        <div className={s.state}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={s.page}>
        <div className={s.state} style={{ color: 'var(--danger)' }}>
          {getErrorText(error, t('common.error', 'Error'))}
        </div>
      </div>
    );
  }

  if (!cycleCount) {
    return (
      <div className={s.page}>
        <div className={s.state}>{t('common.notFound', 'Not found')}</div>
      </div>
    );
  }

  const warehouseLabel = formatWarehouseLabel(cycleCount.warehouse || cycleCount.warehouseId);

  return (
    <div className={s.page}>
      <section className={s.mainCard}>
        <div className={s.header}>
          <div>
            <h1 className={s.title}>
              {t('wms.cycleCounts.detailTitle', 'Inventory count sheet')} #{asText(cycleCount.id).slice(0, 8)}
            </h1>
            <p className={s.subtle}>
              {t('wms.cycleCounts.detailSubtle', 'Warehouse')}: {warehouseLabel}
            </p>
          </div>
          <div className={s.headerActions}>
            <span className={s.statusBadge}>{statusLabel(cycleCount.status, t)}</span>
            <button
              type="button"
              className={s.button}
              onClick={() => navigate('/main/wms/cycle-counts')}
            >
              {t('wms.backToList', 'Back to list')}
            </button>
            <button
              type="button"
              className={s.button}
              onClick={() => navigate(`/main/wms/cycle-counts/${id}/print`)}
            >
              <Printer size={14} aria-hidden="true" />
              {t('wms.print.print', 'Print')}
            </button>
            <button
              type="button"
              className={s.primaryButton}
              disabled={isReconciling || isReconciled || !Array.isArray(cycleCount.items) || !cycleCount.items.length}
              onClick={onReconcile}
            >
              {isReconciling
                ? t('common.saving', 'Saving...')
                : t('wms.cycleCounts.actions.reconcile', 'Reconcile')}
            </button>
          </div>
        </div>

        {errorText ? <div className={s.errorBanner}>{errorText}</div> : null}

        <div className={s.section}>
          <h2 className={s.sectionTitle}>{t('wms.cycleCounts.sections.differenceSummary', 'Difference summary')}</h2>
          <div className={s.smallText}>
            {t('wms.cycleCounts.summary.pw', 'PW total')}: {formatQty(summary.pw, i18n.language)} ·{' '}
            {t('wms.cycleCounts.summary.rw', 'RW total')}: {formatQty(summary.rw, i18n.language)} ·{' '}
            {t('wms.cycleCounts.summary.equal', 'Equal lines')}: {summary.equal}
          </div>
          <div className={s.tableWrap} style={{ marginTop: 8 }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('wms.cycleCounts.columns.location', 'Location')}</th>
                  <th>{t('wms.cycleCounts.columns.product', 'Product')}</th>
                  <th>{t('wms.cycleCounts.columns.variant', 'Variant')}</th>
                  <th>{t('wms.cycleCounts.columns.counted', 'Counted')}</th>
                  <th>{t('wms.cycleCounts.columns.system', 'System')}</th>
                  <th>{t('wms.cycleCounts.columns.diff', 'Difference')}</th>
                  <th>{t('wms.cycleCounts.columns.movement', 'Planned movement')}</th>
                </tr>
              </thead>
              <tbody>
                {differenceRows.map((row) => {
                  const diffClass = row.difference > 0 ? s.chipPositive : row.difference < 0 ? s.chipNegative : s.chipNeutral;
                  const movement = row.difference > 0
                    ? `PW +${formatQty(row.difference, i18n.language)}`
                    : row.difference < 0
                      ? `RW -${formatQty(Math.abs(row.difference), i18n.language)}`
                      : '—';
                  return (
                    <tr key={row.key}>
                      <td>{formatOptionalLocationLabel(row.location || row.locationId, locationsById, t)}</td>
                      <td>{formatProductLabel(row.product || row.productId, productsById)}</td>
                      <td>{formatVariantLabel(row.variant || row.variantId, variantsById)}</td>
                      <td>{formatQty(row.countedQty, i18n.language)}</td>
                      <td>{formatQty(row.systemQty, i18n.language)}</td>
                      <td className={diffClass}>{formatQty(row.difference, i18n.language)}</td>
                      <td>{movement}</td>
                    </tr>
                  );
                })}
                {!differenceRows.length ? (
                  <tr>
                    <td colSpan={7} className={s.smallText}>
                      {t('wms.cycleCounts.emptyDifferences', 'No counted lines yet')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {!isReconciled ? (
          <div className={s.section}>
            <h2 className={s.sectionTitle}>{t('wms.cycleCounts.sections.addItems', 'Add counted items')}</h2>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('wms.locationOptional.label', 'Location optional')}</th>
                    <th>{t('wms.cycleCounts.columns.product', 'Product')} *</th>
                    <th>{t('wms.cycleCounts.columns.variant', 'Variant')}</th>
                    <th>{t('wms.cycleCounts.columns.lot', 'Lot')}</th>
                    <th>{t('wms.cycleCounts.columns.serial', 'Serial')}</th>
                    <th>{t('wms.cycleCounts.columns.counted', 'Counted')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item) => (
                    <tr key={item.localId}>
                      <td>
                        <SelectField
                          value={item.locationId}
                          onValueChange={(value) => setDraftField(item.localId, 'locationId', value)}
                          options={locationOptions}
                          placeholder={warehouseLevelStockText(t)}
                        />
                        {!asText(item.locationId) ? (
                          <div className={s.smallText}>{warehouseLevelHint(t)}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className={s.productCell}>
                          <button
                            type="button"
                            className={s.pickButton}
                            onClick={() => {
                              setPickerTargetId(item.localId);
                              setPickerOpen(true);
                            }}
                          >
                            {item.productId
                              ? t('wms.cycleCounts.actions.changeProduct', 'Change product')
                              : t('wms.cycleCounts.actions.selectProduct', 'Select product')}
                          </button>
                          <div className={s.productText}>
                            {item.productName || t('wms.cycleCounts.noProduct', 'No product selected')}
                            {item.sku ? <span className={s.productSub}>SKU: {item.sku}</span> : null}
                          </div>
                        </div>
                        {errors[`item:${item.localId}:productId`] ? (
                          <div className={s.fieldError}>{errors[`item:${item.localId}:productId`]}</div>
                        ) : null}
                      </td>
                      <td>
                        <TextField
                          value={item.variantId}
                          onValueChange={(value) => setDraftField(item.localId, 'variantId', value)}
                          placeholder={t('wms.cycleCounts.placeholders.variant', 'Variant ID')}
                          inputClassName={s.input}
                        />
                      </td>
                      <td>
                        <TextField
                          value={item.lotId}
                          onValueChange={(value) => setDraftField(item.localId, 'lotId', value)}
                          placeholder={t('wms.cycleCounts.placeholders.lot', 'Lot ID')}
                          inputClassName={s.input}
                        />
                      </td>
                      <td>
                        <TextField
                          value={item.serialId}
                          onValueChange={(value) => setDraftField(item.localId, 'serialId', value)}
                          placeholder={t('wms.cycleCounts.placeholders.serial', 'Serial ID')}
                          inputClassName={s.input}
                        />
                      </td>
                      <td>
                        <NumberField
                          emitAs="string"
                          min="0"
                          step="0.0001"
                          value={item.qtyCounted}
                          onValueChange={(value) => setDraftField(item.localId, 'qtyCounted', value)}
                          inputClassName={s.input}
                        />
                        {errors[`item:${item.localId}:qtyCounted`] ? (
                          <div className={s.fieldError}>{errors[`item:${item.localId}:qtyCounted`]}</div>
                        ) : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={s.removeButton}
                          onClick={() => removeRow(item.localId)}
                        >
                          {t('common.remove', 'Remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.headerActions} style={{ marginTop: 10 }}>
              <button type="button" className={s.button} onClick={addRow}>
                {t('wms.cycleCounts.actions.addLine', 'Add line')}
              </button>
              <button
                type="button"
                className={s.primaryButton}
                disabled={isAddingItems}
                onClick={onAddCountedItems}
              >
                {isAddingItems ? t('common.saving', 'Saving...') : t('wms.cycleCounts.actions.addItems', 'Add counted items')}
              </button>
            </div>
          </div>
        ) : null}

        <div className={s.section}>
          <h2 className={s.sectionTitle}>{t('wms.cycleCounts.sections.reconcileResult', 'Reconcile result')}</h2>
          {Array.isArray(reconcileInfo?.adjustments) && reconcileInfo.adjustments.length ? (
            <ul className={s.adjustmentsList}>
              {reconcileInfo.adjustments.map((adj) => (
                <li key={adj.id} className={s.adjustmentRow}>
                  <span>
                    {asText(adj.documentType)} · {asText(adj.number) || asText(adj.id).slice(0, 8)} · {statusLabel(adj.status, t)}
                  </span>
                  <Link className={s.adjustmentLink} to={`/main/wms/adjustments/${adj.id}`}>
                    {t('wms.cycleCounts.actions.openAdjustment', 'Open adjustment')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className={s.smallText}>
              {isReconciled
                ? t('wms.cycleCounts.reconciledNoNew', 'Sheet is already reconciled. No new adjustments created in this session.')
                : t('wms.cycleCounts.notReconciledYet', 'Reconcile has not been run yet.')}
            </div>
          )}
        </div>
      </section>

      <OmsProductPicker
        open={isPickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerTargetId('');
        }}
        onSelect={onPickProduct}
        title={t('wms.cycleCounts.selectProduct', 'Select product')}
      />
    </div>
  );
}

export default function CycleCountDetailPage() {
  const legacy = <LegacyCycleCountDetailPage />;
  return <CcReconcileShellPage fallback={legacy} />;
}
