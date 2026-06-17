import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useCreateCycleCountMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { ccConfig } from '../documentTypes';
import { createCycleCountShellAdapter } from './createCycleCountShellAdapter';
import WmsDocumentShell from './WmsDocumentShell';

const INITIAL_HEADER = {
  warehouseId: '',
  locationId: '',
};
const INITIAL_ROWS = [];

export default function CcCreateShellPage() {
  const navigate = useNavigate();
  const permissions = useAclPermissions();
  const [createCycleCount] = useCreateCycleCountMutation();

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

  const adapter = useMemo(() => createCycleCountShellAdapter({
    triggers: { createCycleCount },
    permissions,
  }), [createCycleCount, permissions]);

  return (
    <WmsDocumentShell
      config={ccConfig}
      mode="create"
      adapter={adapter}
      initialHeader={INITIAL_HEADER}
      initialRows={INITIAL_ROWS}
      warehouses={warehousesData?.items || []}
      locations={locationsData?.items || []}
      onSaveSuccess={(result) => navigate(`/main/wms/cycle-counts/${result.documentId}`)}
      onCancel={() => navigate('/main/wms/cycle-counts')}
    />
  );
}
