// frontend: src/store/rtk/notificationApi.js
import { crmApi } from "./crmApi";

export const notificationApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listMyNotifications: build.query({
      query: (params = {}) => ({
        url: "/notifications",
        method: "GET",
        params,
      }),
      transformResponse: (resp) => resp?.data || { items: [], unreadCount: 0 },
      providesTags: (result) => {
        const base = [{ type: "Notification", id: "LIST" }];
        if (!result?.items) return base;
        return [
          ...base,
          ...result.items.map((n) => ({ type: "Notification", id: n.id })),
        ];
      },
    }),

    markNotificationRead: build.mutation({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "POST",
      }),
      invalidatesTags: (res, err, id) => [
        { type: "Notification", id },
        { type: "Notification", id: "LIST" },
      ],
    }),

    markAllNotificationsRead: build.mutation({
      query: () => ({
        url: "/notifications/read-all/all",
        method: "POST",
      }),
      invalidatesTags: [{ type: "Notification", id: "LIST" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;
