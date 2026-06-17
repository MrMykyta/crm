import { Link, useSearchParams } from 'react-router-dom';

import LocationsPage from '../LocationsPage';
import WarehousesPage from '../WarehousesPage';
import WmsSectionTabs from '../navigation/WmsSectionTabs';
import { WMS_SETUP_TABS, normalizeWmsTab } from '../navigation/wmsUiNavigation';
import s from './WmsSetupShellPage.module.css';

function SettingsPanel() {
  return (
    <div className={s.panel}>
      <h2>Settings</h2>
      <p>WMS settings are managed in the existing company settings page.</p>
      <Link to="/main/company-settings/warehouse" className={s.link}>
        Open WMS settings
      </Link>
    </div>
  );
}

function renderTab(tab) {
  if (tab === 'locations') return <LocationsPage />;
  if (tab === 'settings') return <SettingsPanel />;
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
