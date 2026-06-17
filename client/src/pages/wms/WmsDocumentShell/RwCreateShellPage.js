import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useCreateAdjustmentMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { rwConfig } from '../documentTypes';
import { createAdjustmentShellAdapter } from './createAdjustmentShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

const INITIAL_HEADER = {
  documentType: 'RW',
  warehouseId: '',
  locationId: '',
  reason: '',
  issueDate: '',
};
const INITIAL_ROWS = [];

export default function RwCreateShellPage() {
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [createAdjustment] = useCreateAdjustmentMutation();
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

  const adapter = useMemo(() => createAdjustmentShellAdapter({
    triggers: { createAdjustment },
    permissions,
  }), [createAdjustment, permissions]);

  const searchProducts = useCallback(async (query) => {
    const result = await searchProductPicker({
      q: query,
      page: 1,
      limit: 20,
      context: rwConfig.pickerContext,
    }).unwrap();
    return result;
  }, [searchProductPicker]);

  return (
    <WmsDocumentShell
      config={rwConfig}
      mode="create"
      adapter={adapter}
      initialHeader={INITIAL_HEADER}
      initialRows={INITIAL_ROWS}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      searchProducts={searchProducts}
      onSaveSuccess={(result) => navigate(`/main/wms/adjustments/${result.documentId}`)}
      onCancel={() => navigate('/main/wms/adjustments')}
    />
  );
}
