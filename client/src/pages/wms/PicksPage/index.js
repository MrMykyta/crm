import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Filter,
  PackageCheck,
  ScanLine,
  Search,
  UserCheck,
  Waves,
  X,
} from 'lucide-react';

import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  WmsEmptyState,
  WmsErrorState,
  WmsLoadingState,
  WmsStatusChip,
  WmsSurface,
} from '../../../components/wms/ui';
import { SearchField, SelectField, TextField } from '../../../components/ui/fields';
import s from './PicksPage.module.css';
import {
  useListLocationsQuery,
  useListPickTasksQuery,
  useListPickWavesQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import {
  getWmsLocationMode,
  getWmsLocationModeDescription,
  getWmsLocationModeLabel,
  isAdvancedLocationMode,
} from '../locationsMode';

const TABS = [
  { key: 'waves', labelKey: 'wms.picks.tabs.waves', fallbackLabel: 'Waves', icon: Waves },
  { key: 'tasks', labelKey: 'wms.picks.tabs.tasks', fallbackLabel: 'Tasks', icon: ClipboardList },
  { key: 'my', labelKey: 'wms.picks.tabs.my', fallbackLabel: 'My Tasks', icon: UserCheck },
];

const WAVE_STATUS_OPTIONS = ['', 'planned', 'picking', 'completed', 'cancelled'];
const TASK_STATUS_OPTIONS = ['', 'new', 'done', 'cancelled'];

function normalizeWaveQuery(query = {}) {
  const normalized = {
    page: 1,
    limit: 50,
    sort: 'createdAt',
    dir: 'DESC',
  };
  if (query.status) normalized.status = query.status;
  if (query.warehouseId) normalized.warehouseId = query.warehouseId;
  return normalized;
}

function normalizeTaskQuery(query = {}) {
  const normalized = {
    page: 1,
    limit: 50,
    sort: 'createdAt',
    dir: 'DESC',
  };
  if (query.status) normalized.status = query.status;
  return normalized;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asDash(value) {
  return asText(value) || '—';
}

function formatDateTime(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function getWarehouseLabel(row = {}) {
  return [asText(row.code), asText(row.name)].filter(Boolean).join(' — ') || asText(row.id);
}

function getWaveLabel(row = {}, t = (_key, fallback) => fallback) {
  return asText(row.waveNumber)
    || asText(row.number)
    || asText(row.code)
    || (row.id ? t('wms.picks.fallbacks.waveWithId', 'Wave {{id}}', { id: String(row.id).slice(0, 8) }) : t('wms.picks.fallbacks.wave', 'Wave'));
}

function getTaskLabel(row = {}, t = (_key, fallback) => fallback) {
  return asText(row.taskNumber)
    || asText(row.number)
    || asText(row.code)
    || (row.id ? t('wms.picks.fallbacks.taskWithId', 'Task {{id}}', { id: String(row.id).slice(0, 8) }) : t('wms.picks.fallbacks.task', 'Task'));
}

function getSourceDocument(row = {}) {
  return asText(row.reference)
    || asText(row.orderReference)
    || asText(row.documentNumber)
    || asText(row.shipmentNumber)
    || asText(row.orderId)
    || asText(row.shipmentId)
    || asText(row.pickToLocationId)
    || '—';
}

function getAssignee(row = {}) {
  return asText(row.assignedUserName)
    || asText(row.assignedUser)
    || asText(row.assigneeName)
    || asText(row.assignee)
    || asText(row.assignedUserId)
    || asText(row.userId)
    || '—';
}

function getTasksCount(row = {}, fallbackTasks = []) {
  const direct = row.tasksCount ?? row.taskCount ?? row.totalTasks ?? row.linesCount;
  if (Number.isFinite(Number(direct))) return Number(direct);
  if (Array.isArray(row.tasks)) return row.tasks.length;
  if (Array.isArray(row.items)) return row.items.length;
  if (row.id) return fallbackTasks.filter((task) => asText(task.waveId) === asText(row.id)).length;
  return 0;
}

function getProductCount(row = {}) {
  const direct = row.productCount ?? row.productsCount ?? row.linesCount ?? row.itemsCount;
  if (Number.isFinite(Number(direct))) return Number(direct);
  if (Array.isArray(row.items)) return row.items.length;
  if (Array.isArray(row.products)) return row.products.length;
  return 0;
}

function getProgress(row = {}, relatedTasks = []) {
  const total = getTasksCount(row, relatedTasks) || getProductCount(row);
  const done = Number(row.doneTasks ?? row.completedTasks ?? row.doneCount ?? row.completedCount ?? 0)
    || relatedTasks.filter((task) => asText(task.status).toLowerCase() === 'done').length;
  if (!total) return { done: 0, total: 0, percent: 0 };
  return {
    done,
    total,
    percent: Math.max(0, Math.min(100, Math.round((done / total) * 100))),
  };
}

function includesQuery(row = {}, query = '') {
  const needle = asText(query).toLowerCase();
  if (!needle) return true;
  return [
    row.id,
    row.waveId,
    row.status,
    row.reference,
    row.orderReference,
    row.documentNumber,
    row.shipmentNumber,
    row.orderId,
    row.shipmentId,
    row.assignedUser,
    row.assignedUserName,
    row.assigneeName,
  ].some((value) => asText(value).toLowerCase().includes(needle));
}

function getErrorMessage(error, t = (_key, fallback) => fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || t('wms.picks.errors.requestFailed', 'Request failed');
}

function DetailPanel({ selected, tasks, locale, onClose, t }) {
  if (!selected) {
    return (
      <WmsSurface as="aside" variant="panel" padding="md" className={s.detailPanel}>
        <WmsEmptyState
          title={t('wms.picks.detail.emptyTitle', 'Select a wave or task')}
          description={t('wms.picks.detail.emptyDescription', 'Open a row to inspect source document, progress, products, and status.')}
          compact
        />
      </WmsSurface>
    );
  }

  const row = selected.row || {};
  const isWave = selected.type === 'wave';
  const relatedTasks = isWave ? tasks.filter((task) => asText(task.waveId) === asText(row.id)) : [];
  const progress = getProgress(row, relatedTasks);
  const products = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.products)
      ? row.products
      : [];

  return (
    <WmsSurface as="aside" variant="panel" padding="md" className={s.detailPanel}>
      <div className={s.detailTop}>
        <div>
          <span className={s.eyebrow}>{isWave ? t('wms.picks.detail.waveDetail', 'Wave detail') : t('wms.picks.detail.taskDetail', 'Task detail')}</span>
          <h2>{isWave ? getWaveLabel(row, t) : getTaskLabel(row, t)}</h2>
        </div>
        <button type="button" className={s.iconButton} onClick={onClose} aria-label={t('wms.picks.detail.close', 'Close detail panel')}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={s.detailGrid}>
        <span>{t('wms.picks.detail.sourceDocument', 'Source document')}</span>
        <strong>{getSourceDocument(row)}</strong>
        <span>{t('wms.picks.detail.status', 'Status')}</span>
        <strong><WmsStatusChip status={row.status || 'draft'} size="sm" /></strong>
        <span>{t('wms.picks.detail.assignee', 'Assignee')}</span>
        <strong>{getAssignee(row)}</strong>
        <span>{t('wms.picks.detail.created', 'Created')}</span>
        <strong>{formatDateTime(row.createdAt, locale)}</strong>
      </div>

      <div className={s.progressBlock}>
        <div className={s.progressHeader}>
          <span>{t('wms.picks.detail.progress', 'Progress')}</span>
          <strong>{progress.total ? `${progress.done}/${progress.total}` : '—'}</strong>
        </div>
        <span className={s.progressTrack}>
          <span style={{ width: `${progress.percent}%` }} />
        </span>
      </div>

      <div className={s.detailSection}>
        <span className={s.eyebrow}>{t('wms.picks.detail.products', 'Products')}</span>
        {products.length ? (
          <div className={s.productList}>
            {products.slice(0, 8).map((item, index) => (
              <div key={item.id || `${getTaskLabel(row, t)}-${index}`} className={s.productItem}>
                <strong>{asDash(item.productName || item.name || item.sku || item.productId)}</strong>
                <span>{asDash(item.qty || item.quantity || item.qtyToPick || item.qtyPicked)}</span>
              </div>
            ))}
          </div>
        ) : (
          <WmsEmptyState
            title={t('wms.picks.detail.noProductsTitle', 'No product details')}
            description={t('wms.picks.detail.noProductsDescription', 'Current pick API does not expose product rows for this item.')}
            compact
          />
        )}
      </div>
    </WmsSurface>
  );
}

function ScanMode({ open, current, recentScans, scanQuery, onScanQueryChange, onScan, onClose, locationMode, t }) {
  if (!open) return null;
  const label = current?.type === 'task'
    ? getTaskLabel(current.row, t)
    : current?.type === 'wave'
      ? getWaveLabel(current.row, t)
      : t('wms.picks.scan.pickingQueue', 'Picking queue');
  const progress = current?.row ? getProgress(current.row) : { done: 0, total: 0, percent: 0 };
  const advancedLocations = isAdvancedLocationMode(locationMode);

  return (
    <div className={s.scanMode} data-testid="wms-picking-scan-mode">
      <WmsSurface as="section" variant="panel" padding="md" className={s.scanModePanel}>
        <div className={s.scanTop}>
          <div>
            <span className={s.eyebrow}>{t('wms.picks.scan.title', 'Scan mode')}</span>
            <h2>{label}</h2>
            <p>
              {advancedLocations
                ? t('wms.picks.scan.advancedDescription', 'Scanner-ready picking surface with location context. Execution remains read-only until backend task support is available.')
                : t('wms.picks.scan.simpleDescription', 'Scanner-ready picking surface for warehouse-level stock. Execution remains read-only until backend task support is available.')}
            </p>
          </div>
          <button type="button" className={s.iconButton} onClick={onClose} aria-label={t('wms.picks.scan.close', 'Close scan mode')}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={s.scanStatus}>
          <WmsStatusChip status="active" size="md">{t('wms.picks.scan.ready', 'Ready')}</WmsStatusChip>
          <span>{t('wms.picks.scan.progress', 'Progress')} {progress.total ? `${progress.done}/${progress.total}` : t('wms.picks.scan.notAvailable', 'not available')}</span>
        </div>

        <label className={s.largeScanField}>
          <span>{t('wms.picks.scan.largeInput', 'Large scan input')}</span>
          <TextField
            value={scanQuery}
            onValueChange={onScanQueryChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onScan();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={advancedLocations ? t('wms.picks.scan.advancedPlaceholder', 'Scan location / product / task code') : t('wms.picks.scan.simplePlaceholder', 'Scan product / task code')}
            autoFocus
          />
        </label>

        <div className={s.scanGrid}>
          <WmsSurface variant="soft" padding="sm" className={s.scanCard}>
            <span className={s.eyebrow}>{t('wms.picks.scan.currentTask', 'Current task')}</span>
            <strong>{label}</strong>
            <span>{current?.row ? getSourceDocument(current.row) : t('wms.picks.scan.selectScope', 'Select a wave or task to scope scanning.')}</span>
          </WmsSurface>
          <WmsSurface variant="soft" padding="sm" className={s.scanCard}>
            <span className={s.eyebrow}>{t('wms.picks.scan.recentScans', 'Recent scans')}</span>
            {recentScans.length ? (
              <div className={s.recentList}>
                {recentScans.map((entry) => (
                  <div key={entry.id} className={s.recentItem}>
                    <ScanLine size={14} aria-hidden="true" />
                    <span>{entry.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className={s.muted}>{t('wms.picks.scan.noScansYet', 'No scans yet')}</span>
            )}
          </WmsSurface>
        </div>
      </WmsSurface>
    </div>
  );
}

export default function PicksPage() {
  const { t, i18n } = useTranslation();
  const { hasAny, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canViewPicks = hasAny(['wms:read', 'wms:picking:manage']);

  const [activeTab, setActiveTab] = useState('waves');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [scanModeOpen, setScanModeOpen] = useState(false);
  const [scanQuery, setScanQuery] = useState('');
  const [recentScans, setRecentScans] = useState([]);

  const { data: warehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'name', dir: 'ASC' },
    { skip: !canViewPicks }
  );
  const { data: locationsData } = useListLocationsQuery(
    { limit: 200, sort: 'code', dir: 'ASC', warehouseId: warehouseId || undefined },
    { skip: !canViewPicks }
  );

  const waveQuery = useMemo(() => normalizeWaveQuery({ warehouseId, status }), [status, warehouseId]);
  const taskQuery = useMemo(() => normalizeTaskQuery({ status }), [status]);

  const {
    data: wavesData,
    isFetching: wavesFetching,
    error: wavesError,
    refetch: refetchWaves,
  } = useListPickWavesQuery(waveQuery, {
    skip: !canViewPicks,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: tasksData,
    isFetching: tasksFetching,
    error: tasksError,
    refetch: refetchTasks,
  } = useListPickTasksQuery(taskQuery, {
    skip: !canViewPicks,
    refetchOnMountOrArgChange: true,
  });

  const warehouses = useMemo(() => (
    Array.isArray(warehousesData?.items) ? warehousesData.items : []
  ), [warehousesData?.items]);
  const locationMode = useMemo(() => getWmsLocationMode({
    locations: Array.isArray(locationsData?.items) ? locationsData.items : [],
    warehouseId,
  }), [locationsData?.items, warehouseId]);

  const waves = useMemo(() => (
    Array.isArray(wavesData?.items) ? wavesData.items : []
  ), [wavesData?.items]);

  const tasks = useMemo(() => (
    Array.isArray(tasksData?.items) ? tasksData.items : []
  ), [tasksData?.items]);

  const waveById = useMemo(() => {
    const map = {};
    waves.forEach((wave) => {
      if (wave?.id) map[wave.id] = wave;
    });
    return map;
  }, [waves]);

  const visibleWaves = useMemo(() => (
    waves.filter((row) => includesQuery(row, search))
  ), [search, waves]);

  const visibleTasks = useMemo(() => (
    tasks.filter((row) => {
      if (!includesQuery(row, search)) return false;
      if (!warehouseId) return true;
      const wave = waveById[row.waveId];
      return asText(row.warehouseId) === asText(warehouseId)
        || asText(wave?.warehouseId) === asText(warehouseId);
    })
  ), [search, tasks, warehouseId, waveById]);

  const activeRows = activeTab === 'waves' ? visibleWaves : activeTab === 'tasks' ? visibleTasks : [];
  const isCurrentLoading = activeTab === 'waves' ? wavesFetching : activeTab === 'tasks' ? tasksFetching : false;
  const currentError = activeTab === 'waves' ? wavesError : activeTab === 'tasks' ? tasksError : null;
  const statusOptions = activeTab === 'waves' ? WAVE_STATUS_OPTIONS : TASK_STATUS_OPTIONS;

  const onRetry = activeTab === 'waves' ? refetchWaves : refetchTasks;

  const onScan = () => {
    const value = asText(scanQuery);
    if (!value) return;
    setRecentScans((prev) => [
      { id: `${Date.now()}-${value}`, value },
      ...prev,
    ].slice(0, 6));
    setScanQuery('');
  };

  if (isLoading && !hasResolvedPermissions) {
    return (
      <div className={s.workspace}>
        <WmsLoadingState title={t('wms.picks.loading', 'Loading picking workspace')} rows={5} />
      </div>
    );
  }

  if (!canViewPicks) {
    return (
      <div className={s.workspace}>
        <WmsSurface variant="panel" padding="md">
          <WmsEmptyState
            title={t('common.noPermission', 'No permission')}
            description={t('wms.picks.noReadPermission', 'You do not have permission to view pick tasks and waves.')}
          />
        </WmsSurface>
      </div>
    );
  }

  return (
    <div className={s.workspace} data-testid="wms-picking-workspace">
      <div className={s.topbar}>
        <div>
          <span className={s.eyebrow}>WMS</span>
          <h1>{t('wms.picks.title', 'Picking')}</h1>
          <p>{t('wms.picks.subtitle', 'Warehouse execution workspace for waves, tasks, and scanner-first picking.')}</p>
        </div>
        <div className={s.topbarActions}>
          <span className={s.modePill} title={getWmsLocationModeDescription(locationMode)}>
            {getWmsLocationModeLabel(locationMode)}
          </span>
          <button type="button" className={s.primaryButton} onClick={() => setScanModeOpen(true)}>
            <ScanLine size={16} aria-hidden="true" />
            {t('wms.picks.scanModeButton', 'Scan Mode')}
          </button>
        </div>
      </div>

      <WmsSurface as="section" variant="soft" padding="sm" className={s.controls} aria-label={t('wms.picks.controlsLabel', 'Picking controls')}>
        <label className={s.controlBox}>
          <span>{t('wms.picks.filters.warehouse', 'Warehouse')}</span>
          <SelectField
            value={warehouseId}
            onValueChange={setWarehouseId}
            options={[
              { value: '', label: t('common.all', 'All') },
              ...warehouses.map((row) => ({
                value: row.id,
                label: getWarehouseLabel(row),
              })),
            ]}
          />
        </label>
        <label className={s.searchBox}>
          <Search size={15} aria-hidden="true" />
          <SearchField
            value={search}
            onValueChange={setSearch}
            placeholder={t('wms.picks.filters.searchPlaceholder', 'Search wave, task, document, assignee')}
          />
        </label>
        <label className={s.controlBox}>
          <Filter size={15} aria-hidden="true" />
          <span>{t('wms.picks.filters.status', 'Status')}</span>
          <SelectField
            value={status}
            onValueChange={setStatus}
            options={statusOptions.map((value) => ({
              value,
              label: value ? t(`statuses.${value}`, value) : t('common.all', 'All'),
            }))}
          />
        </label>
      </WmsSurface>

      <div className={s.tabs} role="tablist" aria-label={t('wms.picks.viewsLabel', 'Picking views')}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={`${s.tab} ${activeTab === tab.key ? s.activeTab : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                setStatus('');
              }}
            >
              <Icon size={15} aria-hidden="true" />
              {t(tab.labelKey, tab.fallbackLabel)}
            </button>
          );
        })}
      </div>

      <div className={`${s.content} ${s.withDetail}`}>
        <WmsSurface as="main" variant="panel" padding="none" className={s.mainPanel}>
          {currentError ? (
            <WmsErrorState
              title={t('wms.picks.errors.loadFailed', 'Failed to load picking data')}
              description={getErrorMessage(currentError, t)}
              onRetry={onRetry}
            />
          ) : isCurrentLoading ? (
            <WmsLoadingState title={t('wms.picks.loading', 'Loading picking workspace')} rows={7} />
          ) : activeTab === 'my' ? (
            <WmsEmptyState
              title={t('wms.picks.myUnavailable.title', 'My Tasks are not available yet')}
              description={t('wms.picks.myUnavailable.description', 'Current pick APIs do not expose assigned-user filtering. Use Tasks and status filters for now.')}
              icon={UserCheck}
            />
          ) : activeRows.length ? (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  {activeTab === 'waves' ? (
                    <tr>
                      <th>{t('wms.picks.table.wave', 'Wave')}</th>
                      <th>{t('wms.picks.table.tasks', 'Tasks')}</th>
                      <th>{t('wms.picks.table.status', 'Status')}</th>
                      <th>{t('wms.picks.table.created', 'Created')}</th>
                      <th>{t('wms.picks.table.document', 'Document')}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>{t('wms.picks.table.document', 'Document')}</th>
                      <th>{t('wms.picks.table.products', 'Products')}</th>
                      <th>{t('wms.picks.table.status', 'Status')}</th>
                      <th>{t('wms.picks.table.assignee', 'Assignee')}</th>
                      <th>{t('wms.picks.table.created', 'Created')}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeRows.map((row) => {
                    const isWave = activeTab === 'waves';
                    return (
                      <tr
                        key={row.id}
                        className={s.clickableRow}
                        onClick={() => setSelected({ type: isWave ? 'wave' : 'task', row })}
                      >
                        {isWave ? (
                          <>
                            <td>
                              <span className={s.primaryCell}>
                                <strong>{getWaveLabel(row, t)}</strong>
                                <span>{asDash(row.id)}</span>
                              </span>
                            </td>
                            <td className={s.numeric}>{getTasksCount(row, tasks)}</td>
                            <td><WmsStatusChip status={row.status || 'planned'} size="sm" /></td>
                            <td>{formatDateTime(row.createdAt, i18n.language)}</td>
                            <td>{getSourceDocument(row)}</td>
                          </>
                        ) : (
                          <>
                            <td>
                              <span className={s.primaryCell}>
                                <strong>{getSourceDocument(row)}</strong>
                                <span>{getTaskLabel(row, t)}</span>
                              </span>
                            </td>
                            <td className={s.numeric}>{getProductCount(row) || '—'}</td>
                            <td><WmsStatusChip status={row.status || 'new'} size="sm" /></td>
                            <td>{getAssignee(row)}</td>
                            <td>{formatDateTime(row.createdAt, i18n.language)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <WmsEmptyState
              title={activeTab === 'waves' ? t('wms.picks.empty.wavesTitle', 'No pick waves') : t('wms.picks.empty.tasksTitle', 'No pick tasks')}
              description={t('wms.picks.empty.description', 'No rows match the current warehouse, status, or search filters.')}
              icon={PackageCheck}
            />
          )}
        </WmsSurface>

        <DetailPanel
          selected={selected}
          tasks={tasks}
          locale={i18n.language}
          onClose={() => setSelected(null)}
          t={t}
        />
      </div>

      <ScanMode
        open={scanModeOpen}
        current={selected}
        recentScans={recentScans}
        scanQuery={scanQuery}
        onScanQueryChange={setScanQuery}
        onScan={onScan}
        onClose={() => setScanModeOpen(false)}
        locationMode={locationMode}
        t={t}
      />
    </div>
  );
}
