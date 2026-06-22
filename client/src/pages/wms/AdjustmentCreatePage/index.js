import { useSearchParams } from 'react-router-dom';

import PwCreateShellPage from '../WmsDocumentShell/PwCreateShellPage';
import RwCreateShellPage from '../WmsDocumentShell/RwCreateShellPage';

export default function AdjustmentCreatePage() {
  const [searchParams] = useSearchParams();

  const type = String(searchParams.get('type') || searchParams.get('documentType') || 'PW').trim().toUpperCase();
  if (type === 'RW') return <RwCreateShellPage />;
  return <PwCreateShellPage />;
}
