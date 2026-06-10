import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../DataTable';
import DefaultToolbar from '../../filters/FilterToolbar';
import Modal from '../../Modal';
import s from './ListPage.module.css';
import ThemedSelect from '../../inputs/RadixSelect';
import ColumnViewEditor from './ColumnViewEditor';
import { DEFAULT_GRID_VIEW_ID } from '../../../hooks/useGridPrefs';

/* === Регистр RTK-источников === */
import { useListCounterpartiesQuery } from '../../../store/rtk/counterpartyApi';
import { useListTasksQuery } from '../../../store/rtk/tasksApi';
import { useListCompanyUsersQuery, useListInvitationsQuery } from '../../../store/rtk/companyUsersApi';
import { useGetDealsQuery } from '../../../store/rtk/dealsApi';
import { useGetNotesQuery } from '../../../store/rtk/notesApi';
import { useGetContactsQuery } from '../../../store/rtk/contactsApi';
import { useListProductsQuery } from '../../../store/rtk/productsApi';
import { useListDocumentsQuery } from '../../../store/rtk/documentsApi';
import { useListOrdersQuery } from '../../../store/rtk/ordersApi';
import { useListOffersQuery } from '../../../store/rtk/offersApi';
import { useListInvoicesQuery } from '../../../store/rtk/invoicesApi';
import { useGetStockBalancesQuery } from '../../../store/rtk/stockBalancesApi';
import {
  useListCycleCountsQuery,
  useListAdjustmentsQuery,
  useListLocationsQuery,
  useListReceiptsQuery,
  useListShipmentsQuery,
  useListStockMovesQuery,
  useListTransfersQuery,
  useListWarehousesQuery,
  useListReservationsQuery,
  useListLotsQuery,
  useListSerialsQuery,
  useListParcelsQuery,
} from '../../../store/rtk/wmsDocumentsApi';

