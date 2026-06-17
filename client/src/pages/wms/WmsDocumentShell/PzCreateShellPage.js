import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useCreateReceiptMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { pzConfig } from '../documentTypes';
import { createReceiptShellAdapter } from './createReceiptShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

const INITIAL_HEADER = { warehouseId: '', inboundLocationId: '', issueDate: '' };
const INITIAL_ROWS = [];

export default function PzCreateShellPage() {
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [createReceipt] = useCreateReceiptMutation();
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

  const adapter = useMemo(() => createReceiptShellAdapter({
    triggers: { createReceipt },
    permissions,
  }), [createReceipt, permissions]);

  const searchProducts = useCallback(async (query) => {
    const result = await searchProductPicker({
      q: query,
      page: 1,
      limit: 20,
      context: pzConfig.pickerContext,
    }).unwrap();
    return result;
  }, [searchProductPicker]);

  return (
    <WmsDocumentShell
      config={pzConfig}
      mode="create"
      adapter={adapter}
      initialHeader={INITIAL_HEADER}
      initialRows={INITIAL_ROWS}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      searchProducts={searchProducts}
      onSaveSuccess={(result) => navigate(`/main/wms/receipts/${result.documentId}`)}
      onCancel={() => navigate('/main/wms/receipts')}
    />
  );
}
