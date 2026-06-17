import WmsDocumentCreatePage from '../WmsDocumentCreatePage';
import { isWmsShellPzCreateEnabled } from '../../../config/featureFlags';
import PzCreateShellPage from '../WmsDocumentShell/PzCreateShellPage';

export default function ReceiptCreatePage() {
  if (isWmsShellPzCreateEnabled()) {
    return <PzCreateShellPage />;
  }

  return <WmsDocumentCreatePage kind="receipt" />;
}
