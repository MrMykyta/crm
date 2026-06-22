import { useSearchParams } from 'react-router-dom';

import LocationsPage from '../LocationsPage';
import WarehousesPage from '../WarehousesPage';
import WmsSectionTabs from '../navigation/WmsSectionTabs';
import { WMS_SETUP_TABS, normalizeWmsTab } from '../navigation/wmsUiNavigation';
import WmsSettingsPanel from '../settings/WmsSettingsPanel';

function renderTab(tab) {
  if (tab === 'locations') return <LocationsPage />;
  if (tab === 'settings') return <WmsSettingsPanel />;
  return <WarehousesPage />;
}

export default function WmsSetupShellPage() {
  const [searchParams] = useSearchParams();
  const activeTab = normalizeWmsTab(searchParams.get('tab'), WMS_SETUP_TABS, 'warehouses');

  return (
    <>
      <WmsSectionTabs
        title="Setup"
        groups={[
          {
            key: 'setup',
            items: WMS_SETUP_TABS.map((tab) => ({
              ...tab,
              active: tab.key === activeTab,
            })),
          },
        ]}
      />
      {renderTab(activeTab)}
    </>
  );
}
