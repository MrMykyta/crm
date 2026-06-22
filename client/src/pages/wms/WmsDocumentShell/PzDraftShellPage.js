import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useAddReceiptDraftItemMutation,
  useCreateReceiptCorrectionMutation,
  useGetReceiptByIdQuery,
  useGetReceiptStockMovesQuery,
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
import { mapReceiptToShellDraft, mapReceiptToShellPosted } from './rowControllerModel';
import WmsDocumentShell from './WmsDocumentShell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isDraftReceipt(receipt) {
  return asText(receipt?.status).toLowerCase() === 'draft';
}

function isPostedReceipt(receipt) {
  return ['received', 'corrected', 'partially_received'].includes(asText(receipt?.status).toLowerCase());
}

function isCorrectionEligible(receipt) {
  const status = asText(receipt?.status).toLowerCase();
  return Boolean(receipt)
    && !receipt.parentDocumentId
    && !receipt.correctedById
    && ['received', 'putaway'].includes(status);
}

function LoadingState() {
  return <div style={{ padding: 24 }}>Loading...</div>;
}

export default function PzDraftShellPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [revision, setRevision] = useState(0);

  const receiptQuery = useGetReceiptByIdQuery(id, { skip: !id });
  const receiptIsPosted = isPostedReceipt(receiptQuery.data);
  const historyArgs = useMemo(() => ({ id, page: 1, limit: 200 }), [id]);
  const receiptHistoryQuery = useGetReceiptStockMovesQuery(historyArgs, {
    skip: !id || !receiptIsPosted,
  });
  const [updateReceiptDraft] = useUpdateReceiptDraftMutation();
  const [addReceiptDraftItem] = useAddReceiptDraftItemMutation();
  const [updateReceiptDraftItem] = useUpdateReceiptDraftItemMutation();
  const [removeReceiptDraftItem] = useRemoveReceiptDraftItemMutation();
  const [receiveReceiptLine] = useReceiveReceiptLineMutation();
  const [createReceiptCorrection] = useCreateReceiptCorrectionMutation();
  const [searchProductPicker] = useLazyProductPickerQuery();
  const isCorrectionRoute = location.pathname.endsWith('/correction');

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
      createReceiptCorrection,
    },
    permissions,
  }), [
    addReceiptDraftItem,
    createReceiptCorrection,
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
  const postedModel = useMemo(() => mapReceiptToShellPosted(receipt || {}, pzConfig), [receipt]);

  const onSaveSuccess = useCallback(async () => {
    await receiptQuery.refetch();
    setRevision((prev) => prev + 1);
  }, [receiptQuery]);

  const onCorrectionSuccess = useCallback(async (result) => {
    await receiptQuery.refetch();
    const correctionId = result?.documentId || result?.raw?.id;
    if (correctionId) {
      navigate(`/main/wms/receipts/${correctionId}`);
      return;
    }
    navigate(`/main/wms/receipts/${id}`);
  }, [id, navigate, receiptQuery]);

  if (receiptQuery.isLoading || (receiptQuery.isFetching && !receiptQuery.data)) return <LoadingState />;
  if (!receipt) {
    return <WarehouseDocumentDetailPage kind="receipt" />;
  }
  if (isCorrectionRoute && isCorrectionEligible(receipt)) {
    return (
      <WmsDocumentShell
        key={`${id}:correction:${revision}`}
        config={pzConfig}
        mode="correction"
        documentId={id}
        adapter={adapter}
        initialHeader={postedModel.header}
        initialRows={postedModel.rows}
        originalHeader={postedModel.header}
        originalRows={postedModel.rows}
        resetKey={`${id}:correction:${revision}:${receipt?.updatedAt || ''}:${receipt?.items?.length || 0}`}
        warehouses={warehousesData?.items || []}
        locations={locationsData?.items || []}
        postedMeta={{
          documentNumber: postedModel.header.documentNumber,
          status: postedModel.header.status,
        }}
        onSaveSuccess={onCorrectionSuccess}
        onCancel={() => navigate(`/main/wms/receipts/${id}`)}
      />
    );
  }
  if (isPostedReceipt(receipt)) {
    return (
      <WmsDocumentShell
        key={`${id}:posted:${revision}`}
        config={pzConfig}
        mode="posted"
        documentId={id}
        adapter={adapter}
        initialHeader={postedModel.header}
        initialRows={postedModel.rows}
        originalHeader={postedModel.header}
        originalRows={postedModel.rows}
        resetKey={`${id}:posted:${revision}:${receipt?.updatedAt || ''}:${receipt?.items?.length || 0}`}
        warehouses={warehousesData?.items || []}
        locations={locationsData?.items || []}
        postedMeta={{
          documentNumber: postedModel.header.documentNumber,
          status: postedModel.header.status,
        }}
        printUrl={`/main/wms/receipts/${id}/print`}
        correctionUrl={isCorrectionEligible(receipt) ? `/main/wms/receipts/${id}/correction` : ''}
        stockMoves={receiptHistoryQuery.data?.items || []}
        onCancel={() => navigate('/main/wms/documents?type=PZ')}
      />
    );
  }
  if (!isDraftReceipt(receipt)) {
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