const REGISTRY = {
  counterparties: {
    useQuery: useListCounterpartiesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      const total = Number(data?.total ?? items.length ?? 0);
      const page = Number(data?.page ?? 1);
      const limit = Number(data?.limit ?? 25);
      return { items, total, page, limit };
    },
  },
  tasks: {
    useQuery: useListTasksQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  deals: {
    useQuery: useGetDealsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  notes: {
    useQuery: useGetNotesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  contacts: {
    useQuery: useGetContactsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  products: {
    useQuery: useListProductsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  documents: {
    useQuery: useListDocumentsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  orders: {
    useQuery: useListOrdersQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  offers: {
    useQuery: useListOffersQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  invoices: {
    useQuery: useListInvoicesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  stockBalances: {
    useQuery: useGetStockBalancesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsReceipts: {
    useQuery: useListReceiptsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsTransfers: {
    useQuery: useListTransfersQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsShipments: {
    useQuery: useListShipmentsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsAdjustments: {
    useQuery: useListAdjustmentsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsCycleCounts: {
    useQuery: useListCycleCountsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsWarehouses: {
    useQuery: useListWarehousesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsLocations: {
    useQuery: useListLocationsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsStockMoves: {
    useQuery: useListStockMovesQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsReservations: {
    useQuery: useListReservationsQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsLots: {
    useQuery: useListLotsQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsSerials: {
    useQuery: useListSerialsQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  wmsParcels: {
    useQuery: useListParcelsQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  companyUsers: {
    useQuery: useListCompanyUsersQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  companyInvites: {
    useQuery: useListInvitationsQuery,
        // adapt: вспомогательная логика компонента.
adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
};

// getColumnLabel: возвращает вычисленное значение для UI.
function getColumnLabel(column) {
  const fallback = String(column?.key || '');
  const candidate = (
    (typeof column?.managerLabel === 'string' && column.managerLabel.trim())
    || (typeof column?.title === 'string' && column.title.trim())
    || fallback
  );

  const looksTechnical = (
    candidate === fallback
    || /^[a-z0-9_.-]+$/i.test(candidate)
    || candidate.includes('_')
    || candidate.includes('.')
    || /[a-z][A-Z]/.test(candidate)
  );

  if (!looksTechnical) return candidate;
  return humanizeColumnKey(candidate);
}

// getColumnGroup: возвращает вычисленное значение для UI.
function getColumnGroup(column) {
  if (column?.managerGroup) return String(column.managerGroup);
  if (column?.group) return String(column.group);
  return column?.defaultVisible === false ? 'additional' : 'main';
}

// humanizeColumnKey: вспомогательная логика компонента.
function humanizeColumnKey(key) {
  const value = String(key || '')
    .replace(/^customFields\./, '')
    .replace(/\./g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const words = value.split(' ').filter(Boolean).map((part) => {
    const token = String(part || '').toLowerCase();
    if (token === 'id') return 'ID';
    if (token === 'sku') return 'SKU';
    if (token === 'ean') return 'EAN';
    if (token === 'pkwiu') return 'PKWiU';
    if (token === 'gtu') return 'GTU';
    if (token === 'cn') return 'CN';
    if (token === 'uom') return 'UOM';
    if (token === 'url') return 'URL';
    return token.charAt(0).toUpperCase() + token.slice(1);
  });

  return words.join(' ');
}

// getByPath: возвращает вычисленное значение для UI.
function getByPath(row, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((acc, part) => (acc == null ? undefined : acc?.[part]), row);
}

// normalizeValueForCell: нормализует данные для отображения и ввода.
function normalizeValueForCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const chunks = value
      .map((item) => normalizeValueForCell(item))
      .filter((item) => item && item !== '—');
    return chunks.length ? chunks.join(', ') : '—';
  }
  if (typeof value === 'object') {
    const label = value.name || value.title || value.label || value.fullName || value.shortName || value.id || null;
    if (label) return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

// normalizeColumns: нормализует данные для отображения и ввода.
function normalizeColumns(columns) {
  return (Array.isArray(columns) ? columns : [])
    .filter((col) => col && col.key)
    .map((col) => ({ ...col, key: String(col.key) }));
}

// normalizeDynamicColumnsMode: нормализует данные для отображения и ввода.
function normalizeDynamicColumnsMode(mode) {
  const normalized = String(mode || 'all').trim().toLowerCase();
  if (normalized === 'none' || normalized === 'off' || normalized === 'disabled') return 'none';
  if (normalized === 'custom-only' || normalized === 'custom' || normalized === 'customs') return 'custom-only';
  return 'all';
}

// buildDefaultVisibility: собирает структуру данных для рендера или запроса.
function buildDefaultVisibility(columns) {
  return normalizeColumns(columns).reduce((acc, col) => {
    acc[col.key] = col.defaultVisible !== false;
    return acc;
  }, {});
}

// buildDynamicColumnsFromRows: собирает структуру данных для рендера или запроса.
function buildDynamicColumnsFromRows(rows, fixedColumns, options = {}) {
  const {
    includeTopLevel = true,
    includeCustomFields = true,
  } = options;
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) return [];
  if (!includeTopLevel && !includeCustomFields) return [];

  const fixedKeys = new Set(normalizeColumns(fixedColumns).map((item) => item.key));
  const discovered = new Map();
  const customFields = new Set();

  source.slice(0, 120).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    Object.entries(row).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey || '');
      if (!key || fixedKeys.has(key)) return;
      if (key.startsWith('_')) return;
      if (key === 'password' || key === 'hash' || key === 'salt') return;

      if (
        includeCustomFields
        && key === 'customFields'
        && rawValue
        && typeof rawValue === 'object'
        && !Array.isArray(rawValue)
      ) {
        Object.keys(rawValue).forEach((fieldKey) => {
          const customKey = `customFields.${fieldKey}`;
          if (!fixedKeys.has(customKey)) customFields.add(fieldKey);
        });
        return;
      }

      if (!includeTopLevel) return;

      if (!discovered.has(key)) {
        discovered.set(key, {
          key,
          title: humanizeColumnKey(key),
          managerLabel: humanizeColumnKey(key),
          managerGroup: 'additional',
          defaultVisible: false,
          sortable: false,
          width: 180,
                    // render: описывает рендер соответствующего блока UI.
render: (item) => normalizeValueForCell(item?.[key]),
        });
      }
    });
  });

  const customColumns = [...customFields]
    .sort((a, b) => a.localeCompare(b))
    .map((fieldKey) => {
      const key = `customFields.${fieldKey}`;
      return {
        key,
        title: humanizeColumnKey(fieldKey),
        managerLabel: humanizeColumnKey(fieldKey),
        managerGroup: 'custom',
        defaultVisible: false,
        sortable: false,
        width: 190,
                // render: описывает рендер соответствующего блока UI.
render: (item) => normalizeValueForCell(getByPath(item, key)),
      };
    });

  return [...discovered.values(), ...customColumns];
}

// normalizeQuery: нормализует данные для отображения и ввода.
function normalizeQuery(q = {}) {
  return {
    page: Number(q.page) > 0 ? Number(q.page) : 1,
    limit: Number(q.limit) > 0 ? Number(q.limit) : 25,
    sort: q.sort || 'createdAt',
    dir: q.dir === 'ASC' ? 'ASC' : 'DESC',
    search: q.search ?? undefined,
    type: q.type ?? undefined,
    status: q.status ?? undefined,
    from: q.from ?? undefined,
    to: q.to ?? undefined,
    ...q,
  };
}

const LIST_SCROLL_STORAGE_PREFIX = 'listPage:scroll:';

// readScrollSnapshot: читает сохраненную позицию прокрутки из sessionStorage.
function readScrollSnapshot(key) {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const top = Number(parsed?.top);
    const left = Number(parsed?.left);
    return {
      top: Number.isFinite(top) && top > 0 ? top : 0,
      left: Number.isFinite(left) && left > 0 ? left : 0,
      attempts: 0,
    };
  } catch {
    return null;
  }
}

// findVerticalScrollContainer: ищет ближайший вертикальный scroll-контейнер.
function findVerticalScrollContainer(node) {
  if (!node || typeof window === 'undefined') return null;

  const isScrollableElement = (element) => {
    if (!element) return false;
    const styles = window.getComputedStyle(element);
    const overflowY = String(styles.overflowY || '').toLowerCase();
    return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
  };

  if (isScrollableElement(node)) return node;

  let current = node.parentElement;
  while (current) {
    if (isScrollableElement(current)) return current;
    current = current.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

// findHorizontalScrollContainer: ищет элемент с горизонтальным скроллом внутри таблицы.
function findHorizontalScrollContainer(node) {
  if (!node || typeof window === 'undefined') return null;

  const candidates = [node, ...Array.from(node.querySelectorAll('*'))];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!(candidate instanceof HTMLElement)) continue;
    const styles = window.getComputedStyle(candidate);
    const overflowX = String(styles.overflowX || '').toLowerCase();
    const canScroll = (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay')
      && candidate.scrollWidth > candidate.clientWidth;
    if (canScroll) return candidate;
  }

  return node;
}

// Компонент Button: отвечает за отображение UI и обработку взаимодействий пользователя.
export function Button({ variant = 'primary', children, className = '', ...props }) {
  const cls = variant === 'primary' ? s.primary : s.btn;
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

const ListPage = forwardRef(function ListPage(
  {
    source,
    externalData,
    externalMeta,
    externalLoading,
    externalError,
    onExternalRefetch,
    query: controlledQuery,
    onQueryChange,
    columns = [],
    defaultQuery = {},
    actions,
    rowActions,
    columnWidths,
    onColumnResize,
    columnOrder,
    onColumnOrderChange,
    columnVisibility,
    onColumnVisibilityChange,
    savedViews,
    activeViewId,
    onSavedViewsChange,
    onActiveViewChange,
    onResetColumns,
    rowKey = 'id',
    ToolbarComponent,
    toolbarExtra,
    transformItems,
    enableColumnManager = true,
    columnManagerTitle,
    enableSavedViews = true,
    dynamicColumnsMode = 'all',
    className = '',
    cardClassName = '',
    toolbarShellClassName = '',
    metaBarClassName = '',
    tableRegionClassName = '',
    emptyStateText,
    emptyStateContent,
  },
  ref
) {
  const { t } = useTranslation();
  const location = useLocation();
  const rootRef = React.useRef(null);
  const verticalRootRef = React.useRef(null);
  const horizontalRootRef = React.useRef(null);
  const verticalScrollRef = React.useRef(null);
  const horizontalScrollRef = React.useRef(null);
  const pendingScrollRestoreRef = React.useRef(null);

  const isExternal = typeof externalData !== 'undefined';
  const baseColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const baseColumnKeys = useMemo(() => baseColumns.map((col) => col.key), [baseColumns]);
  const inferredMode = useMemo(
    () => normalizeDynamicColumnsMode(dynamicColumnsMode),
    [dynamicColumnsMode]
  );

  const [localColumnWidths, setLocalColumnWidths] = useState({});
  const [localColumnOrder, setLocalColumnOrder] = useState([]);
  const [localColumnVisibility, setLocalColumnVisibility] = useState(() => buildDefaultVisibility(baseColumns));
  const [localSavedViews, setLocalSavedViews] = useState([]);
  const [localActiveViewId, setLocalActiveViewId] = useState(DEFAULT_GRID_VIEW_ID);

  const effectiveColumnWidths = columnWidths ?? localColumnWidths;
  const effectiveColumnVisibility = columnVisibility ?? localColumnVisibility;
  const effectiveSavedViews = savedViews ?? localSavedViews;
  const effectiveActiveViewId = String((activeViewId ?? localActiveViewId) || DEFAULT_GRID_VIEW_ID);
  const scrollStorageKey = useMemo(
    () => `${LIST_SCROLL_STORAGE_PREFIX}${location.pathname}::${String(source || 'external')}`,
    [location.pathname, source]
  );

  const persistScrollSnapshot = useCallback(() => {
    if (!scrollStorageKey || typeof window === 'undefined') return;

    const vertical = verticalScrollRef.current;
    const horizontal = horizontalScrollRef.current;

    const top = Number(vertical?.scrollTop || 0);
    const left = Number(horizontal?.scrollLeft || 0);

    try {
      window.sessionStorage.setItem(scrollStorageKey, JSON.stringify({ top, left }));
    } catch {
      // ignore storage write errors
    }
  }, [scrollStorageKey]);

  const updateColumnWidths = useCallback((next) => {
    if (onColumnResize) {
      onColumnResize(next);
      return;
    }
    setLocalColumnWidths(next);
  }, [onColumnResize]);

  const updateColumnOrder = useCallback((next) => {
    if (!Array.isArray(next)) return;
    if (onColumnOrderChange) {
      onColumnOrderChange(next);
      return;
    }
    setLocalColumnOrder(next);
  }, [onColumnOrderChange]);

  const updateColumnVisibility = useCallback((next) => {
    if (!next || typeof next !== 'object') return;
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(next);
      return;
    }
    setLocalColumnVisibility(next);
  }, [onColumnVisibilityChange]);

  const updateSavedViews = useCallback((next) => {
    if (!Array.isArray(next)) return;
    if (onSavedViewsChange) {
      onSavedViewsChange(next);
      return;
    }
    setLocalSavedViews(next);
  }, [onSavedViewsChange]);

  const updateActiveView = useCallback((nextViewId) => {
    const next = String(nextViewId || DEFAULT_GRID_VIEW_ID);
    if (onActiveViewChange) {
      onActiveViewChange(next);
      return;
    }
    setLocalActiveViewId(next);
  }, [onActiveViewChange]);

  const resetColumns = useCallback(() => {
    const defaultsVisibility = buildDefaultVisibility(baseColumns);
    if (typeof onResetColumns === 'function') {
      onResetColumns();
    } else {
      updateColumnWidths({});
      updateColumnOrder(baseColumnKeys);
      updateColumnVisibility(defaultsVisibility);
    }
  }, [baseColumnKeys, baseColumns, onResetColumns, updateColumnOrder, updateColumnVisibility, updateColumnWidths]);

  const initQuery = useMemo(() => normalizeQuery(defaultQuery), [defaultQuery]);
  const [internalQuery, setInternalQuery] = useState(initQuery);
  const query = useMemo(
    () => normalizeQuery(isExternal ? (controlledQuery || initQuery) : internalQuery),
    [isExternal, controlledQuery, initQuery, internalQuery]
  );

  const reg = useMemo(() => {
    if (!isExternal) {
      const r = REGISTRY[source];
      if (!r) throw new Error(`ListPage: неизвестный source="${source}"`);
      return r;
    }
    return {
            // useQuery: инкапсулирует переиспользуемую UI-логику.
useQuery: () => ({
        data: { items: externalData, total: externalMeta?.total, page: externalMeta?.page, limit: externalMeta?.limit },
        isFetching: !!externalLoading,
        refetch: onExternalRefetch || (() => {}),
        error: externalError || null,
      }),
            // adapt: вспомогательная логика компонента.
adapt: (_data, q) => {
        const items = Array.isArray(externalData) ? externalData : (externalData?.items || []);
        const total = Number(externalMeta?.total ?? items.length ?? 0);
        const page = Number(externalMeta?.page ?? q.page ?? 1);
        const limit = Number(externalMeta?.limit ?? q.limit ?? 25);
        return { items, total, page, limit };
      },
    };
  }, [isExternal, source, externalData, externalMeta, externalLoading, onExternalRefetch, externalError]);

  const r = reg.useQuery(query);

  const adapted = useMemo(() => {
    const base = reg.adapt(r.data || {}, query);
    const items = typeof transformItems === 'function' ? transformItems(base.items, query) : base.items;
    return { ...base, items };
  }, [r.data, reg, transformItems, query]);

  const inferredColumns = useMemo(
    () => buildDynamicColumnsFromRows(adapted.items, baseColumns, {
      includeTopLevel: inferredMode === 'all',
      includeCustomFields: inferredMode !== 'none',
    }),
    [adapted.items, baseColumns, inferredMode]
  );
  const normalizedColumns = useMemo(
    () => normalizeColumns([...baseColumns, ...inferredColumns]),
    [baseColumns, inferredColumns]
  );
  const columnKeys = useMemo(() => normalizedColumns.map((col) => col.key), [normalizedColumns]);

  useEffect(() => {
    setLocalColumnVisibility((prev) => {
      const defaults = buildDefaultVisibility(normalizedColumns);
      const next = { ...defaults, ...(prev || {}) };
      Object.keys(next).forEach((key) => {
        if (!columnKeys.includes(key)) delete next[key];
      });
      return next;
    });
  }, [columnKeys, normalizedColumns]);

  const effectiveColumnOrder = useMemo(() => {
    const base = Array.isArray(columnOrder) ? columnOrder : localColumnOrder;
    if (!Array.isArray(base) || !base.length) return columnKeys;
    const filtered = base.filter((key) => columnKeys.includes(String(key))).map(String);
    const missing = columnKeys.filter((key) => !filtered.includes(key));
    return [...filtered, ...missing];
  }, [columnOrder, localColumnOrder, columnKeys]);

  const replaceQuery = useCallback((nextOrSetter) => {
    const next = normalizeQuery(typeof nextOrSetter === 'function' ? nextOrSetter(query) : nextOrSetter);
    if (isExternal) onQueryChange?.(next);
    else setInternalQuery(next);
  }, [isExternal, onQueryChange, query]);

  const setPage = useCallback((p) => replaceQuery((q) => ({ ...q, page: Math.max(1, Number(p) || 1) })), [replaceQuery]);
  const setLimit = useCallback((lim) => replaceQuery((q) => ({ ...q, limit: Math.max(1, Number(lim) || 25), page: 1 })), [replaceQuery]);
  const setSort = useCallback((k, d) => replaceQuery((q) => ({ ...q, sort: k, dir: d === 'ASC' ? 'ASC' : 'DESC', page: 1 })), [replaceQuery]);
  const refetch = useCallback(() => r.refetch?.(), [r]);

  useImperativeHandle(ref, () => ({
    refetch,
    replaceQuery,
        // getQuery: возвращает вычисленное значение для UI.
getQuery: () => query,
  }), [refetch, replaceQuery, query]);

  const total = adapted.total ?? 0;
  const start = total ? (query.page - 1) * query.limit + 1 : 0;
  const end = total ? Math.min(query.page * query.limit, total) : 0;
  const pages = Math.max(1, Math.ceil(total / (query.limit || 1)));

  const ToolbarToRender = ToolbarComponent || DefaultToolbar;
  const limitOptions = [10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }));

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsSearch, setColumnsSearch] = useState('');

  const managerColumns = useMemo(
    () => normalizedColumns.filter((col) => !col.managerHidden && !col.hiddenFromPicker),
    [normalizedColumns]
  );

  const managerOrder = useMemo(() => {
    const order = effectiveColumnOrder.filter((key) => managerColumns.some((col) => col.key === key));
    const missing = managerColumns.map((col) => col.key).filter((key) => !order.includes(key));
    return [...order, ...missing];
  }, [effectiveColumnOrder, managerColumns]);

  const managerMap = useMemo(
    () => new Map(managerColumns.map((col) => [col.key, col])),
    [managerColumns]
  );

  const isColumnVisible = useCallback((col) => {
    if (!col) return false;
    const explicit = effectiveColumnVisibility?.[col.key];
    if (typeof explicit === 'boolean') return explicit;
    return col.defaultVisible !== false;
  }, [effectiveColumnVisibility]);

  const activeManagerRows = useMemo(() => (
    managerOrder
      .map((key) => managerMap.get(key))
      .filter(Boolean)
      .filter((col) => isColumnVisible(col))
  ), [isColumnVisible, managerMap, managerOrder]);

  const availableManagerRows = useMemo(() => {
    const search = String(columnsSearch || '').trim().toLowerCase();
    return managerOrder
      .map((key) => managerMap.get(key))
      .filter(Boolean)
      .filter((col) => !isColumnVisible(col))
      .filter((col) => {
        if (!search) return true;
        const label = getColumnLabel(col).toLowerCase();
        const group = getColumnGroup(col).toLowerCase();
        return label.includes(search) || group.includes(search) || String(col.key).toLowerCase().includes(search);
      });
  }, [columnsSearch, isColumnVisible, managerMap, managerOrder]);

  const groupedAvailableRows = useMemo(() => {
    const order = ['default', 'business', 'logistics', 'main', 'additional', 'custom', 'system'];
    const labels = {
      default: t('list.columns.groupDefault', 'Основные'),
      business: t('list.columns.groupBusiness', 'Коммерция'),
      logistics: t('list.columns.groupLogistics', 'Логистика'),
      main: t('list.columns.groupMain', 'Основные'),
      additional: t('list.columns.groupAdditional', 'Дополнительные'),
      custom: t('list.columns.groupCustomFields', 'Пользовательские поля'),
      system: t('list.columns.groupSystem', 'Системные'),
    };

    const groups = {};
    availableManagerRows.forEach((col) => {
      const group = getColumnGroup(col);
      if (!groups[group]) groups[group] = [];
      groups[group].push(col);
    });

    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    Object.keys(groups).forEach((groupKey) => {
      groups[groupKey] = [...groups[groupKey]].sort((a, b) => {
        const byLabel = collator.compare(getColumnLabel(a), getColumnLabel(b));
        if (byLabel !== 0) return byLabel;
        return collator.compare(String(a?.key || ''), String(b?.key || ''));
      });
    });

    const keys = [...order, ...Object.keys(groups).filter((key) => !order.includes(key))]
      .filter((key) => (groups[key] || []).length > 0);

    return keys.map((key) => ({ key, label: labels[key] || key, items: groups[key] }));
  }, [availableManagerRows, t]);

  const visibleCount = useMemo(() => activeManagerRows.length, [activeManagerRows]);
  const availableCount = useMemo(
    () => Math.max(0, managerColumns.length - visibleCount),
    [managerColumns.length, visibleCount]
  );

  const toggleColumn = useCallback((key) => {
    const col = managerMap.get(key);
    if (!col) return;

    const current = isColumnVisible(col);

    if (current && visibleCount <= 1) return;
    if (col.canHide === false && current) return;

    const next = {
      ...(effectiveColumnVisibility || {}),
      [key]: !current,
    };

    updateColumnVisibility(next);
  }, [effectiveColumnVisibility, isColumnVisible, managerMap, updateColumnVisibility, visibleCount]);

  const moveManagedColumn = useCallback((fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;

    const curr = [...managerOrder];
    const fromIndex = curr.indexOf(fromKey);
    const toIndex = curr.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0) return;

    curr.splice(fromIndex, 1);
    curr.splice(toIndex, 0, fromKey);

    updateColumnOrder(curr);
  }, [managerOrder, updateColumnOrder]);

  const managerModalTitle = columnManagerTitle || t('list.columns.configure', 'Вид таблицы');

  const addColumnToView = useCallback((key) => {
    const col = managerMap.get(key);
    if (!col || isColumnVisible(col)) return;

    updateColumnVisibility({
      ...(effectiveColumnVisibility || {}),
      [key]: true,
    });

    const baseOrder = managerOrder.filter((currentKey) => currentKey !== key);
    const lastVisibleIndex = (() => {
      for (let index = baseOrder.length - 1; index >= 0; index -= 1) {
        const current = managerMap.get(baseOrder[index]);
        if (current && isColumnVisible(current)) return index;
      }
      return -1;
    })();

    const insertIndex = lastVisibleIndex + 1;
    const nextOrder = [...baseOrder];
    nextOrder.splice(insertIndex, 0, key);
    updateColumnOrder(nextOrder);
  }, [
    effectiveColumnVisibility,
    isColumnVisible,
    managerMap,
    managerOrder,
    updateColumnOrder,
    updateColumnVisibility,
  ]);

  const removeColumnFromView = useCallback((key) => {
    const col = managerMap.get(key);
    if (!col) return;
    if (col.canHide === false) return;
    if (!isColumnVisible(col)) return;
    if (visibleCount <= 1) return;
    toggleColumn(key);
  }, [isColumnVisible, managerMap, toggleColumn, visibleCount]);

  const activeColumnItems = useMemo(() => (
    activeManagerRows.map((col) => {
      const label = getColumnLabel(col);
      const allowRaw = col.managerShowRawKey === true;
      const raw = allowRaw && label !== String(col.key || '') ? String(col.key || '') : '';
      return {
        key: col.key,
        label,
        raw,
        dragDisabled: col.orderLocked === true,
        disableRemove: col.canHide === false || visibleCount <= 1,
      };
    })
  ), [activeManagerRows, visibleCount]);

  const availableGroupItems = useMemo(() => (
    groupedAvailableRows.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((col) => {
        const label = getColumnLabel(col);
        const allowRaw = col.managerShowRawKey === true;
        const raw = allowRaw && label !== String(col.key || '') ? String(col.key || '') : '';
        return { key: col.key, label, raw };
      }),
    }))
  ), [groupedAvailableRows]);
  const normalizedSavedViews = useMemo(() => (
    (Array.isArray(effectiveSavedViews) ? effectiveSavedViews : [])
      .filter((item) => item && typeof item === 'object' && item.id && item.id !== DEFAULT_GRID_VIEW_ID)
      .map((item) => ({
        ...item,
        id: String(item.id),
        name: String(item.name || '').trim() || t('list.views.untitled', 'Без имени'),
        state: item.state && typeof item.state === 'object' ? item.state : {},
      }))
  ), [effectiveSavedViews, t]);
  const activeSavedView = useMemo(
    () => normalizedSavedViews.find((item) => item.id === effectiveActiveViewId) || null,
    [normalizedSavedViews, effectiveActiveViewId]
  );

  const captureCurrentViewState = useCallback(() => ({
    query: { ...query, page: 1 },
    columnOrder: [...effectiveColumnOrder],
    columnVisibility: { ...(effectiveColumnVisibility || {}) },
    columnWidths: { ...(effectiveColumnWidths || {}) },
  }), [effectiveColumnOrder, effectiveColumnVisibility, effectiveColumnWidths, query]);

  const applyViewState = useCallback((state) => {
    if (!state || typeof state !== 'object') return;
    if (state.columnWidths && typeof state.columnWidths === 'object') {
      updateColumnWidths(state.columnWidths);
    }
    if (Array.isArray(state.columnOrder)) {
      updateColumnOrder(state.columnOrder);
    }
    if (state.columnVisibility && typeof state.columnVisibility === 'object') {
      updateColumnVisibility(state.columnVisibility);
    }
    if (state.query && typeof state.query === 'object') {
      replaceQuery((prev) => ({ ...prev, ...state.query, page: 1 }));
    }
  }, [replaceQuery, updateColumnOrder, updateColumnVisibility, updateColumnWidths]);

  const [viewEditorOpen, setViewEditorOpen] = useState(false);
  const [viewEditorMode, setViewEditorMode] = useState('create');
  const [viewNameDraft, setViewNameDraft] = useState('');
  const [viewError, setViewError] = useState('');
  const [deleteViewOpen, setDeleteViewOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const viewOptions = useMemo(() => ([
    { value: DEFAULT_GRID_VIEW_ID, label: t('list.views.default', 'По умолчанию') },
    ...normalizedSavedViews.map((item) => ({ value: item.id, label: item.name })),
  ]), [normalizedSavedViews, t]);

  const openCreateViewEditor = useCallback(() => {
    setViewMenuOpen(false);
    setViewEditorMode('create');
    setViewNameDraft('');
    setViewError('');
    setViewEditorOpen(true);
  }, []);

  const openRenameViewEditor = useCallback(() => {
    if (!activeSavedView) return;
    setViewMenuOpen(false);
    setViewEditorMode('rename');
    setViewNameDraft(activeSavedView.name || '');
    setViewError('');
    setViewEditorOpen(true);
  }, [activeSavedView]);

  const persistView = useCallback(() => {
    const name = String(viewNameDraft || '').replace(/\s+/g, ' ').trim();
    if (!name) {
      setViewError(t('list.views.nameRequired', 'Введите имя представления'));
      return;
    }
    const normalized = name.toLowerCase();

    if (viewEditorMode === 'rename') {
      if (!activeSavedView) return;
      const duplicate = normalizedSavedViews.some((item) => item.id !== activeSavedView.id && item.name.toLowerCase() === normalized);
      if (duplicate) {
        setViewError(t('list.views.nameTaken', 'Представление с таким именем уже существует'));
        return;
      }
      updateSavedViews(
        normalizedSavedViews.map((item) => (
          item.id === activeSavedView.id
            ? { ...item, name, updatedAt: new Date().toISOString() }
            : item
        ))
      );
      setViewEditorOpen(false);
      return;
    }

    const duplicate = normalizedSavedViews.some((item) => item.name.toLowerCase() === normalized);
    if (duplicate) {
      setViewError(t('list.views.nameTaken', 'Представление с таким именем уже существует'));
      return;
    }

    const id = `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const next = [
      ...normalizedSavedViews,
      {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        state: captureCurrentViewState(),
      },
    ];
    updateSavedViews(next);
    updateActiveView(id);
    setViewEditorOpen(false);
  }, [
    activeSavedView,
    captureCurrentViewState,
    normalizedSavedViews,
    t,
    updateActiveView,
    updateSavedViews,
    viewEditorMode,
    viewNameDraft,
  ]);

  const updateActiveSavedView = useCallback(() => {
    if (!activeSavedView) return;
    const now = new Date().toISOString();
    updateSavedViews(
      normalizedSavedViews.map((item) => (
        item.id === activeSavedView.id
          ? { ...item, updatedAt: now, state: captureCurrentViewState() }
          : item
      ))
    );
  }, [activeSavedView, captureCurrentViewState, normalizedSavedViews, updateSavedViews]);

  const deleteActiveSavedView = useCallback(() => {
    if (!activeSavedView) return;
    setViewMenuOpen(false);
    updateSavedViews(normalizedSavedViews.filter((item) => item.id !== activeSavedView.id));
    updateActiveView(DEFAULT_GRID_VIEW_ID);
    setDeleteViewOpen(false);
  }, [activeSavedView, normalizedSavedViews, updateActiveView, updateSavedViews]);

  useEffect(() => {
    if (!viewMenuOpen) return undefined;
        // onDocMouseDown: вспомогательная логика компонента.
const onDocMouseDown = (event) => {
      const target = event?.target;
      if (target && typeof target.closest === 'function' && target.closest('[data-view-menu-wrap="1"]')) {
        return;
      }
      setViewMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!columnsOpen) return undefined;
        // onDocMouseDown: вспомогательная логика компонента.
const onDocMouseDown = (event) => {
      const target = event?.target;
      if (target && typeof target.closest === 'function' && target.closest('[data-view-panel-wrap="1"]')) {
        return;
      }
      setColumnsOpen(false);
    };
        // onEscape: вспомогательная логика компонента.
const onEscape = (event) => {
      if (event.key === 'Escape') setColumnsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [columnsOpen]);

  const appliedViewRef = React.useRef('');
  useEffect(() => {
    if (!enableSavedViews) return;
    if (appliedViewRef.current === effectiveActiveViewId) return;
    if (effectiveActiveViewId === DEFAULT_GRID_VIEW_ID) {
      appliedViewRef.current = effectiveActiveViewId;
      return;
    }
    const state = activeSavedView?.state;
    if (state) applyViewState(state);
    appliedViewRef.current = effectiveActiveViewId;
  }, [
    activeSavedView?.state,
    applyViewState,
    effectiveActiveViewId,
    enableSavedViews,
  ]);

  useEffect(() => {
    const verticalRoot = verticalRootRef.current || rootRef.current;
    if (!verticalRoot || typeof window === 'undefined') return undefined;

    const vertical = findVerticalScrollContainer(verticalRoot);
    const horizontal = findHorizontalScrollContainer(horizontalRootRef.current);

    verticalScrollRef.current = vertical;
    horizontalScrollRef.current = horizontal;
    pendingScrollRestoreRef.current = readScrollSnapshot(scrollStorageKey);

    const onVerticalScroll = () => persistScrollSnapshot();
    const onHorizontalScroll = () => persistScrollSnapshot();

    vertical?.addEventListener('scroll', onVerticalScroll, { passive: true });
    if (horizontal && horizontal !== vertical) {
      horizontal.addEventListener('scroll', onHorizontalScroll, { passive: true });
    }

    return () => {
      vertical?.removeEventListener('scroll', onVerticalScroll);
      if (horizontal && horizontal !== vertical) {
        horizontal.removeEventListener('scroll', onHorizontalScroll);
      }
      persistScrollSnapshot();
    };
  }, [persistScrollSnapshot, scrollStorageKey]);

  useEffect(() => {
    const snapshot = pendingScrollRestoreRef.current;
    if (!snapshot || r.isFetching) return;

    const vertical = verticalScrollRef.current;
    const horizontal = horizontalScrollRef.current;

    if (vertical) vertical.scrollTop = snapshot.top;
    if (horizontal) horizontal.scrollLeft = snapshot.left;

    snapshot.attempts += 1;

    const verticalReady = !vertical
      || Math.abs(Number(vertical.scrollTop || 0) - snapshot.top) <= 1
      || (vertical.scrollHeight - vertical.clientHeight) <= snapshot.top;
    const horizontalReady = !horizontal
      || Math.abs(Number(horizontal.scrollLeft || 0) - snapshot.left) <= 1
      || (horizontal.scrollWidth - horizontal.clientWidth) <= snapshot.left;

    if ((verticalReady && horizontalReady) || snapshot.attempts >= 6) {
      pendingScrollRestoreRef.current = null;
    }
  }, [adapted.items.length, r.isFetching, scrollStorageKey]);

  return (
    <div className={`${s.wrap} ${className}`.trim()} ref={rootRef}>
      <div className={`${s.card} ${cardClassName}`.trim()}>
        <div className={`${s.toolbarShell} ${toolbarShellClassName}`.trim()}>
          <div className={s.toolbarLeft}>
            <ToolbarToRender
              query={query}
              onChange={(setter) => {
                const next = typeof setter === 'function' ? setter(query) : setter;
                replaceQuery(next);
              }}
              extra={toolbarExtra}
              variant="inline"
              className={s.filterInline}
            />
          </div>

          <div className={s.toolbarCenter}>
            {enableSavedViews ? (
              <div className={s.viewsControls}>
                <ThemedSelect
                  className={s.viewSelect}
                  size="sm"
                  value={effectiveActiveViewId}
                  options={viewOptions}
                  onChange={(value) => updateActiveView(String(value || DEFAULT_GRID_VIEW_ID))}
                  placeholder={t('list.views.select', 'Выбрать представление')}
                />
                <div className={s.viewMenuWrap} data-view-menu-wrap="1">
                  <button
                    type="button"
                    className={s.iconBtn}
                    onClick={() => setViewMenuOpen((prev) => !prev)}
                    title={t('common.actions', 'Действия')}
                  >
                    ⋯
                  </button>
                  {viewMenuOpen ? (
                    <div className={s.viewMenu}>
                      <button type="button" className={s.viewMenuItem} onClick={openCreateViewEditor}>
                        {t('list.views.saveAs', 'Сохранить как новое')}
                      </button>
                      {activeSavedView ? (
                        <>
                          <button type="button" className={s.viewMenuItem} onClick={updateActiveSavedView}>
                            {t('list.views.updateCurrent', 'Обновить текущее')}
                          </button>
                          <button type="button" className={s.viewMenuItem} onClick={openRenameViewEditor}>
                            {t('list.views.rename', 'Переименовать')}
                          </button>
                          <button
                            type="button"
                            className={`${s.viewMenuItem} ${s.viewMenuItemDanger}`}
                            onClick={() => {
                              setViewMenuOpen(false);
                              setDeleteViewOpen(true);
                            }}
                          >
                            {t('list.views.delete', 'Удалить')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className={s.toolbarRight}>
            {enableColumnManager ? (
              <div className={s.viewPanelWrap} data-view-panel-wrap="1">
                <button
                  type="button"
                  className={`${s.btn} ${s.viewButton}`}
                  onClick={() => setColumnsOpen((prev) => !prev)}
                  title={managerModalTitle}
                >
                  <span aria-hidden="true">⚙</span>
                  <span>{t('list.columns.view', 'Вид')}</span>
                </button>
                {columnsOpen ? (
                  <div className={s.viewPanel}>
                    <ColumnViewEditor
                      title={t('list.columns.configure', 'Вид списка')}
                      hint={t('list.columns.drawerHint', 'Управляйте отображением полей и структурой списка')}
                      onClose={() => setColumnsOpen(false)}
                      currentViewName={activeSavedView?.name || t('list.views.default', 'По умолчанию')}
                      activeTitle={t('list.columns.active', 'Сейчас в таблице')}
                      availableTitle={t('list.columns.available', 'Добавить поле')}
                      activeCount={visibleCount}
                      availableCount={availableCount}
                      visibleSummary={t('list.columns.visibleOfTotal', {
                        visible: visibleCount,
                        total: managerColumns.length,
                        defaultValue: `Показано ${visibleCount} из ${managerColumns.length}`,
                      })}
                      searchValue={columnsSearch}
                      onSearchChange={setColumnsSearch}
                      activeItems={activeColumnItems}
                      availableGroups={availableGroupItems}
                      onMoveActive={moveManagedColumn}
                      onRemoveActive={removeColumnFromView}
                      onAddField={addColumnToView}
                      onReset={resetColumns}
                      labels={{
                        close: t('common.close', 'Закрыть'),
                        search: t('list.columns.searchPlaceholder', 'Поиск полей'),
                        noActive: t('list.columns.noActiveColumns', 'Добавьте поля в текущее представление'),
                        emptySearch: t('list.columns.emptySearch', 'Поля не найдены'),
                        add: t('list.columns.add', 'Добавить поле'),
                        remove: t('list.columns.remove', 'Убрать поле'),
                        reset: t('list.columns.reset', 'Сбросить'),
                        resetHint: t('list.columns.resetHint', 'Сбросить состав и порядок полей'),
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <button type="button" className={s.btn} onClick={refetch} title={t('list.refresh')}>
              {t('list.refresh', 'Обновить')}
            </button>
            {actions ? <div className={s.primaryAction}>{actions}</div> : null}
          </div>
        </div>

        <div className={`${s.metaBar} ${metaBarClassName}`.trim()}>
          <div className={s.metaLeft}>
            <span className={s.count}>
              {t('list.rangeOfTotal', { start, end, total })}
            </span>

            <label className={s.perPage} aria-label={t('list.perPageAria') || 'На странице'}>
              <ThemedSelect
                className={s.pageSize}
                value={query.limit}
                onChange={(val) => setLimit(Number(val))}
                options={limitOptions}
                placeholder="стр."
                size="sm"
              />
              <span className={s.muted}>стр.</span>
            </label>
          </div>

          <div className={s.pager}>
            <button
              type="button"
              className={s.btn}
              onClick={() => setPage(Math.max(1, query.page - 1))}
              disabled={query.page <= 1}
            >
              {t('list.back')}
            </button>

            <span className={s.pageBadge}>
              {t('list.pageLabel', { page: query.page, pages })}
            </span>

            <button
              type="button"
              className={s.btn}
              onClick={() => setPage(Math.min(pages, query.page + 1))}
              disabled={query.page >= pages}
            >
              {t('list.forward')}
            </button>
          </div>
        </div>

        {r.error && <div className={s.error}>{String(r.error?.data?.error || r.error?.message || 'Error')}</div>}

        <div className={`${s.tableRegion} ${tableRegionClassName}`.trim()}>
          <div className={s.tableViewport} ref={verticalRootRef}>
            <div className={s.scrollX} ref={horizontalRootRef}>
              <DataTable
                columns={normalizedColumns}
                data={adapted.items}
                loading={!!r.isFetching}
                emptyStateText={emptyStateText}
                emptyStateContent={emptyStateContent}
                rowActions={rowActions}
                sortKey={query.sort}
                sortDir={query.dir}
                onSort={(key, dir) => setSort(key, dir)}
                rowKey={rowKey}
                columnWidths={effectiveColumnWidths}
                onColumnResize={updateColumnWidths}
                columnOrder={effectiveColumnOrder}
                onColumnOrderChange={updateColumnOrder}
                columnVisibility={effectiveColumnVisibility}
              />
            </div>
          </div>
        </div>
      </div>

      {enableSavedViews ? (
        <Modal
          open={viewEditorOpen}
          onClose={() => setViewEditorOpen(false)}
          title={viewEditorMode === 'rename'
            ? t('list.views.rename', 'Переименовать представление')
            : t('list.views.create', 'Сохранить представление')}
          size="sm"
          footer={(
            <>
              <Modal.Button onClick={() => setViewEditorOpen(false)}>
                {t('common.cancel', 'Отмена')}
              </Modal.Button>
              <Modal.Button variant="primary" onClick={persistView}>
                {viewEditorMode === 'rename'
                  ? t('common.save', 'Сохранить')
                  : t('list.views.saveAs', 'Сохранить как новое')}
              </Modal.Button>
            </>
          )}
        >
          <div className={s.viewEditor}>
            <label className={s.viewEditorLabel} htmlFor="list-view-name">
              {t('list.views.name', 'Название представления')}
            </label>
            <input
              id="list-view-name"
              className={s.viewEditorInput}
              value={viewNameDraft}
              onChange={(event) => {
                setViewNameDraft(event.target.value);
                if (viewError) setViewError('');
              }}
              placeholder={t('list.views.namePlaceholder', 'Например: Сделки недели')}
              autoFocus
            />
            {viewError ? <div className={s.errorText}>{viewError}</div> : null}
          </div>
        </Modal>
      ) : null}

      {enableSavedViews ? (
        <Modal
          open={deleteViewOpen}
          onClose={() => setDeleteViewOpen(false)}
          title={t('list.views.deleteTitle', 'Удалить представление')}
          size="sm"
          footer={(
            <>
              <Modal.Button onClick={() => setDeleteViewOpen(false)}>
                {t('common.cancel', 'Отмена')}
              </Modal.Button>
              <Modal.Button className={s.btnDanger} onClick={deleteActiveSavedView}>
                {t('common.delete', 'Удалить')}
              </Modal.Button>
            </>
          )}
        >
          <p className={s.confirmText}>
            {t('list.views.deleteConfirm', {
              name: activeSavedView?.name || t('list.views.untitled', 'Без имени'),
              defaultValue: `Удалить представление «${activeSavedView?.name || 'Без имени'}»?`,
            })}
          </p>
        </Modal>
      ) : null}
    </div>
  );
});

export default ListPage;
