import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Warehouse, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  WmsEmptyState,
  WmsErrorState,
  WmsLoadingState,
  WmsStatusChip,
  WmsSurface,
} from '../../../components/wms/ui';
import { SearchField, SelectField } from '../../../components/ui/fields';
import { useGetStockBalancesQuery } from '../../../store/rtk/stockBalancesApi';
import {
  useListLocationsQuery,
  useListLotsQuery,
  useListReservationsQuery,
  useListSerialsQuery,
  useListStockMovesQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { WMS_INVENTORY_TABS } from '../navigation/wmsUiNavigation';
import InventoryLedgerReportPage from '../InventoryLedgerReportPage';
import {
  getWmsLocationMode,
  getWmsLocationModeDescription,
  getWmsLocationModeLabel,
  isAdvancedLocationMode,
} from '../locationsMode';
import StockAsOfReportPage from '../StockAsOfReportPage';
import StockTurnoverReportPage from '../StockTurnoverReportPage';
import StockValuationReportPage from '../StockValuationReportPage';
import {
  buildScopedInventoryQuery,
  filterInventoryRows,
  getInventoryWorkspaceTab,
  getStockLevelStatus,
  getWarehouseLabel,
  hasLocations,
  normalizeBalanceRow,
} from './wmsInventoryWorkspaceModel';
import s from './WmsInventoryShellPage.module.css';

const DRILL_TABS = [
  { key: 'movements', label: 'Movements' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'lots', label: 'Lots' },
  { key: 'serials', label: 'Serials' },
  { key: 'locations', label: 'Locations' },
];

const REPORT_TABS = [
  {
    key: 'valuation',
    label: 'Valuation',
    description: 'Current FIFO stock value by product and warehouse.',
    render: () => <StockValuationReportPage embedded />,
  },
  {
    key: 'ledger',
    label: 'Ledger',
    description: 'Product movement ledger with running quantity and value.',
    render: () => <InventoryLedgerReportPage embedded />,
  },
  {
    key: 'as-of',
    label: 'As-Of',
    description: 'Historical stock snapshot at a selected date and time.',
    render: () => <StockAsOfReportPage embedded />,
  },
  {
    key: 'turnover',
    label: 'Turnover',
    description: 'Stock movement turnover over a selected period.',
    render: () => <StockTurnoverReportPage embedded />,
  },
];

function getInventoryReportTab(value) {
  const normalized = String(value || '').toLowerCase();
  return REPORT_TABS.some((tab) => tab.key === normalized) ? normalized : 'valuation';
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function rowsFromListResponse(data) {
  return Array.isArray(data?.items) ? data.items : [];
}

function formatQty(value, locale = 'en') {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(number);
}

function formatDate(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '-';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function productLabel(row = {}) {
  const name = asText(row.product?.name || row.productName);
  const sku = asText(row.product?.sku || row.productSku);
  if (name && sku) return `${name} (${sku})`;
  return name || sku || asText(row.productId) || '-';
}

function variantLabel(row = {}) {
  return asText(row.variant?.name || row.variantName || row.variantSku || row.variantId) || '-';
}

function locationLabel(location, fallbackId) {
  return asText(location?.code || location?.name) || asText(fallbackId) || '-';
}

function stockMoveSourceRoute(row = {}) {
  if (row.receiptId) return `/main/wms/receipts/${row.receiptId}`;
  if (row.shipmentId) return `/main/wms/shipments/${row.shipmentId}`;
  if (row.transferId) return `/main/wms/transfers/${row.transferId}`;
  if (row.adjustmentId) return `/main/wms/adjustments/${row.adjustmentId}`;
  if (row.cycleCountId) return `/main/wms/cycle-counts/${row.cycleCountId}`;
  return '';
}

function stockMoveSourceLabel(row = {}) {
  const type = asText(row.refType || row.sourceType);
  const id = asText(row.refId || row.sourceId);
  if (type && id) return `${type}: ${id}`;
  return type || id || '-';
}

function getErrorText(error) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || 'Failed to load inventory.';
}

function updateParam(searchParams, navigate, key, value) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value);
  else next.delete(key);
  navigate({ pathname: '/main/wms/inventory', search: next.toString() ? `?${next.toString()}` : '' });
}

