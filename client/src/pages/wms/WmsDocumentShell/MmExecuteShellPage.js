import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useExecuteTransferLineMutation,
  useGetTransferByIdQuery,
  useGetTransferStockMovesQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';
import { mmConfig } from '../documentTypes';
import {
  createTransferShellAdapter,
  mergeTransferRowsWithMovedQty,
} from './createTransferShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function mapTransferItemToShellRow(item = {}, index = 0) {
  return {
    localId: item.localId || item.id || `transfer-item-${index}`,
    id: item.id || null,
    isNew: !item.id,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    productName: asText(item.product?.name || item.productName || item.nameSnapshot),
    pickerProductName: asText(item.product?.name || item.productName || item.nameSnapshot),
    sku: asText(item.variant?.sku || item.product?.sku || item.variantSku || item.sku),
    variantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    pickerVariantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    qty: asText(item.qty ?? ''),
    movedQty: asText(item.movedQty ?? ''),
    status: asText(item.status),
  };
}

export default function MmExecuteShellPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [executeTransferLine] = useExecuteTransferLineMutation();

  const transferQuery = useGetTransferByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const transferHistoryQuery = useGetTransferStockMovesQuery({ id, page: 1, limit: 200 }, {
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

  const transfer = transferQuery.data || null;
  const status = asText(transfer?.status).toLowerCase();

  const adapter = useMemo(() => createTransferShellAdapter({
    triggers: {
      executeTransferLine,
      fetchTransferById: async () => {
        const result = await transferQuery.refetch();
        return result.data;
      },
      fetchTransferStockMoves: async () => {
        const result = await transferHistoryQuery.refetch();
        return result.data;
      },
    },
    permissions,
  }), [executeTransferLine, permissions, transferHistoryQuery, transferQuery]);

  const historyItems = useMemo(() => (
    Array.isArray(transferHistoryQuery.data?.items) ? transferHistoryQuery.data.items : []
  ), [transferHistoryQuery.data?.items]);

  const initialRows = useMemo(() => {
    const items = Array.isArray(transfer?.items) ? transfer.items : [];
    return mergeTransferRowsWithMovedQty(items, historyItems).map(mapTransferItemToShellRow);
  }, [historyItems, transfer?.items]);

  const initialHeader = useMemo(() => ({
    fromWarehouseId: asText(transfer?.fromWarehouseId),
    toWarehouseId: asText(transfer?.toWarehouseId),
    sourceLocationId: asText(transfer?.sourceLocationId || transfer?.fromLocationId),
    targetLocationId: asText(transfer?.targetLocationId || transfer?.toLocationId),
    issueDate: asText(transfer?.issueDate),
  }), [
    transfer?.fromLocationId,
    transfer?.fromWarehouseId,
    transfer?.issueDate,
    transfer?.sourceLocationId,
    transfer?.targetLocationId,
    transfer?.toLocationId,
    transfer?.toWarehouseId,
  ]);

  if (transferQuery.isLoading || transferQuery.isFetching) {
    return <div style={{ padding: 24 }}>Loading transfer...</div>;
  }

  if (transferQuery.isError || !transfer || status !== 'draft') {
    return <WarehouseDocumentDetailPage kind="transfer" />;
  }

  return (
    <WmsDocumentShell
      config={mmConfig}
      mode="execute"
      documentId={id}
      adapter={adapter}
      initialHeader={initialHeader}
      initialRows={initialRows}
      originalHeader={initialHeader}
      originalRows={initialRows}
      resetKey={`${id}:${status}:${historyItems.length}`}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      onSaveSuccess={() => navigate(`/main/wms/transfers/${id}`, { replace: true })}
      onCancel={() => navigate(`/main/wms/transfers/${id}`)}
    />
  );
}
