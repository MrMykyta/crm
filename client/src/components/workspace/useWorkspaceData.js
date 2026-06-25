import { useCallback, useMemo, useState } from 'react';

import { useListCounterpartiesQuery } from '../../store/rtk/counterpartyApi';
import { useListTasksQuery } from '../../store/rtk/tasksApi';
import { useListCompanyUsersQuery, useListInvitationsQuery } from '../../store/rtk/companyUsersApi';
import { useGetDealsQuery } from '../../store/rtk/dealsApi';
import { useGetNotesQuery } from '../../store/rtk/notesApi';
import { useGetContactsQuery } from '../../store/rtk/contactsApi';
import { useListProductsQuery } from '../../store/rtk/productsApi';
import { useListDocumentsQuery } from '../../store/rtk/documentsApi';
import { useListOrdersQuery } from '../../store/rtk/ordersApi';
import { useListOffersQuery } from '../../store/rtk/offersApi';
import { useListInvoicesQuery } from '../../store/rtk/invoicesApi';
import { useGetStockBalancesQuery } from '../../store/rtk/stockBalancesApi';
import {
  useListAdjustmentsQuery,
  useListCycleCountsQuery,
  useListLocationsQuery,
  useListLotsQuery,
  useListParcelsQuery,
  useListReceiptsQuery,
  useListReservationsQuery,
  useListSerialsQuery,
  useListShipmentsQuery,
  useListStockMovesQuery,
  useListTransfersQuery,
  useListWarehousesQuery,
} from '../../store/rtk/wmsDocumentsApi';

const EMPTY_REQUEST = {
  data: { items: [], total: 0, page: 1, limit: 25 },
  isFetching: false,
  refetch: () => {},
  error: null,
};

function adaptListResponse(data, query = {}) {
  const items = Array.isArray(data) ? data : (data?.items || []);
  return {
    items,
    total: Number(data?.total ?? items.length ?? 0),
    page: Number(data?.page ?? query.page ?? 1),
    limit: Number(data?.limit ?? query.limit ?? 25),
  };
}

const REGISTRY = {
  counterparties: { useQuery: useListCounterpartiesQuery, adapt: adaptListResponse },
  tasks: { useQuery: useListTasksQuery, adapt: adaptListResponse },
  deals: { useQuery: useGetDealsQuery, adapt: adaptListResponse },
  notes: { useQuery: useGetNotesQuery, adapt: adaptListResponse },
  contacts: { useQuery: useGetContactsQuery, adapt: adaptListResponse },
  products: { useQuery: useListProductsQuery, adapt: adaptListResponse },
  documents: { useQuery: useListDocumentsQuery, adapt: adaptListResponse },
  orders: { useQuery: useListOrdersQuery, adapt: adaptListResponse },
  offers: { useQuery: useListOffersQuery, adapt: adaptListResponse },
  invoices: { useQuery: useListInvoicesQuery, adapt: adaptListResponse },
  stockBalances: { useQuery: useGetStockBalancesQuery, adapt: adaptListResponse },
  wmsReceipts: { useQuery: useListReceiptsQuery, adapt: adaptListResponse },
  wmsTransfers: { useQuery: useListTransfersQuery, adapt: adaptListResponse },
  wmsShipments: { useQuery: useListShipmentsQuery, adapt: adaptListResponse },
  wmsAdjustments: { useQuery: useListAdjustmentsQuery, adapt: adaptListResponse },
  wmsCycleCounts: { useQuery: useListCycleCountsQuery, adapt: adaptListResponse },
  wmsWarehouses: { useQuery: useListWarehousesQuery, adapt: adaptListResponse },
  wmsLocations: { useQuery: useListLocationsQuery, adapt: adaptListResponse },
  wmsStockMoves: { useQuery: useListStockMovesQuery, adapt: adaptListResponse },
  wmsReservations: { useQuery: useListReservationsQuery, adapt: adaptListResponse },
  wmsLots: { useQuery: useListLotsQuery, adapt: adaptListResponse },
  wmsSerials: { useQuery: useListSerialsQuery, adapt: adaptListResponse },
  wmsParcels: { useQuery: useListParcelsQuery, adapt: adaptListResponse },
  companyUsers: { useQuery: useListCompanyUsersQuery, adapt: adaptListResponse },
  companyInvites: { useQuery: useListInvitationsQuery, adapt: adaptListResponse },
};

export function normalizeQuery(query = {}) {
  return {
    page: Number(query.page) > 0 ? Number(query.page) : 1,
    limit: Number(query.limit) > 0 ? Number(query.limit) : 25,
    sort: query.sort || 'createdAt',
    dir: query.dir === 'ASC' ? 'ASC' : 'DESC',
    search: query.search ?? undefined,
    type: query.type ?? undefined,
    status: query.status ?? undefined,
    from: query.from ?? undefined,
    to: query.to ?? undefined,
    ...query,
  };
}