function DataTable({ columns, rows, rowKey, onRowClick, emptyTitle, emptyDescription }) {
  if (!rows.length) {
    return (
      <WmsEmptyState
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    );
  }

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? s.numeric : ''}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const clickable = typeof onRowClick === 'function';
            return (
              <tr
                key={rowKey(row, index)}
                className={clickable ? s.clickableRow : ''}
                onClick={clickable ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? s.numeric : ''}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InlineLinkButton({ children, onClick }) {
  if (!onClick) return children;
  return (
    <button type="button" className={s.inlineLink} onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}>
      {children}
    </button>
  );
}

function InventoryToolbar({
  warehouses,
  warehouseId,
  search,
  searchParams,
  navigate,
}) {
  return (
    <WmsSurface as="section" variant="soft" padding="sm" className={s.controls} aria-label="Inventory controls">
      <label className={s.selectBox}>
        <Warehouse size={16} aria-hidden="true" />
        <span>Warehouse</span>
        <SelectField
          value={warehouseId}
          onValueChange={(value) => updateParam(searchParams, navigate, 'warehouseId', value)}
          options={[
            { value: '', label: 'All warehouses' },
            ...warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: getWarehouseLabel(warehouse),
            })),
          ]}
        />
      </label>
      <label className={s.searchBox}>
        <Search size={16} aria-hidden="true" />
        <SearchField
          value={search}
          placeholder="Search inventory"
          onValueChange={(value) => updateParam(searchParams, navigate, 'search', value)}
        />
      </label>
      <div className={s.filterHint}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Filters use existing WMS data</span>
      </div>
    </WmsSurface>
  );
}

function InventoryReportsWorkspace({ activeReport }) {
  const report = REPORT_TABS.find((tab) => tab.key === activeReport) || REPORT_TABS[0];

  return (
    <div className={s.reportsWorkspace}>
      <div className={s.reportTabs} role="tablist" aria-label="Inventory report tabs">
        {REPORT_TABS.map((tab) => (
          <Link
            key={tab.key}
            to={`/main/wms/inventory?tab=reports&report=${tab.key}`}
            className={`${s.reportTab} ${tab.key === report.key ? s.active : ''}`}
            role="tab"
            aria-selected={tab.key === report.key ? 'true' : 'false'}
          >
            <strong>{tab.label}</strong>
            <span>{tab.description}</span>
          </Link>
        ))}
      </div>
      <div className={s.reportBody}>
        {report.render()}
      </div>
    </div>
  );
}

