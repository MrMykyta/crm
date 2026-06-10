import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import s from './PicksPage.module.css';
import {
  useCompletePickTaskMutation,
  useListPickTasksQuery,
  useListPickWavesQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import {
  createWmsPickTasksColumns,
} from '../../../components/data/ListPage/columnSchemas/wmsPickTasksColumns';
import {
  createWmsPickWavesColumns,
} from '../../../components/data/ListPage/columnSchemas/wmsPickWavesColumns';

const WAVE_STATUS_OPTIONS = ['', 'planned', 'picking', 'completed', 'cancelled'];
const TASK_STATUS_OPTIONS = ['', 'new', 'done', 'cancelled'];

function normalizeQuery(query = {}) {
  const normalized = {
    page: Number(query.page) > 0 ? Number(query.page) : 1,
    limit: Number(query.limit) > 0 ? Number(query.limit) : 25,
    sort: query.sort || 'createdAt',
    dir: String(query.dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
  };
  if (query.status) normalized.status = query.status;
  if (query.warehouseId) normalized.warehouseId = query.warehouseId;
  return normalized;
}

function normalizeTaskQuery(query = {}) {
  const normalized = {
    page: Number(query.page) > 0 ? Number(query.page) : 1,
    limit: Number(query.limit) > 0 ? Number(query.limit) : 25,
    sort: query.sort || 'createdAt',
    dir: String(query.dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
  };
  if (query.status) normalized.status = query.status;
  return normalized;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export default function PicksPage() {
  const { t, i18n } = useTranslation();
  const { can, hasAny, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canManagePicking = can('wms:picking:manage');
  const canViewPicks = hasAny(['wms:read', 'wms:picking:manage']);

  const [wavesQuery, setWavesQuery] = useState(() => normalizeQuery({}));
  const [tasksQuery, setTasksQuery] = useState(() => normalizeTaskQuery({}));
  const [completingTaskId, setCompletingTaskId] = useState('');

  const wavesPrefs = useGridPrefs('wms.picks.waves');
  const tasksPrefs = useGridPrefs('wms.picks.tasks');

  const { data: warehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'name', dir: 'ASC' },
    { skip: !canViewPicks }
  );

  const { data: wavesData, isFetching: wavesFetching, error: wavesError, refetch: refetchWaves } = useListPickWavesQuery(
    canViewPicks ? wavesQuery : { limit: 1, page: 1 },
    {
      skip: !canViewPicks,
      refetchOnMountOrArgChange: true,
    }
  );
  const {
    data: tasksData,
    isFetching: tasksFetching,
    error: tasksError,
    refetch: refetchTasks,
  } = useListPickTasksQuery(
    canViewPicks ? tasksQuery : { limit: 1, page: 1 },
    {
      skip: !canViewPicks,
      refetchOnMountOrArgChange: true,
    }
  );

  const [completePickTask, { isLoading: isCompletingTask }] = useCompletePickTaskMutation();

  const warehouseOptions = useMemo(() => {
    const rows = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
    return [
      { value: '', label: t('common.all', 'All') },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row?.code), asText(row?.name)].filter(Boolean).join(' — ') || row.id,
      })),
    ];
  }, [t, warehousesData?.items]);

  const waveStatusOptions = useMemo(
    () => WAVE_STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.all', 'All'),
    })),
    [t]
  );

  const taskStatusOptions = useMemo(
    () => TASK_STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.all', 'All'),
    })),
    [t]
  );

  const adaptedWaves = useMemo(
    () => ({
      items: Array.isArray(wavesData?.items) ? wavesData.items : [],
      total: Number(wavesData?.meta?.count ?? (Array.isArray(wavesData?.items) ? wavesData.items.length : 0) ?? 0),
      page: Number(wavesData?.meta?.page ?? wavesQuery.page ?? 1),
      limit: Number(wavesData?.meta?.limit ?? wavesQuery.limit ?? 25),
    }),
    [wavesData, wavesQuery.limit, wavesQuery.page]
  );
  const adaptedTasks = useMemo(
    () => ({
      items: Array.isArray(tasksData?.items) ? tasksData.items : [],
      total: Number(tasksData?.meta?.count ?? (Array.isArray(tasksData?.items) ? tasksData.items.length : 0) ?? 0),
      page: Number(tasksData?.meta?.page ?? tasksQuery.page ?? 1),
      limit: Number(tasksData?.meta?.limit ?? tasksQuery.limit ?? 25),
    }),
    [tasksData, tasksQuery.limit, tasksQuery.page]
  );

  const waveLookup = useMemo(() => {
    const rows = Array.isArray(adaptedWaves.items) ? adaptedWaves.items : [];
    const map = {};
    rows.forEach((wave) => {
      map[wave?.id] = wave;
    });
    return map;
  }, [adaptedWaves.items]);

  const wavesColumns = useMemo(() => (
    createWmsPickWavesColumns({ t, locale: i18n.language })
  ), [t, i18n.language]);
  const tasksColumns = useMemo(() => (
    createWmsPickTasksColumns({ t, locale: i18n.language, waveById: waveLookup })
  ), [t, i18n.language, waveLookup]);

  const onCompleteTask = useCallback(async (row) => {
    if (!row?.id || isCompletingTask) return;
    try {
      setCompletingTaskId(row.id);
      await completePickTask(row.id).unwrap();
      await Promise.all([refetchWaves(), refetchTasks()]);
    } catch (error) {
      // API error is shown through ListPage error state after a refetch.
      // Keep local UI stable and let users retry.
      console.error('[PicksPage] Failed to complete task', error);
    } finally {
      setCompletingTaskId('');
    }
  }, [completePickTask, isCompletingTask, refetchTasks, refetchWaves]);

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.state}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canViewPicks) {
    return (
      <div className={s.noPermission}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.picks.noReadPermission', 'You do not have permission to view pick tasks and waves.')}</p>
      </div>
  );
  }

  return (
    <div className={s.page}>
      <section className={s.section}>
        <h1 className={s.sectionTitle}>{t('wms.picks.title', 'Picks')}</h1>
        <ListPage
          source="wmsPickWaves"
          title={t('wms.picks.wavesTitle', 'Pick waves')}
          columns={wavesColumns}
          defaultQuery={normalizeQuery({ sort: 'createdAt', dir: 'DESC', limit: 25 })}
          emptyStateText={t('wms.picks.empty', 'No pick waves found')}
          externalData={adaptedWaves.items}
          externalMeta={{ total: adaptedWaves.total, page: adaptedWaves.page, limit: adaptedWaves.limit }}
          externalLoading={wavesFetching}
          externalError={wavesError}
          onExternalRefetch={refetchWaves}
          query={wavesQuery}
          onQueryChange={setWavesQuery}
          columnWidths={wavesPrefs.colWidths}
          onColumnResize={wavesPrefs.onColumnResize}
          columnOrder={wavesPrefs.colOrder}
          onColumnOrderChange={wavesPrefs.onColumnOrderChange}
          columnVisibility={wavesPrefs.colVisibility}
          onColumnVisibilityChange={wavesPrefs.onColumnVisibilityChange}
          savedViews={wavesPrefs.savedViews}
          activeViewId={wavesPrefs.activeViewId}
          onSavedViewsChange={wavesPrefs.onSavedViewsChange}
          onActiveViewChange={wavesPrefs.onActiveViewChange}
          onResetColumns={wavesPrefs.resetGridPrefs}
          ToolbarComponent={(props) => (
            <FilterToolbar
              {...props}
              controls={[
                {
                  type: 'select',
                  key: 'status',
                  label: t('wms.picks.filters.status', 'Status'),
                  options: waveStatusOptions,
                },
                {
                  type: 'select',
                  key: 'warehouseId',
                  label: t('wms.picks.filters.warehouse', 'Warehouse'),
                  options: warehouseOptions,
                },
              ]}
            />
          )}
        />
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>{t('wms.pickTasks.title', 'Pick tasks')}</h2>
        <ListPage
          source="wmsPickTasks"
          title={t('wms.pickTasks.title', 'Pick tasks')}
          columns={tasksColumns}
          defaultQuery={normalizeTaskQuery({ sort: 'createdAt', dir: 'DESC', limit: 25 })}
          emptyStateText={t('wms.pickTasks.empty', 'No pick tasks found')}
          externalData={adaptedTasks.items}
          externalMeta={{ total: adaptedTasks.total, page: adaptedTasks.page, limit: adaptedTasks.limit }}
          externalLoading={tasksFetching}
          externalError={tasksError}
          onExternalRefetch={refetchTasks}
          query={tasksQuery}
          onQueryChange={setTasksQuery}
          columnWidths={tasksPrefs.colWidths}
          onColumnResize={tasksPrefs.onColumnResize}
          columnOrder={tasksPrefs.colOrder}
          onColumnOrderChange={tasksPrefs.onColumnOrderChange}
          columnVisibility={tasksPrefs.colVisibility}
          onColumnVisibilityChange={tasksPrefs.onColumnVisibilityChange}
          savedViews={tasksPrefs.savedViews}
          activeViewId={tasksPrefs.activeViewId}
          onSavedViewsChange={tasksPrefs.onSavedViewsChange}
          onActiveViewChange={tasksPrefs.onActiveViewChange}
          onResetColumns={tasksPrefs.resetGridPrefs}
          rowActions={canManagePicking ? (row) => (
            <div className={s.rowActions}>
              {row?.status !== 'done' ? (
                <button
                  type="button"
                  className={s.actionButton}
                  onClick={() => onCompleteTask(row)}
                  disabled={isCompletingTask && row?.id !== completingTaskId}
                >
                  {isCompletingTask && row?.id === completingTaskId
                    ? t('common.processing', 'Processing…')
                    : t('wms.picks.complete', 'Complete')}
                </button>
              ) : null}
            </div>
          ) : null}
          ToolbarComponent={(props) => (
            <FilterToolbar
              {...props}
              controls={[
                {
                  type: 'select',
                  key: 'status',
                  label: t('wms.pickTasks.filters.status', 'Status'),
                  options: taskStatusOptions,
                },
              ]}
            />
          )}
        />
      </section>

      <p className={s.note}>
        {t(
          'wms.picks.supportNote',
          'Filters for assigned user are not supported by the current pick APIs. You can filter by status; warehouse filter is available for pick waves.'
        )}
      </p>
    </div>
  );
}
