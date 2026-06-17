import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Package, Plus, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useGetStockBalancesQuery } from '../../../store/rtk/stockBalancesApi';
import {
  useListCycleCountsQuery,
  useListWarehouseDocumentsQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { WmsStatusChip } from '../ui';
import { buildWmsDashboardMetrics, hasWmsDashboardAlerts } from './wmsDashboardModel';
import s from './WmsDashboardSection.module.css';

const DOCUMENT_LIMIT = 200;

const CREATE_OPTIONS = [
  { type: 'PZ', label: 'PZ', description: 'Receipt', route: '/main/wms/receipts/new' },
  { type: 'WZ', label: 'WZ', description: 'Shipment', route: '/main/wms/shipments/new' },
  { type: 'MM', label: 'MM', description: 'Transfer', route: '/main/wms/transfers/new' },
  { type: 'RW', label: 'RW', description: 'Write-off', route: '/main/wms/adjustments/new?type=RW' },
  { type: 'PW', label: 'PW', description: 'Write-on', route: '/main/wms/adjustments/new?type=PW' },
  { type: 'CC', label: 'CC', description: 'Cycle count', route: '/main/wms/cycle-counts/new' },
];

const CARD_DEFS = [
  {
    key: 'pz',
    title: 'PZ',
    subtitle: 'Incoming',
    to: '/main/wms/documents?type=PZ',
    rows: [
      ['Drafts', 'drafts'],
      ['To receive', 'toReceive'],
      ['Late', 'late', 'warning'],
    ],
  },
  {
    key: 'wz',
    title: 'WZ',
    subtitle: 'Outgoing',
    to: '/main/wms/documents?type=WZ',
    rows: [
      ['Packing', 'packing'],
      ['To ship', 'toShip'],
      ['Blocked', 'blocked', 'danger'],
    ],
  },
  {
    key: 'mm',
    title: 'MM',
    subtitle: 'Transfers',
    to: '/main/wms/documents?type=MM',
    rows: [
      ['Draft', 'draft'],
      ['In progress', 'inProgress'],
    ],
  },
  {
    key: 'adjustments',
    title: 'RW/PW',
    subtitle: 'Adjustments',
    to: '/main/wms/documents?type=RW,PW',
    rows: [
      ['Draft', 'draft'],
      ['Posted today', 'postedToday'],
    ],
  },
  {
    key: 'cc',
    title: 'CC',
    subtitle: 'Counts',
    to: '/main/wms/cycle-counts',
    rows: [
      ['Open counts', 'open'],
      ['Variances', 'variances', 'warning'],
    ],
  },
];

function isBusy(...queries) {
  return queries.some((query) => query.isLoading || query.isFetching);
}

function rowsFromDocumentsResponse(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

function rowsFromListResponse(response) {
  return Array.isArray(response?.items) ? response.items : [];
}

function CountRow({ label, value, tone = 'neutral' }) {
  return (
    <div className={s.countRow}>
      <span>{label}</span>
      <WmsStatusChip tone={tone} marker={tone === 'neutral' ? 'solid' : undefined} size="sm">
        {Number(value || 0)}
      </WmsStatusChip>
    </div>
  );
}

function FlowCard({ card, metrics, onOpen }) {
  const data = metrics.documents?.[card.key] || {};
  return (
    <button type="button" className={s.flowCard} onClick={() => onOpen(card.to)}>
      <span className={s.cardHead}>
        <span>
          <strong>{card.title}</strong>
          <small>{card.subtitle}</small>
        </span>
        <span className={s.cardArrow}>›</span>
      </span>
      <span className={s.cardRows}>
        {card.rows.map(([label, key, tone]) => (
          <CountRow key={key} label={label} value={data[key]} tone={tone || 'neutral'} />
        ))}
      </span>
    </button>
  );
}

function NewDocumentMenu({ onCreate }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={s.newMenuWrap} ref={wrapRef}>
      <button
        type="button"
        className={s.newButton}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-expanded={open}
      >
        <Plus size={14} aria-hidden="true" />
        <span>New</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className={s.newMenu} role="menu">
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className={s.newMenuItem}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCreate(option.route);
              }}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AlertRow({ tone = 'warning', label, value, to, onOpen }) {
  if (!Number(value || 0)) return null;
  return (
    <button type="button" className={s.alertRow} onClick={() => onOpen(to)}>
      <WmsStatusChip tone={tone} marker={tone === 'danger' ? 'danger' : 'warning'} size="sm">
        {Number(value || 0)}
      </WmsStatusChip>
      <span>{label}</span>
    </button>
  );
}

export default function WmsDashboardSection() {
  const navigate = useNavigate();
  const documentsQuery = useListWarehouseDocumentsQuery({ page: 1, limit: DOCUMENT_LIMIT });
  const cycleCountsQuery = useListCycleCountsQuery({ page: 1, limit: DOCUMENT_LIMIT, sort: 'createdAt', dir: 'DESC' });
  const stockBalancesQuery = useGetStockBalancesQuery({});

  const metrics = useMemo(() => buildWmsDashboardMetrics({
    documents: rowsFromDocumentsResponse(documentsQuery.data),
    cycleCounts: rowsFromListResponse(cycleCountsQuery.data),
    stockBalances: rowsFromListResponse(stockBalancesQuery.data),
  }), [documentsQuery.data, cycleCountsQuery.data, stockBalancesQuery.data]);

  const openRoute = useCallback((route) => {
    if (!route) return;
    navigate(route);
  }, [navigate]);

  const loading = isBusy(documentsQuery, cycleCountsQuery, stockBalancesQuery);
  const hasError = documentsQuery.error || cycleCountsQuery.error || stockBalancesQuery.error;
  const alertsAvailable = hasWmsDashboardAlerts(metrics);

  return (
    <section className={s.section} aria-label="WMS">
      <header className={`${s.header} drag-handle`}>
        <div className={s.titleGroup}>
          <span className={s.iconWrap} aria-hidden="true"><Warehouse size={16} /></span>
          <div>
            <h2>WMS</h2>
            <p>Warehouse flows and inventory snapshot</p>
          </div>
        </div>
        <div
          className={s.actions}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <button type="button" className={s.openLink} onClick={() => openRoute('/main/wms/documents')}>
            Open documents
          </button>
          <NewDocumentMenu onCreate={openRoute} />
        </div>
      </header>

      {hasError ? (
        <div className={s.state} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>WMS dashboard data is partially unavailable.</span>
        </div>
      ) : null}

      {loading ? <div className={s.state}>Loading WMS snapshot...</div> : null}

      <div className={s.flowGrid}>
        {CARD_DEFS.map((card) => (
          <FlowCard key={card.key} card={card} metrics={metrics} onOpen={openRoute} />
        ))}
      </div>

      <button type="button" className={s.snapshot} onClick={() => openRoute('/main/wms/stock-balances')}>
        <span className={s.snapshotTitle}>
          <Package size={15} aria-hidden="true" />
          <strong>Inventory snapshot</strong>
        </span>
        <span className={s.snapshotStats}>
          <span><strong>{metrics.inventory.totalSkus}</strong> SKUs</span>
          <span><strong>{metrics.inventory.totalRows}</strong> rows</span>
          <span><strong>{metrics.inventory.lowStock}</strong> low</span>
          <span><strong>{metrics.inventory.negativeStock}</strong> negative</span>
        </span>
      </button>

      <div className={s.alerts}>
        <div className={s.alertsTitle}>WMS Alerts</div>
        {alertsAvailable ? (
          <div className={s.alertRows}>
            <AlertRow label="Low stock" value={metrics.alerts.lowStock} to="/main/wms/stock-balances" onOpen={openRoute} />
            <AlertRow label="Negative stock" value={metrics.alerts.negativeStock} tone="danger" to="/main/wms/stock-balances?onlyPositive=false" onOpen={openRoute} />
            <AlertRow label="Open counts" value={metrics.alerts.openCounts} to="/main/wms/cycle-counts" onOpen={openRoute} />
            <AlertRow label="Stuck drafts" value={metrics.alerts.stuckDrafts} to="/main/wms/documents?status=draft" onOpen={openRoute} />
          </div>
        ) : (
          <div className={s.noAlerts}>No WMS alerts from available data.</div>
        )}
      </div>
    </section>
  );
}
