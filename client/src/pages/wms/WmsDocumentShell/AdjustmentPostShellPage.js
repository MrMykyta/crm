import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useGetAdjustmentByIdQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  usePostAdjustmentMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';
import { pwConfig, rwConfig } from '../documentTypes';
import { createAdjustmentShellAdapter } from './createAdjustmentShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function mapAdjustmentItemToShellRow(item = {}, index = 0) {
  return {
    localId: item.localId || item.id || `adjustment-item-${index}`,
    id: item.id || null,
    isNew: !item.id,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    productName: asText(item.product?.name || item.productName || item.nameSnapshot),
    pickerProductName: asText(item.product?.name || item.productName || item.nameSnapshot),
    sku: asText(item.variant?.sku || item.product?.sku || item.variantSku || item.sku),
    variantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    pickerVariantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    qtyDelta: asText(item.qtyDelta ?? ''),
    locationId: asText(item.locationId),
    status: asText(item.status),
  };
}

export default function AdjustmentPostShellPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [postAdjustment] = usePostAdjustmentMutation();

  const adjustmentQuery = useGetAdjustmentByIdQuery(id, {
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

  const adjustment = adjustmentQuery.data || null;
  const status = asText(adjustment?.status).toLowerCase();
  const documentType = asText(adjustment?.documentType).toUpperCase();
  const config = documentType === 'RW' ? rwConfig : pwConfig;

  const adapter = useMemo(() => createAdjustmentShellAdapter({
    triggers: {
      postAdjustment,
      fetchAdjustmentById: async () => {
        const result = await adjustmentQuery.refetch();
        return result.data;
      },
    },
    permissions,
  }), [adjustmentQuery, permissions, postAdjustment]);

  const initialRows = useMemo(() => {
    const items = Array.isArray(adjustment?.items) ? adjustment.items : [];
    return items.map(mapAdjustmentItemToShellRow);
  }, [adjustment?.items]);

  const firstItem = Array.isArray(adjustment?.items) ? adjustment.items[0] : null;
  const initialHeader = useMemo(() => ({
    documentType: documentType || config.type,
    warehouseId: asText(adjustment?.warehouseId),
    locationId: asText(adjustment?.locationId || firstItem?.locationId),
    reason: asText(adjustment?.reason),
    issueDate: asText(adjustment?.issueDate),
  }), [
    adjustment?.issueDate,
    adjustment?.locationId,
    adjustment?.reason,
    adjustment?.warehouseId,
    config.type,
    documentType,
    firstItem?.locationId,
  ]);

  if (adjustmentQuery.isLoading || (adjustmentQuery.isFetching && !adjustment)) {
    return <div style={{ padding: 24 }}>Loading adjustment...</div>;
  }

  if (adjustmentQuery.isError || !adjustment || status !== 'draft') {
    return <WarehouseDocumentDetailPage kind="adjustment" />;
  }

  return (
    <WmsDocumentShell
      config={config}
      mode="post"
      documentId={id}
      adapter={adapter}
      initialHeader={initialHeader}
      initialRows={initialRows}
      originalHeader={initialHeader}
      originalRows={initialRows}
      resetKey={`${id}:${status}`}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      onSaveSuccess={() => navigate(`/main/wms/adjustments/${id}`, { replace: true })}
      onCancel={() => navigate(`/main/wms/adjustments/${id}`)}
    />
  );
}
