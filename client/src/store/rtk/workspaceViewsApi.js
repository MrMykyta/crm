import { crmApi } from './crmApi';

// Workspace Views RTK slice (Phase 2). Talks to /api/workspace-views endpoints from
// Phase 1. Tagging uses `WorkspaceViews:LIST:<module>` so per-module surfaces (picker,
// sidebar section) auto-refresh when any mutation touches that module's list.

function tagsForListResult(result, module) {
  const arr = Array.isArray(result?.data) ? result.data : [];
  return [
    { type: 'WorkspaceViews', id: `LIST:${module}` },
    ...arr.filter((v) => v && v.id).map((v) => ({ type: 'WorkspaceViews', id: v.id })),
  ];
}

export const workspaceViewsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listWorkspaceViews: build.query({
      query: ({ module, includeHidden = false } = {}) => ({
        url: '/workspace-views',
        method: 'GET',
        params: {
          module,
          ...(includeHidden ? { includeHidden: 'true' } : {}),
        },
      }),
      providesTags: (result, _err, arg) => tagsForListResult(result, arg?.module),
      keepUnusedDataFor: 60,
    }),

    createWorkspaceView: build.mutation({
      query: (body) => ({
        url: '/workspace-views',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'WorkspaceViews', id: `LIST:${arg?.module}` },
      ],
    }),

    updateWorkspaceView: build.mutation({
      query: ({ id, ...patch }) => ({
        url: `/workspace-views/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (res, _err, arg) => [
        { type: 'WorkspaceViews', id: arg?.id },
        ...(res?.module ? [{ type: 'WorkspaceViews', id: `LIST:${res.module}` }] : []),
      ],
    }),

    deleteWorkspaceView: build.mutation({
      query: ({ id }) => ({
        url: `/workspace-views/${id}`,
        method: 'DELETE',
      }),
      // Delete returns 204 with no body, so we can't read `module` from the response.
      // Callers pass `module` in the arg so we can invalidate the matching LIST tag and
      // any cached page that shows this view (picker/sidebar) refetches.
      invalidatesTags: (_res, _err, arg) => [
        { type: 'WorkspaceViews', id: arg?.id },
        ...(arg?.module ? [{ type: 'WorkspaceViews', id: `LIST:${arg.module}` }] : []),
      ],
    }),

    pinWorkspaceView: build.mutation({
      query: ({ id, pinned, sortOrder }) => ({
        url: `/workspace-views/${id}/actions/pin`,
        method: 'POST',
        body: { pinned, ...(sortOrder !== undefined ? { sortOrder } : {}) },
      }),
      invalidatesTags: (res, _err, arg) => [
        { type: 'WorkspaceViews', id: arg?.id },
        ...(res?.module ? [{ type: 'WorkspaceViews', id: `LIST:${res.module}` }] : []),
      ],
    }),

    hideWorkspaceView: build.mutation({
      query: ({ id, hidden }) => ({
        url: `/workspace-views/${id}/actions/hide`,
        method: 'POST',
        body: { hidden },
      }),
      invalidatesTags: (res, _err, arg) => [
        { type: 'WorkspaceViews', id: arg?.id },
        ...(res?.module ? [{ type: 'WorkspaceViews', id: `LIST:${res.module}` }] : []),
      ],
    }),

    touchWorkspaceView: build.mutation({
      query: ({ id }) => ({
        url: `/workspace-views/${id}/actions/touch`,
        method: 'POST',
        body: {},
      }),
      // touch only updates prefs.lastUsedAt — sort order in the picker depends on it,
      // but invalidating on every click would cause a refetch storm. The picker reads
      // lastUsedAt from cached data, so we deliberately skip invalidation here.
      invalidatesTags: () => [],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListWorkspaceViewsQuery,
  useCreateWorkspaceViewMutation,
  useUpdateWorkspaceViewMutation,
  useDeleteWorkspaceViewMutation,
  usePinWorkspaceViewMutation,
  useHideWorkspaceViewMutation,
  useTouchWorkspaceViewMutation,
} = workspaceViewsApi;
