import { isWmsShellWzShipEnabled } from '../../../config/featureFlags';
import WzShipShellPage from '../WmsDocumentShell/WzShipShellPage';
import WarehouseDocumentDetailPage from '../WarehouseDocumentDetailPage';

export default function ShipmentDetailPage() {
  if (isWmsShellWzShipEnabled()) {
    return <WzShipShellPage />;
  }

  return <WarehouseDocumentDetailPage kind="shipment" />;
}
