import { useCallback, useMemo } from 'react';
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
import { mapTransferToShellPosted } from './postedViewMappers';
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
  const transferHistoryArgs = useMemo(() => ({ id, page: 1, limit: 200 }), [id]);

  const transferQuery = useGetTransferByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: false,
  });
  const transferHistoryQuery = useGetTransferStockMovesQuery(transferHistoryArgs, {
    skip: !id,
    refetchOnMountOrArgChange: false,
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
  const isPostedTransfer = ['completed', 'received'].includes(status);
  const refetchTransfer = transferQuery.refetch;
  const refetchTransferHistory = transferHistoryQuery.refetch;

  const fetchTransferById = useCallback(async () => {
    const result = await refetchTransfer();
    return result.data;
  }, [refetchTransfer]);

  const fetchTransferStockMoves = useCallback(async () => {
    const result = await refetchTransferHistory();
    return result.data;
  }, [refetchTransferHistory]);

  const adapter = useMemo(() => createTransferShellAdapter({
    triggers: {
      executeTransferLine,
      fetchTransferById,
      fetchTransferStockMoves,
    },
    permissions,
  }), [executeTransferLine, fetchTransferById, fetchTransferStockMoves, permissions]);

  const historyItems = useMemo(() => (
    Array.isArray(transferHistoryQuery.data?.items) ? transferHistoryQuery.data.items : []
  ), [transferHistoryQuery.data?.items]);

  const initialRows = useMemo(() => {
    const items = Array.isArray(transfer?.items) ? transfer.items : [];
    return mergeTransferRowsWithMovedQty(items, historyItems).map(mapTransferItemToShellRow);
  }, [historyItems, transfer?.items]);

  const postedModel = useMemo(() => {
    const items = Array.isArray(transfer?.items) ? transfer.items : [];
    return mapTransferToShellPosted({
      ...(transfer || {}),
      items: mergeTransferRowsWithMovedQty(items, historyItems),
    });
  }, [historyItems, transfer]);

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

  if (transferQuery.isLoading) {
    return <div style={{ padding: 24 }}>Loading transfer...</div>;
  }

  if (transferQuery.isError || !transfer) {
    return <WarehouseDocumentDetailPage kind="transfer" />;
  }

  if (isPostedTransfer) {
    return (
      <WmsDocumentShell
        config={mmConfig}
        mode="posted"
        documentId={id}
        adapter={adapter}
        initialHeader={postedModel.header}
        initialRows={postedModel.rows}
        originalHeader={postedModel.header}
        originalRows={postedModel.rows}
        resetKey={`${id}:posted:${status}:${historyItems.length}`}
        warehouses={warehousesData?.items || []}
        locations={locationsData?.items || []}
        postedMeta={{
          documentNumber: postedModel.header.documentNumber,
          status: postedModel.header.status,
        }}
        printUrl={`/main/wms/transfers/${id}/print`}
        stockMoves={historyItems}
        onCancel={() => navigate('/main/wms/documents?type=MM')}
      />
    );
  }

  if (status !== 'draft') {
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
