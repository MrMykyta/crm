// src/hooks/useListResource.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listResource } from '../api/resources';

const DEFAULTS = { page: 1, limit: 25, sort: 'createdAt', dir: 'DESC' };

export default function useListResource({ endpoint, defaultQuery = {}, immediate = true }) {
  const [query, setQuery] = useState({ ...DEFAULTS, ...defaultQuery });
  const [data, setData]   = useState({ items: [], total: 0, page: 1, limit: DEFAULTS.limit });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async (q = query) => {
    setLoading(true);
    setError('');
    try {
      const res = await listResource(endpoint, q);
      setData({ items: res.items || [], total: res.total || 0, page: res.page || q.page, limit: res.limit || q.limit });
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [endpoint, query]);

  useEffect(() => {
    if (!immediate) return;
    // ключ — сериализованная query, чтобы не ловить замыкания
    load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(query), immediate]);

  const actions = useMemo(() => ({
    setPage: (page) => setQuery(q => ({ ...q, page })),
    setLimit: (limit) => setQuery(q => ({ ...q, limit, page: 1 })),
    setSort: (sort, dir) => setQuery(q => ({ ...q, sort, dir })),
    setFilter: (name, value) => setQuery(q => ({ ...q, [name]: value, page: 1 })),
    setSearch: (search) => setQuery(q => ({ ...q, search, page: 1 })),
    refetch: () => load(),
    replaceQuery: (next) => setQuery({ ...DEFAULTS, ...next }),
  }), [load]);

  return { query, data, loading, error, ...actions };
}