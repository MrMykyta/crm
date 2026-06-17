import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useGetShipmentByIdQuery,
  useGetShipmentStockMovesQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  useShipShipmentItemMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';
import { wzConfig } from '../documentTypes';
import {
  createShipmentShellAdapter,
  mergeShipmentRowsWithShippedQty,
} from './createShipmentShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function mapShipmentItemToShellRow(item = {}, index = 0) {
  return {
    localId: item.localId || item.id || `shipment-item-${index}`,
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
    qtyShipped: asText(item.qtyShipped ?? ''),
    status: asText(item.status),
  };
}

export default function WzShipShellPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [shipShipmentItem] = useShipShipmentItemMutation();

  const shipmentQuery = useGetShipmentByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const shipmentHistoryQuery = useGetShipmentStockMovesQuery({ id, page: 1, limit: 200 }, {
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

  const shipment = shipmentQuery.data || null;
  const status = asText(shipment?.status).toLowerCase();

  const adapter = useMemo(() => createShipmentShellAdapter({
    triggers: {
      shipShipmentItem,
      fetchShipmentById: async () => {
        const result = await shipmentQuery.refetch();
        return result.data;
      },
      fetchShipmentStockMoves: async () => {
        const result = await shipmentHistoryQuery.refetch();
        return result.data;
      },
    },
    permissions,
  }), [permissions, shipShipmentItem, shipmentHistoryQuery, shipmentQuery]);

  const historyItems = useMemo(() => (
    Array.isArray(shipmentHistoryQuery.data?.items) ? shipmentHistoryQuery.data.items : []
  ), [shipmentHistoryQuery.data?.items]);

  const initialRows = useMemo(() => {
    const items = Array.isArray(shipment?.items) ? shipment.items : [];
    return mergeShipmentRowsWithShippedQty(items, historyItems).map(mapShipmentItemToShellRow);
  }, [historyItems, shipment?.items]);

  const initialHeader = useMemo(() => ({
    warehouseId: asText(shipment?.warehouseId),
    fromLocationId: '',
    orderId: asText(shipment?.orderId),
  }), [shipment?.orderId, shipment?.warehouseId]);

  if (shipmentQuery.isLoading || shipmentQuery.isFetching) {
    return <div style={{ padding: 24 }}>Loading shipment...</div>;
  }

  if (shipmentQuery.isError || !shipment || status !== 'packing') {
    return <WarehouseDocumentDetailPage kind="shipment" />;
  }

  return (
    <WmsDocumentShell
      config={wzConfig}
      mode="ship"
      documentId={id}
      adapter={adapter}
      initialHeader={initialHeader}
      initialRows={initialRows}
      originalHeader={initialHeader}
      originalRows={initialRows}
      resetKey={`${id}:${status}:${historyItems.length}`}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      onSaveSuccess={() => navigate(`/main/wms/shipments/${id}`, { replace: true })}
      onCancel={() => navigate(`/main/wms/shipments/${id}`)}
    />
  );
}
