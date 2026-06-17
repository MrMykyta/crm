import { useSearchParams } from 'react-router-dom';

import { isWmsShellAdjustmentCreateEnabled } from '../../../config/featureFlags';
import PwCreateShellPage from '../WmsDocumentShell/PwCreateShellPage';
import RwCreateShellPage from '../WmsDocumentShell/RwCreateShellPage';
import WmsDocumentCreatePage from '../WmsDocumentCreatePage';

export default function AdjustmentCreatePage() {
  const [searchParams] = useSearchParams();

  if (isWmsShellAdjustmentCreateEnabled()) {
    const type = String(searchParams.get('type') || searchParams.get('documentType') || 'PW').trim().toUpperCase();
    if (type === 'RW') return <RwCreateShellPage />;
    return <PwCreateShellPage />;
  }

  return <WmsDocumentCreatePage kind="adjustment" />;
}
