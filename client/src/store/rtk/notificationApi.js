// frontend: src/store/rtk/notificationApi.js
import { crmApi } from "./crmApi";

export const notificationApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    listMyNotifications: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (params = {}) => ({
        url: "/notifications",
        method: "GET",
        params,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data || { items: [], unreadCount: 0 },
            // providesTags: возвращает теги кэша для автообновления данных.
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
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "POST",
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res, err, id) => [
        { type: "Notification", id },
        { type: "Notification", id: "LIST" },
      ],
    }),

    markAllNotificationsRead: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
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