function createExternalEntry({
  externalData,
  externalMeta,
  externalLoading,
  externalError,
  onExternalRefetch,
}) {
  return {
    useQuery: () => ({
      data: {
        items: externalData,
        total: externalMeta?.total,
        page: externalMeta?.page,
        limit: externalMeta?.limit,
      },
      isFetching: !!externalLoading,
      refetch: onExternalRefetch || (() => {}),
      error: externalError || null,
    }),
    adapt: (_data, query = {}) => {
      const items = Array.isArray(externalData) ? externalData : (externalData?.items || []);
      return {
        items,
        total: Number(externalMeta?.total ?? items.length ?? 0),
        page: Number(externalMeta?.page ?? query.page ?? 1),
        limit: Number(externalMeta?.limit ?? query.limit ?? 25),
      };
    },
  };
}

function getRegistryEntry({
  source,
  externalData,
  externalMeta,
  externalLoading,
  externalError,
  onExternalRefetch,
}) {
  if (typeof externalData !== 'undefined') {
    return createExternalEntry({
      externalData,
      externalMeta,
      externalLoading,
      externalError,
      onExternalRefetch,
    });
  }

  if (!source) {
    return {
      useQuery: () => EMPTY_REQUEST,
      adapt: adaptListResponse,
    };
  }

  const entry = REGISTRY[source];
  if (!entry) throw new Error(`Workspace: unknown source="${source}"`);
  return entry;
}

function slicePage(items, page, limit) {
  const source = Array.isArray(items) ? items : [];
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Number(limit) || 25);
  const start = (currentPage - 1) * pageSize;
  return source.slice(start, start + pageSize);
}

export default function useWorkspaceData({
  source,
  externalData,
  externalMeta,
  externalLoading,
  externalError,
  onExternalRefetch,
  query: controlledQuery,
  onQueryChange,
  defaultQuery = {},
  transformItems,
  clientPaginate = false,
}) {
  const isControlled = typeof controlledQuery !== 'undefined';
  const initialQuery = useMemo(() => normalizeQuery(defaultQuery), [defaultQuery]);
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const query = useMemo(
    () => normalizeQuery(isControlled ? controlledQuery : internalQuery),
    [controlledQuery, internalQuery, isControlled]
  );

  const replaceQuery = useCallback((nextOrSetter) => {
    const next = normalizeQuery(typeof nextOrSetter === 'function' ? nextOrSetter(query) : nextOrSetter);
    if (isControlled) onQueryChange?.(next);
    else setInternalQuery(next);
  }, [isControlled, onQueryChange, query]);

  const setPage = useCallback((page) => {
    replaceQuery((current) => ({ ...current, page: Math.max(1, Number(page) || 1) }));
  }, [replaceQuery]);

  const setLimit = useCallback((limit) => {
    replaceQuery((current) => ({
      ...current,
      limit: Math.max(1, Number(limit) || 25),
      page: 1,
    }));
  }, [replaceQuery]);

  const setSort = useCallback((key, dir) => {
    replaceQuery((current) => ({
      ...current,
      sort: key,
      dir: dir === 'ASC' ? 'ASC' : 'DESC',
      page: 1,
    }));
  }, [replaceQuery]);

  const registryEntry = useMemo(
    () => getRegistryEntry({
      source,
      externalData,
      externalMeta,
      externalLoading,
      externalError,
      onExternalRefetch,
    }),
    [externalData, externalError, externalLoading, externalMeta, onExternalRefetch, source]
  );
  const request = registryEntry.useQuery(query);
  const adapted = useMemo(() => {
    const base = registryEntry.adapt(request.data || {}, query);
    const items = typeof transformItems === 'function'
      ? transformItems(base.items, query)
      : base.items;
    return { ...base, items };
  }, [query, registryEntry, request.data, transformItems]);

  const rows = useMemo(
    () => (clientPaginate ? slicePage(adapted.items, query.page, query.limit) : adapted.items),
    [adapted.items, clientPaginate, query.limit, query.page]
  );
  const total = Number(clientPaginate ? adapted.items.length : adapted.total ?? adapted.items.length ?? 0);

  return {
    rows,
    total,
    page: query.page,
    limit: query.limit,
    query,
    error: request.error,
    loading: !!request.isFetching,
    refetch: request.refetch,
    replaceQuery,
    setPage,
    setLimit,
    setSort,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      onPageChange: setPage,
      onLimitChange: setLimit,
    },
  };
}
