import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useCreateTransferMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { mmConfig } from '../documentTypes';
import { createTransferShellAdapter } from './createTransferShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

const INITIAL_HEADER = {
  fromWarehouseId: '',
  toWarehouseId: '',
  sourceLocationId: '',
  targetLocationId: '',
  issueDate: '',
};
const INITIAL_ROWS = [];

export default function MmCreateShellPage() {
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [createTransfer] = useCreateTransferMutation();
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

  const adapter = useMemo(() => createTransferShellAdapter({
    triggers: { createTransfer },
    permissions,
  }), [createTransfer, permissions]);

  const searchProducts = useCallback(async (query) => {
    const result = await searchProductPicker({
      q: query,
      page: 1,
      limit: 20,
      context: mmConfig.pickerContext,
    }).unwrap();
    return result;
  }, [searchProductPicker]);

  return (
    <WmsDocumentShell
      config={mmConfig}
      mode="create"
      adapter={adapter}
      initialHeader={INITIAL_HEADER}
      initialRows={INITIAL_ROWS}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      searchProducts={searchProducts}
      onSaveSuccess={(result) => navigate(`/main/wms/transfers/${result.documentId}`)}
      onCancel={() => navigate('/main/wms/transfers')}
    />
  );
}
