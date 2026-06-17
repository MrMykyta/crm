import WmsDocumentCreatePage from '../WmsDocumentCreatePage';
import { isWmsShellMmCreateEnabled } from '../../../config/featureFlags';
import MmCreateShellPage from '../WmsDocumentShell/MmCreateShellPage';

export default function TransferCreatePage() {
  if (isWmsShellMmCreateEnabled()) {
    return <MmCreateShellPage />;
  }

  return <WmsDocumentCreatePage kind="transfer" />;
}
