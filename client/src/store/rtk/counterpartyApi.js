// src/store/rtk/counterpartyApi.js
import { crmApi, getCompanyId } from './crmApi';

const toQuery = (params = {}) => {
  const esc = encodeURIComponent;
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
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
  endpoints: (build) => ({

    // ---------- LIST ----------
    listCounterparties: build.query({
      query: (q = {}) => ({
        url: `/counterparties/${getCompanyId()}${toQuery(q)}`,
        method: 'GET',
      }),
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
      providesTags: (res) => {
        const ids = Array.isArray(res?.items) ? res.items.map((i) => i.id) : [];
        return [{ type: 'Counterparty', id: 'LIST' }, ...ids.map((id) => ({ type: 'Counterparty', id }))];
      },
      keepUnusedDataFor: 60,
    }),

    // ---------- DETAIL ----------
    getCounterparty: build.query({
      query: (id) => ({
        url: `/counterparties/${getCompanyId()}/${id}`,
        method: 'GET',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Counterparty', id }],
      keepUnusedDataFor: 120,
    }),

    // ---------- CREATE ----------
    createCounterparty: build.mutation({
      query: (body) => ({
        url: `/counterparties/${getCompanyId()}`,
        method: 'POST',
        body,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        const patches = [];

        // оптимистично добавим "в начало" во все видимые кэши списков
        forEachListCache(getState, (originalArgs) => {
          patches.push(
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                if (!draft) return;
                const newItem = { ...arg, id: arg.id || 'tmp-' + Date.now() };
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
      query: ({ id, body, method = 'PUT' }) => ({
        url: `/counterparties/${getCompanyId()}/${id}`,
        method,
        body,
      }),
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled, getState }) {
        const undoers = [];

        // оптимистично апдейтим деталь
        undoers.push(
          dispatch(
            counterpartyApi.util.updateQueryData('getCounterparty', id, (draft) => {
              if (!draft) return;
              Object.assign(draft, body);
            })
          )
        );

        // и все видимые кэши списков
        forEachListCache(getState, (originalArgs) => {
          undoers.push(
            dispatch(
              counterpartyApi.util.updateQueryData('listCounterparties', originalArgs, (draft) => {
                const idx = draft?.items?.findIndex((x) => String(x.id) === String(id));
                if (idx >= 0) draft.items[idx] = { ...draft.items[idx], ...body };
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
                if (idx >= 0) draft.items[idx] = data ?? { ...draft.items[idx], ...body };
              })
            );
          });
        } catch {
          undoers.forEach((p) => p.undo?.());
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Counterparty', id },
        { type: 'Counterparty', id: 'LIST' },
      ],
    }),

    // ---------- DELETE ----------
    removeCounterparty: build.mutation({
      query: (id) => ({
        url: `/counterparties/${getCompanyId()}/${id}`,
        method: 'DELETE',
      }),
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
  useGetCounterpartyQuery,
  useCreateCounterpartyMutation,
  useUpdateCounterpartyMutation,
  useRemoveCounterpartyMutation,
} = counterpartyApi;