import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';
import { isWmsShellPzDraftEditEnabled } from '../../../config/featureFlags';
import PzDraftShellPage from '../WmsDocumentShell/PzDraftShellPage';

export default function ReceiptDetailPage() {
  if (isWmsShellPzDraftEditEnabled()) {
    return <PzDraftShellPage />;
  }

  return <WarehouseDocumentDetailPage kind="receipt" />;
}
