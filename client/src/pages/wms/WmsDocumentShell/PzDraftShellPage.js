import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useAddReceiptDraftItemMutation,
  useGetReceiptByIdQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  useRemoveReceiptDraftItemMutation,
  useReceiveReceiptLineMutation,
  useUpdateReceiptDraftItemMutation,
  useUpdateReceiptDraftMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import { pzConfig } from '../documentTypes';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';
import { createReceiptShellAdapter } from './createReceiptShellAdapter';
import { mapReceiptToShellDraft } from './rowControllerModel';
import WmsDocumentShell from './WmsDocumentShell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isDraftReceipt(receipt) {
  return asText(receipt?.status).toLowerCase() === 'draft';
}

function LoadingState() {
  return <div style={{ padding: 24 }}>Loading...</div>;
}

export default function PzDraftShellPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [revision, setRevision] = useState(0);

  const receiptQuery = useGetReceiptByIdQuery(id, { skip: !id });
  const [updateReceiptDraft] = useUpdateReceiptDraftMutation();
  const [addReceiptDraftItem] = useAddReceiptDraftItemMutation();
  const [updateReceiptDraftItem] = useUpdateReceiptDraftItemMutation();
  const [removeReceiptDraftItem] = useRemoveReceiptDraftItemMutation();
  const [receiveReceiptLine] = useReceiveReceiptLineMutation();
  const [searchProductPicker] = useLazyProductPickerQuery();

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

  const receipt = receiptQuery.data;

  const adapter = useMemo(() => createReceiptShellAdapter({
    triggers: {
      fetchReceiptById: () => receiptQuery.refetch().unwrap(),
      updateReceiptDraft,
      addReceiptDraftItem,
      updateReceiptDraftItem,
      removeReceiptDraftItem,
      receiveReceiptLine,
    },
    permissions,
  }), [
    addReceiptDraftItem,
    permissions,
    receiveReceiptLine,
    receiptQuery,
    removeReceiptDraftItem,
    updateReceiptDraft,
    updateReceiptDraftItem,
  ]);

  const searchProducts = useCallback(async (query) => {
    const result = await searchProductPicker({
      q: query,
      page: 1,
      limit: 20,
      context: pzConfig.pickerContext,
      warehouseId: receipt?.warehouseId || undefined,
    }).unwrap();
    return result;
  }, [receipt?.warehouseId, searchProductPicker]);

  const draftModel = useMemo(() => mapReceiptToShellDraft(receipt || {}, pzConfig), [receipt]);

  const onSaveSuccess = useCallback(async () => {
    await receiptQuery.refetch();
    setRevision((prev) => prev + 1);
  }, [receiptQuery]);

  if (receiptQuery.isLoading || (receiptQuery.isFetching && !receiptQuery.data)) return <LoadingState />;
  if (!receipt || !isDraftReceipt(receipt)) {
    return <WarehouseDocumentDetailPage kind="receipt" />;
  }

  return (
    <WmsDocumentShell
      key={`${id}:${revision}`}
      config={pzConfig}
      mode="draft"
      documentId={id}
      adapter={adapter}
      initialHeader={draftModel.header}
      initialRows={draftModel.rows}
      originalHeader={draftModel.header}
      originalRows={draftModel.rows}
      resetKey={`${id}:${revision}:${receipt?.updatedAt || ''}:${receipt?.items?.length || 0}`}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      searchProducts={searchProducts}
      onSaveSuccess={onSaveSuccess}
      onCancel={() => navigate('/main/wms/receipts')}
    />
  );
}
