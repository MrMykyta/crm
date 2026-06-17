import { isWmsShellAdjustmentPostEnabled } from '../../../config/featureFlags';
import AdjustmentPostShellPage from '../WmsDocumentShell/AdjustmentPostShellPage';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';

export default function AdjustmentDetailPage() {
  if (isWmsShellAdjustmentPostEnabled()) {
    return <AdjustmentPostShellPage />;
  }

  return <WarehouseDocumentDetailPage kind="adjustment" />;
}
