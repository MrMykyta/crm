import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import { useLazyProductPickerQuery } from '../../../store/rtk/productsApi';
import {
  useCreateShipmentMutation,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { wzConfig } from '../documentTypes';
import { createShipmentShellAdapter } from './createShipmentShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

const INITIAL_HEADER = { warehouseId: '', orderId: '' };
const INITIAL_ROWS = [];

export default function WzCreateShellPage() {
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [createShipment] = useCreateShipmentMutation();
  const [searchProductPicker] = useLazyProductPickerQuery();

  const { data: warehousesData } = useListWarehousesQuery({
    limit: 200,
    sort: 'name',
    dir: 'ASC',
  });

  const adapter = useMemo(() => createShipmentShellAdapter({
    triggers: { createShipment },
    permissions,
  }), [createShipment, permissions]);

  const searchProducts = useCallback(async (query) => {
    const result = await searchProductPicker({
      q: query,
      page: 1,
      limit: 20,
      context: wzConfig.pickerContext,
    }).unwrap();
    return result;
  }, [searchProductPicker]);

  return (
    <WmsDocumentShell
      config={wzConfig}
      mode="create"
      adapter={adapter}
      initialHeader={INITIAL_HEADER}
      initialRows={INITIAL_ROWS}
      warehouses={warehousesData?.items || []}
      locations={[]}
      searchProducts={searchProducts}
      onSaveSuccess={(result) => navigate(`/main/wms/shipments/${result.documentId}`)}
      onCancel={() => navigate('/main/wms/shipments')}
    />
  );
}
