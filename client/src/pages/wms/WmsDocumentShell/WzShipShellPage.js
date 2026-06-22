import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useCreateShipmentCorrectionMutation,
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
import { mapShipmentToShellPosted } from './postedViewMappers';
import WmsDocumentShell from './WmsDocumentShell';
import WzParcelsSection from './WzParcelsSection';

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
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [shipShipmentItem] = useShipShipmentItemMutation();
  const [createShipmentCorrection] = useCreateShipmentCorrectionMutation();
  const isCorrectionRoute = location.pathname.endsWith('/correction');

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
  const isPostedShipment = ['shipped', 'corrected', 'cancelled', 'canceled'].includes(status);
  const isCorrectionEligible = Boolean(shipment)
    && !shipment.parentDocumentId
    && !shipment.correctedById
    && status === 'shipped';

  const adapter = useMemo(() => createShipmentShellAdapter({
    triggers: {
      shipShipmentItem,
      createShipmentCorrection,
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
  }), [createShipmentCorrection, permissions, shipShipmentItem, shipmentHistoryQuery, shipmentQuery]);

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
  const postedModel = useMemo(() => {
    const items = Array.isArray(shipment?.items) ? shipment.items : [];
    return mapShipmentToShellPosted({
      ...(shipment || {}),
      items: mergeShipmentRowsWithShippedQty(items, historyItems),
    });
  }, [historyItems, shipment]);

  const onCorrectionSuccess = useCallback(async (result) => {
    await shipmentQuery.refetch();
    const correctionId = result?.documentId || result?.raw?.id;
    if (correctionId) {
      navigate(`/main/wms/shipments/${correctionId}`);
      return;
    }
    navigate(`/main/wms/shipments/${id}`);
  }, [id, navigate, shipmentQuery]);

  if (shipmentQuery.isLoading || (shipmentQuery.isFetching && !shipment)) {
    return <div style={{ padding: 24 }}>Loading shipment...</div>;
  }

  if (shipmentQuery.isError || !shipment) {
    return <WarehouseDocumentDetailPage kind="shipment" />;
  }

  if (isCorrectionRoute && isCorrectionEligible) {
    return (
      <WmsDocumentShell
        config={wzConfig}
        mode="correction"
        documentId={id}
        adapter={adapter}
        initialHeader={postedModel.header}
        initialRows={postedModel.rows}
        originalHeader={postedModel.header}
        originalRows={postedModel.rows}
        resetKey={`${id}:correction:${status}:${historyItems.length}:${shipment?.updatedAt || ''}`}
        warehouses={warehousesData?.items || []}
        locations={locationsData?.items || []}
        postedMeta={{
          documentNumber: postedModel.header.documentNumber,
          status: postedModel.header.status,
        }}
        onSaveSuccess={onCorrectionSuccess}
        onCancel={() => navigate(`/main/wms/shipments/${id}`)}
      />
    );
  }

  if (isPostedShipment) {
    return (
      <WmsDocumentShell
        config={wzConfig}
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
        printUrl={`/main/wms/shipments/${id}/print`}
        correctionUrl={isCorrectionEligible ? `/main/wms/shipments/${id}/correction` : ''}
        stockMoves={historyItems}
        postedExtraSections={<WzParcelsSection shipmentId={id} />}
        onCancel={() => navigate('/main/wms/documents?type=WZ')}
      />
    );
  }

  if (status !== 'packing') {
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