function DrillPanel({
  item,
  activeTab,
  setActiveTab,
  onClose,
  locale,
  navigate,
  queries,
  locationMode,
}) {
  if (!item) return null;

  const advancedLocations = isAdvancedLocationMode(locationMode);
  const drillTabs = advancedLocations ? DRILL_TABS : DRILL_TABS.filter((tab) => tab.key !== 'locations');
  const selectedTab = drillTabs.some((tab) => tab.key === activeTab) ? activeTab : 'movements';
  const query = queries[selectedTab];
  const loading = query?.isFetching && !query?.data;
  const error = query?.error;
  const rows = rowsFromListResponse(query?.data);

  const renderContent = () => {
    if (loading) return <WmsLoadingState title="Loading item drill" rows={4} compact />;
    if (error) {
      return (
        <WmsErrorState
          title="Failed to load item drill"
          description={getErrorText(error)}
          onRetry={query?.refetch}
          compact
        />
      );
    }

    if (selectedTab === 'movements') {
      return (
        <DataTable
          rows={rows}
          rowKey={(row, index) => row.id || `move-${index}`}
          emptyTitle="No movements"
          emptyDescription="No stock moves exist for this item in the current scope."
          columns={[
            { key: 'date', label: 'Date', render: (row) => formatDate(row.createdAt, locale) },
            { key: 'type', label: 'Type', render: (row) => <WmsStatusChip status={row.type} size="sm" /> },
            { key: 'qty', label: 'Qty', numeric: true, render: (row) => formatQty(row.qty, locale) },
            { key: 'source', label: 'Source', render: (row) => {
              const route = stockMoveSourceRoute(row);
              return route ? <Link to={route} className={s.textLink}>{stockMoveSourceLabel(row)}</Link> : stockMoveSourceLabel(row);
            } },
          ]}
        />
      );
    }

    if (selectedTab === 'reservations') {
      return (
        <DataTable
          rows={rows}
          rowKey={(row, index) => row.id || `reservation-${index}`}
          emptyTitle="No reservations"
          emptyDescription="No reservations exist for this item."
          columns={[
            { key: 'status', label: 'Status', render: (row) => <WmsStatusChip status={row.status} size="sm" /> },
            { key: 'qty', label: 'Qty', numeric: true, render: (row) => formatQty(row.qty, locale) },
            { key: 'order', label: 'Source order', render: (row) => asText(row.orderId) || '-' },
          ]}
        />
      );
    }

    if (selectedTab === 'lots') {
      return (
        <DataTable
          rows={rows}
          rowKey={(row, index) => row.id || `lot-${index}`}
          emptyTitle="No lots"
          emptyDescription="No lots exist for this item."
          columns={[
            { key: 'lot', label: 'Lot', render: (row) => asText(row.lotNumber) || '-' },
            { key: 'expiry', label: 'Expiry', render: (row) => formatDate(row.expDate, locale) },
            { key: 'created', label: 'Created', render: (row) => formatDate(row.createdAt, locale) },
          ]}
        />
      );
    }

    if (selectedTab === 'serials') {
      return (
        <DataTable
          rows={rows}
          rowKey={(row, index) => row.id || `serial-${index}`}
          emptyTitle="No serials"
          emptyDescription="No serials exist for this item."
          columns={[
            { key: 'serial', label: 'Serial', render: (row) => asText(row.serialNumber) || '-' },
            { key: 'created', label: 'Created', render: (row) => formatDate(row.createdAt, locale) },
          ]}
        />
      );
    }

    return (
      <DataTable
        rows={rows}
        rowKey={(row, index) => row.id || `location-${index}`}
        emptyTitle="No locations"
        emptyDescription="No locations exist for this item's warehouse."
        columns={[
          { key: 'code', label: 'Location', render: (row) => locationLabel(row, row.id) },
          { key: 'type', label: 'Type', render: (row) => asText(row.type) || '-' },
          { key: 'status', label: 'Status', render: (row) => (
            <WmsStatusChip status={row.isActive === false ? 'inactive' : 'active'} size="sm" />
          ) },
        ]}
      />
    );
  };

  return (
    <WmsSurface as="aside" variant="panel" padding="md" className={s.drillPanel}>
      <div className={s.drillHeader}>
        <div>
          <h2>{item.productLabel}</h2>
          <p>{[item.productSku, item.variantLabel, item.warehouseLabel].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className={s.iconButton} onClick={onClose} aria-label="Close item drill">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={s.drillTabs} role="tablist" aria-label="Item drill tabs">
        {drillTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${s.drillTab} ${tab.key === selectedTab ? s.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={s.drillContent}>
        {renderContent()}
      </div>
      {item.productId ? (
        <button type="button" className={s.secondaryAction} onClick={() => navigate(`/main/products/${item.productId}`)}>
          Open product
        </button>
      ) : null}
    </WmsSurface>
  );
}

export default function WmsInventoryShellPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const [drillTab, setDrillTab] = useState('movements');

  const activeTab = getInventoryWorkspaceTab(searchParams.get('tab'));
  const activeReport = getInventoryReportTab(searchParams.get('report'));
  const search = searchParams.get('search') || '';
  const warehouseId = searchParams.get('warehouseId') || '';
  const locale = i18n.language || 'en';

  const warehousesQuery = useListWarehousesQuery({ limit: 200, sort: 'code', dir: 'ASC' });
  const warehouses = useMemo(() => rowsFromListResponse(warehousesQuery.data), [warehousesQuery.data]);
  const queryBase = useMemo(() => ({
    page: 1,
    limit: 100,
    warehouseId: warehouseId || undefined,
  }), [warehouseId]);
  const locationsWarehouseId = activeTab === 'locations'
    ? warehouseId
    : selectedItem?.warehouseId || '';
  const locationModeQuery = useListLocationsQuery({
    page: 1,
    limit: 200,
    sort: 'code',
    dir: 'ASC',
    warehouseId: warehouseId || undefined,
  });

  const balancesQuery = useGetStockBalancesQuery({
    warehouseId: warehouseId || undefined,
    search: search || undefined,
    onlyPositive: false,
  }, { skip: activeTab !== 'balances' });
  const movesQuery = useListStockMovesQuery({
    ...queryBase,
    sort: 'createdAt',
    dir: 'DESC',
  }, { skip: activeTab !== 'moves' });
  const reservationsQuery = useListReservationsQuery({
    ...queryBase,
    sort: 'createdAt',
    dir: 'DESC',
  }, { skip: activeTab !== 'reservations' });
  const lotsQuery = useListLotsQuery({
    page: 1,
    limit: 100,
    search: search || undefined,
    productId: undefined,
  }, { skip: activeTab !== 'lots' });
  const serialsQuery = useListSerialsQuery({
    page: 1,
    limit: 100,
    search: search || undefined,
    productId: undefined,
  }, { skip: activeTab !== 'serials' });
  const locationsQuery = useListLocationsQuery({
    page: 1,
    limit: 200,
    sort: 'code',
    dir: 'ASC',
    warehouseId: locationsWarehouseId || undefined,
  }, { skip: activeTab !== 'locations' && !selectedItem });

  const scopedQuery = useMemo(() => (
    selectedItem ? buildScopedInventoryQuery(selectedItem, { sort: 'createdAt', dir: 'DESC' }) : { page: 1, limit: 100 }
  ), [selectedItem]);
  const drillMovesQuery = useListStockMovesQuery(scopedQuery, { skip: !selectedItem });
  const drillReservationsQuery = useListReservationsQuery(scopedQuery, { skip: !selectedItem });
  const drillLotsQuery = useListLotsQuery(scopedQuery, { skip: !selectedItem });
  const drillSerialsQuery = useListSerialsQuery(scopedQuery, { skip: !selectedItem });

  const balances = useMemo(() => (
    filterInventoryRows(rowsFromListResponse(balancesQuery.data).map(normalizeBalanceRow), search, [
      'productLabel',
      'productSku',
      'variantLabel',
      'warehouseLabel',
    ])
  ), [balancesQuery.data, search]);
  const moves = useMemo(() => filterInventoryRows(rowsFromListResponse(movesQuery.data), search, [
    'type',
    'productId',
    'productName',
    'productSku',
    'refType',
    'refId',
  ]), [movesQuery.data, search]);
  const reservations = useMemo(() => filterInventoryRows(rowsFromListResponse(reservationsQuery.data), search, [
    'status',
    'productId',
    'orderId',
    'warehouseId',
  ]), [reservationsQuery.data, search]);
  const lots = useMemo(() => filterInventoryRows(rowsFromListResponse(lotsQuery.data), search, [
    'lotNumber',
    'productId',
  ]), [lotsQuery.data, search]);
  const serials = useMemo(() => filterInventoryRows(rowsFromListResponse(serialsQuery.data), search, [
    'serialNumber',
    'productId',
  ]), [serialsQuery.data, search]);
  const locations = useMemo(() => filterInventoryRows(rowsFromListResponse(locationsQuery.data), search, [
    'code',
    'type',
    'warehouseId',
  ]), [locationsQuery.data, search]);
  const locationMode = useMemo(() => getWmsLocationMode({
    locations: rowsFromListResponse(locationModeQuery.data),
    warehouseId,
  }), [locationModeQuery.data, warehouseId]);
  const advancedLocations = isAdvancedLocationMode(locationMode);
  const visibleInventoryTabs = useMemo(() => (
    advancedLocations
      ? WMS_INVENTORY_TABS
      : WMS_INVENTORY_TABS.filter((tab) => tab.key !== 'locations')
  ), [advancedLocations]);

  const retryActive = useCallback(() => {
    if (activeTab === 'balances') balancesQuery.refetch();
    if (activeTab === 'moves') movesQuery.refetch();
    if (activeTab === 'reservations') reservationsQuery.refetch();
    if (activeTab === 'lots') lotsQuery.refetch();
    if (activeTab === 'serials') serialsQuery.refetch();
    if (activeTab === 'locations') locationsQuery.refetch();
  }, [activeTab, balancesQuery, locationsQuery, lotsQuery, movesQuery, reservationsQuery, serialsQuery]);

  const activeQuery = {
    balances: balancesQuery,
    moves: movesQuery,
    reservations: reservationsQuery,
    lots: lotsQuery,
    serials: serialsQuery,
    locations: locationsQuery,
  }[activeTab];
  const loading = activeQuery?.isFetching && !activeQuery?.data;
  const error = activeQuery?.error;

  const renderActiveTab = () => {
    if (activeTab === 'reports') {
      return <InventoryReportsWorkspace activeReport={activeReport} />;
    }

    if (loading) return <WmsLoadingState title="Loading inventory" rows={7} />;
    if (error) {
      return (
        <WmsErrorState
          title="Failed to load inventory"
          description={getErrorText(error)}
          onRetry={retryActive}
        />
      );
    }

    if (activeTab === 'balances') {
      return (
        <DataTable
          rows={balances}
          rowKey={(row, index) => `${row.warehouseId || 'warehouse'}:${row.productId || 'product'}:${row.variantId || 'variant'}:${index}`}
          onRowClick={(row) => {
            setSelectedItem(row);
            setDrillTab('movements');
          }}
          emptyTitle="No balances found"
          emptyDescription="Adjust warehouse or search filters."
          columns={[
            { key: 'product', label: 'Product', render: (row) => (
              <div className={s.primaryCell}>
                <strong>{row.productLabel}</strong>
                <span>{row.productSku || row.productId || '-'}</span>
              </div>
            ) },
            { key: 'variant', label: 'Variant', render: (row) => row.variantLabel },
            { key: 'onHand', label: 'On Hand', numeric: true, render: (row) => formatQty(row.onHand, locale) },
            { key: 'reserved', label: 'Reserved', numeric: true, render: (row) => formatQty(row.reserved, locale) },
            { key: 'available', label: 'Available', numeric: true, render: (row) => formatQty(row.available, locale) },
            { key: 'status', label: 'Stock', render: (row) => <WmsStatusChip status={getStockLevelStatus(row)} size="sm" /> },
          ]}
        />
      );
    }

    if (activeTab === 'moves') {
      const columns = [
        { key: 'date', label: 'Date', render: (row) => formatDate(row.createdAt, locale) },
        { key: 'type', label: 'Type', render: (row) => <WmsStatusChip status={row.type} size="sm" /> },
        { key: 'product', label: 'Product', render: (row) => (
          <InlineLinkButton onClick={row.productId ? () => navigate(`/main/products/${row.productId}`) : null}>
            {productLabel(row)}
          </InlineLinkButton>
        ) },
        ...(advancedLocations ? [
          { key: 'from', label: 'From', render: (row) => locationLabel(row.fromLocation, row.fromLocationId) },
          { key: 'to', label: 'To', render: (row) => locationLabel(row.toLocation, row.toLocationId) },
        ] : []),
        { key: 'qty', label: 'Qty', numeric: true, render: (row) => formatQty(row.qty, locale) },
        { key: 'source', label: 'Document', render: (row) => {
          const route = stockMoveSourceRoute(row);
          return route ? <Link to={route} className={s.textLink}>{stockMoveSourceLabel(row)}</Link> : stockMoveSourceLabel(row);
        } },
      ];
      return (
        <DataTable
          rows={moves}
          rowKey={(row, index) => row.id || `move-${index}`}
          emptyTitle="No stock moves found"
          emptyDescription="Adjust warehouse or search filters."
          columns={columns}
        />
      );
    }

    if (activeTab === 'reservations') {
      return (
        <DataTable
          rows={reservations}
          rowKey={(row, index) => row.id || `reservation-${index}`}
          emptyTitle="No reservations found"
          emptyDescription="No reservations match the current filters."
          columns={[
            { key: 'status', label: 'Status', render: (row) => <WmsStatusChip status={row.status} size="sm" /> },
            { key: 'product', label: 'Product', render: (row) => productLabel(row) },
            { key: 'variant', label: 'Variant', render: (row) => variantLabel(row) },
            { key: 'qty', label: 'Qty', numeric: true, render: (row) => formatQty(row.qty, locale) },
            { key: 'order', label: 'Source order', render: (row) => asText(row.orderId) || '-' },
          ]}
        />
      );
    }

    if (activeTab === 'lots') {
      return (
        <DataTable
          rows={lots}
          rowKey={(row, index) => row.id || `lot-${index}`}
          emptyTitle="No lots found"
          emptyDescription="No lots match the current filters."
          columns={[
            { key: 'lot', label: 'Lot', render: (row) => asText(row.lotNumber) || '-' },
            { key: 'product', label: 'Product', render: (row) => productLabel(row) },
            { key: 'mfg', label: 'Manufactured', render: (row) => formatDate(row.mfgDate, locale) },
            { key: 'exp', label: 'Expiry', render: (row) => formatDate(row.expDate, locale) },
          ]}
        />
      );
    }

    if (activeTab === 'serials') {
      return (
        <DataTable
          rows={serials}
          rowKey={(row, index) => row.id || `serial-${index}`}
          emptyTitle="No serials found"
          emptyDescription="No serial numbers match the current filters."
          columns={[
            { key: 'serial', label: 'Serial', render: (row) => asText(row.serialNumber) || '-' },
            { key: 'product', label: 'Product', render: (row) => productLabel(row) },
            { key: 'created', label: 'Created', render: (row) => formatDate(row.createdAt, locale) },
          ]}
        />
      );
    }

    if (activeTab === 'locations' && !advancedLocations) {
      return (
        <WmsEmptyState
          title="Location management is disabled"
          description="This warehouse uses warehouse-level stock, so location stock tables are hidden."
        />
      );
    }

    if (!hasLocations(locations)) {
      return (
        <WmsEmptyState
          title="No locations stock"
          description="No locations exist for the selected warehouse. Warehouse-level stock is still supported."
        />
      );
    }

    return (
      <DataTable
        rows={locations}
        rowKey={(row, index) => row.id || `location-${index}`}
        emptyTitle="No locations stock"
        emptyDescription="No locations match the current filters."
        columns={[
          { key: 'warehouse', label: 'Warehouse', render: (row) => getWarehouseLabel(row.warehouse || { id: row.warehouseId }) },
          { key: 'code', label: 'Location', render: (row) => locationLabel(row, row.id) },
          { key: 'type', label: 'Type', render: (row) => asText(row.type) || '-' },
          { key: 'status', label: 'Status', render: (row) => (
            <WmsStatusChip status={row.isActive === false ? 'inactive' : 'active'} size="sm" />
          ) },
        ]}
      />
    );
  };

  return (
    <div className={s.workspace}>
      <header className={s.topbar}>
        <div>
          <h1>Inventory</h1>
          <p>Balances, movements, reservations, lots, serials, locations and reports.</p>
        </div>
        <div className={s.modePill} title={getWmsLocationModeDescription(locationMode)}>
          {getWmsLocationModeLabel(locationMode)}
        </div>
      </header>

      <InventoryToolbar
        warehouses={warehouses}
        warehouseId={warehouseId}
        search={search}
        searchParams={searchParams}
        navigate={navigate}
      />

      <nav className={s.tabs} aria-label="Inventory tabs">
        {visibleInventoryTabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            className={`${s.tab} ${tab.key === activeTab ? s.active : ''}`}
            onClick={() => setSelectedItem(null)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className={`${s.content} ${selectedItem ? s.withDrill : ''}`}>
        <WmsSurface as="main" variant="panel" padding="none" className={s.mainPanel}>
          {renderActiveTab()}
        </WmsSurface>
        <DrillPanel
          item={selectedItem}
          activeTab={drillTab}
          setActiveTab={setDrillTab}
          onClose={() => setSelectedItem(null)}
          locale={locale}
          navigate={navigate}
          queries={{
            movements: drillMovesQuery,
            reservations: drillReservationsQuery,
            lots: drillLotsQuery,
            serials: drillSerialsQuery,
            locations: locationsQuery,
          }}
          locationMode={locationMode}
        />
      </div>
    </div>
  );
}
