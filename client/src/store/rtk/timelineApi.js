import { crmApi } from "./crmApi";

const toQuery = (params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return "";
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`;
};

export const timelineApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listEntityTimeline: build.query({
      query: ({ entityType, entityId, category, type, cursor, limit = 25 } = {}) => ({
        url: `/timeline${toQuery({ entityType, entityId, category, type, cursor, limit })}`,
        method: "GET",
      }),
      transformResponse: (response) => response?.data || { items: [], nextCursor: null },
      providesTags: (_result, _error, args = {}) => [
        { type: "EntityTimeline", id: `${args.entityType}:${args.entityId}` },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListEntityTimelineQuery,
} = timelineApi;
