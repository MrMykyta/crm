import { isWmsShellMmExecuteEnabled } from '../../../config/featureFlags';
import MmExecuteShellPage from '../WmsDocumentShell/MmExecuteShellPage';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';

export default function TransferDetailPage() {
  if (isWmsShellMmExecuteEnabled()) {
    return <MmExecuteShellPage />;
  }

  return <WarehouseDocumentDetailPage kind="transfer" />;
}
