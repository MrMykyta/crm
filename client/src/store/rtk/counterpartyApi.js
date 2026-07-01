// src/store/rtk/counterpartyApi.js
import { crmApi } from './crmApi';

// stripCompanyId: вспомогательная логика для слоя RTK Query.
const stripCompanyId = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    value.delete('companyId');
    return value;
  }
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

// toQuery: вспомогательная логика для слоя RTK Query.
const toQuery = (params = {}) => {
  const esc = encodeURIComponent;
  const src = params && params.constructor === Object ? params : {};
  const entries = Object.entries(src)
    .filter(([k, v]) => k !== 'companyId' && v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return (
    '?' +
    entries
      .map(([k, v]) =>
        Array.isArray(v)
          ? v.map((x) => `${esc(k)}=${esc(x)}`).join('&')
          : `${esc(k)}=${esc(v)}`
      )
      .join('&')
  );
};

// normalizeLookupTerm: нормализует входные/выходные данные для слоя RTK Query.
const normalizeLookupTerm = (term) => {
  const trimmed = String(term || '').trim();
  if (!trimmed) return { trimmed: '', digits: '', numeric: false };
  const digits = trimmed.replace(/\s+/g, '');
  const numeric = /^[0-9\s]+$/.test(trimmed) && digits.length >= 6;
  return { trimmed, digits, numeric };
};

// безопасный обход всех активных кэшей listCounterparties
function forEachListCache(getState, fn) {
  const apiState = getState()?.[counterpartyApi.reducerPath];
  const queries = apiState?.queries || {};
  for (const [cacheKey, sub] of Object.entries(queries)) {
    if (sub?.endpointName !== 'listCounterparties') continue;
    fn(sub.originalArgs);
  }
}

export const counterpartyApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({

    // ---------- LIST ----------
    listCounterparties: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (q = {}) => ({
        url: `/counterparties${toQuery(stripCompanyId(q))}`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => {
        if (Array.isArray(resp)) {
          return { items: resp, total: resp.length, page: 1, limit: resp.length };
        }
        const items = Array.isArray(resp?.items) ? resp.items : [];
        return {
          items,
          total: Number(resp?.total ?? items.length) || 0,
          page: Number(resp?.page ?? 1) || 1,
          limit: Number(resp?.limit ?? items.length) || items.length,
        };
      },
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => {
        const ids = Array.isArray(res?.items) ? res.items.map((i) => i.id) : [];
        return [{ type: 'Counterparty', id: 'LIST' }, ...ids.map((id) => ({ type: 'Counterparty', id }))];
      },
      keepUnusedDataFor: 60,
    }),

    // ---------- LOOKUP (Autocomplete) ----------
    getCounterpartyLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ term, limit = 12 } = {}) => {
        const { trimmed, digits, numeric } = normalizeLookupTerm(term);
        const params = { limit };

        if (trimmed) {
          if (numeric) {
            params.search = digits;
            params.nip = digits;
          } else {
            params.search = trimmed;
          }
        }

        return {
          url: `/counterparties${toQuery(params)}`,
          method: 'GET',
        };
      },
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => {
        const items = Array.isArray(resp?.items)
          ? resp.items
          : Array.isArray(resp)
            ? resp
            : [];

        return items.map((row) => {
          const name =
            row?.shortName ||
            row?.fullName ||
            [row?.firstName, row?.lastName].filter(Boolean).join(' ') ||
            `#${row?.id}`;

          const contacts = Array.isArray(row?.contacts) ? row.contacts : [];
          const emailContact = contacts.find(
            (c) => String(c?.channel || '').toLowerCase() === 'email'
          );

          return {
            id: row?.id,
            name,
            nip: row?.nip || null,
            email: emailContact?.valueNorm || emailContact?.value || null,
            city: row?.city || null,
          };
        });
      },
      keepUnusedDataFor: 30,
    }),

    // ---------- REGISTRY LOOKUP ----------
    lookupRegistry: build.query({
      query: ({ country = 'PL', kind = 'nip', value, forceRefresh = false } = {}) => ({
        url: `/registry/lookup${toQuery({ country, kind, value, forceRefresh: forceRefresh ? 'true' : undefined })}`,
        method: 'GET',
      }),
      keepUnusedDataFor: 30,
    }),

    // ---------- DETAIL ----------
    getCounterparty: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/counterparties/${id}`,
        method: 'GET',
      }),
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Counterparty', id }],
      keepUnusedDataFor: 120,
    }),

    // ---------- CREATE ----------
    createCounterparty: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (body) => ({
        url: '/counterparties',
        method: 'POST',
        body: stripCompanyId(body),
      }),
            // onQueryStarted: запускает побочные эффекты жизненного цикла запроса.
async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        const patches = [];
        const safeArg = stripCompanyId(arg);
        const safePayload = safeArg && typeof safeArg === 'object' ? safeArg : {};

        // оптимистично добавим "в начало" во все видимые кэши списков
        forEachListCache(getState, (originalArgs) => {
          patches.push(
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                if (!draft) return;
                const newItem = { ...safePayload, id: safePayload.id || 'tmp-' + Date.now() };
                draft.items = [newItem, ...(draft.items || [])];
                draft.total = (draft.total || 0) + 1;
              })
            )
          );
        });

        try {
          const { data } = await queryFulfilled;
          if (data?.id) {
            // заменим временный на серверный
            forEachListCache(getState, (originalArgs) => {
              dispatch(
                counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                  if (!draft?.items) return;
                  const idx = draft.items.findIndex(
                    (x) => String(x.id) === String(data.id) || String(x.id).startsWith('tmp-')
                  );
                  if (idx >= 0) draft.items[idx] = data;
                })
              );
            });
          }
        } catch {
          patches.forEach((p) => p.undo?.());
        }
      },
      // SSE всё равно инвалидирует LIST, но оставим на всякий
      invalidatesTags: [{ type: 'Counterparty', id: 'LIST' }],
    }),

    // ---------- UPDATE (PUT/PATCH) ----------
    updateCounterparty: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, body, method = 'PUT' }) => ({
        url: `/counterparties/${id}`,
        method,
        body: stripCompanyId(body),
      }),
            // onQueryStarted: запускает побочные эффекты жизненного цикла запроса.
async onQueryStarted({ id, body }, { dispatch, queryFulfilled, getState }) {
        const undoers = [];
        const safeBody = stripCompanyId(body);
        const safePayload = safeBody && typeof safeBody === 'object' ? safeBody : {};

        // оптимистично апдейтим деталь
        undoers.push(
          dispatch(
            counterpartyApi.util.updateQueryData('getCounterparty', id, (draft) => {
              if (!draft) return;
              Object.assign(draft, safePayload);
            })
          )
        );

        // и все видимые кэши списков
        forEachListCache(getState, (originalArgs) => {
          undoers.push(
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                const idx = draft?.items?.findIndex((x) => String(x.id) === String(id));
                if (idx >= 0) draft.items[idx] = { ...draft.items[idx], ...safePayload };
              })
            )
          );
        });

        try {
          const { data } = await queryFulfilled;
          // после ответа — проставим точные данные
          forEachListCache(getState, (originalArgs) => {
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                const idx = draft?.items?.findIndex((x) => String(x.id) === String(id));
                if (idx >= 0) draft.items[idx] = data ?? { ...draft.items[idx], ...safePayload };
              })
            );
          });
        } catch {
          undoers.forEach((p) => p.undo?.());
        }
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'Counterparty', id },
        { type: 'Counterparty', id: 'LIST' },
        { type: 'EntityTimeline', id: `counterparty:${id}` },
        { type: 'Department', id: 'SCOPE_READINESS' },
      ],
    }),

    // ---------- DELETE ----------
    removeCounterparty: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/counterparties/${id}`,
        method: 'DELETE',
      }),
            // onQueryStarted: запускает побочные эффекты жизненного цикла запроса.
async onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const patches = [];

        forEachListCache(getState, (originalArgs) => {
          patches.push(
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                const arr = draft?.items || [];
                draft.items = arr.filter((x) => String(x.id) !== String(id));
                draft.total = Math.max(0, (draft.total || 0) - 1);
              })
            )
          );
        });

        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo?.());
        }
      },
      invalidatesTags: [{ type: 'Counterparty', id: 'LIST' }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListCounterpartiesQuery,
  useGetCounterpartyLookupQuery,
  useLazyLookupRegistryQuery,
  useGetCounterpartyQuery,
  useCreateCounterpartyMutation,
  useUpdateCounterpartyMutation,
  useRemoveCounterpartyMutation,
} = counterpartyApi;
