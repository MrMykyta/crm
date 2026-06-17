import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useGetCycleCountByIdQuery,
  useListInventoryItemsQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  useReconcileCycleCountMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import { ccConfig } from '../documentTypes';
import { createCycleCountShellAdapter } from './createCycleCountShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

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

function lineKey(row) {
  return [
    row?.locationId || 'null',
    row?.productId || 'null',
    row?.variantId || 'null',
    row?.lotId || 'null',
    row?.serialId || 'null',
  ].join('|');
}

function formatWarehouseLabel(row) {
  if (!row) return '';
  return [asText(row.code), asText(row.name)].filter(Boolean).join(' - ') || asText(row.id);
}

function mapCountItemToShellRow(item = {}, index = 0) {
  const product = item.product || {};
  const variant = item.variant || {};
  return {
    localId: item.localId || item.id || `cycle-count-item-${index}`,
    id: item.id || null,
    isNew: !item.id,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    productName: asText(product.name || item.productName || item.nameSnapshot),
    pickerProductName: asText(product.name || item.productName || item.nameSnapshot),
    sku: asText(variant.sku || product.sku || item.variantSku || item.sku),
    variantLabel: asText(variant.name || item.variantName || item.variantLabel),
    pickerVariantLabel: asText(variant.name || item.variantName || item.variantLabel),
    locationId: asText(item.locationId),
    lotId: asText(item.lotId),
    serialId: asText(item.serialId),
    systemQty: asText(item.systemQty ?? ''),
    qtyCounted: asText(item.qtyCounted ?? ''),
    difference: asText(item.difference ?? ''),
    status: asText(item.status),
  };
}

function summarizeVariance(cycleCount, inventoryItems = []) {
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

  return Array.from(groupedCounted.entries()).reduce((acc, [key, countedQty]) => {
    const systemQty = round4(groupedSystem.get(key) || 0);
    const difference = round4(countedQty - systemQty);
    if (difference > 0) acc.positive += difference;
    if (difference < 0) acc.negative += Math.abs(difference);
    if (difference !== 0) acc.varianceRows += 1;
    return acc;
  }, { varianceRows: 0, positive: 0, negative: 0 });
}

export default function CcReconcileShellPage({ fallback = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [reconcileCycleCount] = useReconcileCycleCountMutation();

  const cycleCountQuery = useGetCycleCountByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const { data: warehousesData } = useListWarehousesQuery({
    limit: 200,
    sort: 'name',
    dir: 'ASC',
  });
  const { data: locationsData } = useListLocationsQuery({
    limit: 500,
    sort: 'code',
    dir: 'ASC',
  });

  const cycleCount = cycleCountQuery.data || null;
  const warehouseId = asText(cycleCount?.warehouseId);
  const { data: inventoryItemsData } = useListInventoryItemsQuery(
    {
      warehouseId: warehouseId || undefined,
      limit: 1000,
      sort: 'updatedAt',
      dir: 'DESC',
    },
    { skip: !warehouseId }
  );

  const adapter = useMemo(() => createCycleCountShellAdapter({
    triggers: {
      reconcileCycleCount,
      fetchCycleCountById: async () => {
        const result = await cycleCountQuery.refetch();
        return result.data;
      },
    },
    permissions,
  }), [cycleCountQuery, permissions, reconcileCycleCount]);

  const status = asText(cycleCount?.status).toLowerCase();
  const items = Array.isArray(cycleCount?.items) ? cycleCount.items : [];
  const isReconcileCandidate = Boolean(cycleCount && status !== 'reconciled' && items.length);
  const firstItem = items[0] || null;
  const varianceSummary = useMemo(
    () => summarizeVariance(cycleCount, inventoryItemsData?.items || []),
    [cycleCount, inventoryItemsData?.items]
  );

  const initialHeader = useMemo(() => ({
    warehouseId,
    locationId: asText(cycleCount?.locationId || firstItem?.locationId),
    status: asText(cycleCount?.status),
    createdAt: asText(cycleCount?.createdAt),
  }), [cycleCount?.createdAt, cycleCount?.locationId, cycleCount?.status, firstItem?.locationId, warehouseId]);

  const initialRows = useMemo(() => items.map(mapCountItemToShellRow), [items]);

  const getOperationConfirm = () => {
    const warehouseLabel = formatWarehouseLabel(cycleCount?.warehouse) || warehouseId || '—';
    return {
      title: 'Confirm cycle count reconcile',
      confirmLabel: 'Confirm reconcile',
      lines: [
        `Cycle count: ${asText(cycleCount?.number) || asText(cycleCount?.id) || id}`,
        `Warehouse: ${warehouseLabel}`,
        `Variance rows: ${varianceSummary.varianceRows}`,
        `Total positive variance: ${round4(varianceSummary.positive)}`,
        `Total negative variance: ${round4(varianceSummary.negative)}`,
        'Reconcile will apply counted differences and may create RW/PW adjustments.',
      ],
    };
  };

  if (cycleCountQuery.isLoading || (cycleCountQuery.isFetching && !cycleCount)) {
    return <div style={{ padding: 24 }}>Loading cycle count...</div>;
  }

  if (cycleCountQuery.isError || !isReconcileCandidate) {
    return fallback;
  }

  return (
    <WmsDocumentShell
      config={ccConfig}
      mode="reconcile"
      documentId={id}
      adapter={adapter}
      initialHeader={initialHeader}
      initialRows={initialRows}
      originalHeader={initialHeader}
      originalRows={initialRows}
      resetKey={`${id}:${status}`}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      getOperationConfirm={getOperationConfirm}
      onSaveSuccess={() => navigate(`/main/wms/cycle-counts/${id}`, { replace: true })}
      onCancel={() => navigate(`/main/wms/cycle-counts/${id}`)}
    />
  );
}
