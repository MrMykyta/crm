import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import useAclPermissions from '../../../hooks/useAclPermissions';
import s from '../WmsMasterDataPage.module.css';

const LINKS = [
  { key: 'documents', to: '/main/wms/documents', titleKey: 'menu.wmsDocuments' },
  { key: 'receipts', to: '/main/wms/receipts', titleKey: 'menu.wmsReceipts' },
  { key: 'transfers', to: '/main/wms/transfers', titleKey: 'menu.transfers' },
  { key: 'shipments', to: '/main/wms/shipments', titleKey: 'menu.wmsShipments' },
  { key: 'adjustments', to: '/main/wms/adjustments', titleKey: 'menu.wmsAdjustments' },
  { key: 'cycleCounts', to: '/main/wms/cycle-counts', titleKey: 'menu.wmsCycleCounts' },
  { key: 'stockBalances', to: '/main/wms/stock-balances', titleKey: 'menu.stockBalances' },
  { key: 'stockMoves', to: '/main/wms/stock-moves', titleKey: 'menu.wmsStockMoves' },
  { key: 'warehouses', to: '/main/wms/warehouses', titleKey: 'menu.wmsWarehouses' },
  { key: 'locations', to: '/main/wms/locations', titleKey: 'menu.wmsLocations' },
  { key: 'reports', to: '/main/wms/reports/stock-valuation', titleKey: 'menu.wmsReports' },
];

export default function WmsOverviewPage() {
  const { t } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:read');

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.overview.noReadPermission', 'You do not have permission to view WMS.')}</p>
      </div>
    );
  }

  return (
    <div className={s.overview}>
      <h1>{t('wms.overview.title', 'WMS overview')}</h1>
      <p>{t('wms.overview.subtitle', 'Warehouse operations, stock visibility and WMS reference data.')}</p>
      <div className={s.linkGrid}>
        {LINKS.map((link) => (
          <Link key={link.key} className={s.linkTile} to={link.to}>
            <strong>{t(link.titleKey)}</strong>
            <span>{t(`wms.overview.links.${link.key}`, 'Open section')}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
