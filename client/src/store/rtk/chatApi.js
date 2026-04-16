// src/store/rtk/chatApi.js
import { crmApi } from "./crmApi";

export const chatApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    // список комнат
    listRooms: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => "/chat/rooms",
      providesTags: ["ChatRooms"],
    }),

    // найти/создать личный чат
    getOrCreateDirect: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (otherUserId) => ({
        url: "/chat/direct",
        method: "POST",
        body: { otherUserId },
      }),
      invalidatesTags: ["ChatRooms"],
    }),

    // СОЗДАТЬ ГРУППУ
    createGroup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ title, participantIds }) => ({
        url: "/chat/group",
        method: "POST",
        body: { title, participantIds },
      }),
      // после создания группы перезапрашиваем список комнат
      invalidatesTags: ["ChatRooms"],
    }),

    // сообщения комнаты (с поддержкой before + limit)
    getMessages: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, before, limit }) => {
        const params = {};

        if (before) params.before = before;
        if (limit) params.limit = limit;

        return {
          url: `/chat/rooms/${roomId}/messages`,
          params,
        };
      },
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (result, error, arg) => [
        { type: "ChatMessages", id: String(arg.roomId) },
      ],
    }),

    // отправка сообщения (REST, сейчас в основном используем сокет,
    // но пусть останется — может пригодиться)
    sendMessage: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, text, attachments, replyTo, forwardFrom }) => ({
        url: `/chat/rooms/${roomId}/messages`,
        method: "POST",
        body: { text, attachments, replyTo, forwardFrom },
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (r, e, arg) => [
        { type: "ChatMessages", id: String(arg.roomId) },
        "ChatRooms",
      ],
    }),

    // редактирование сообщения
    editMessage: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, messageId, text }) => ({
        url: `/chat/rooms/${roomId}/messages/${messageId}`,
        method: "PATCH",
        body: { text },
      }),
    }),

    deleteMessage: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, messageId }) => ({
        url: `/chat/rooms/${roomId}/messages/${messageId}`,
        method: "DELETE",
      }),
    }),

    // отметка прочитанным
    markRead: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, messageId }) => ({
        url: `/chat/rooms/${roomId}/read`,
        method: "POST",
        body: { messageId },
      }),
    }),

    // реакция на сообщение (toggle add/remove)
    toggleMessageReaction: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ messageId, emoji }) => ({
        url: `/chat/messages/${messageId}/reactions`,
        method: "POST",
        body: { emoji },
      }),
    }),

    // удалить реакцию (idempotent)
    removeMessageReaction: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ messageId, emoji }) => ({
        url: `/chat/messages/${messageId}/reactions/${encodeURIComponent(
          emoji || ""
        )}`,
        method: "DELETE",
      }),
    }),

    // получить реакции для сообщения
    getMessageReactions: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ messageId }) => `/chat/messages/${messageId}/reactions`,
    }),

    // список закреплённых сообщений комнаты
    getPinned: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId }) => `/chat/rooms/${roomId}/pins`,
    }),

    pinMessage: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, messageId }) => ({
        url: `/chat/rooms/${roomId}/pin/${messageId}`,
        method: "POST",
      }),
    }),

    unpinMessage: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, messageId }) => ({
        url: `/chat/rooms/${roomId}/unpin/${messageId}`,
        method: "POST",
      }),
    }),

    updateRoom: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ roomId, patch }) => ({
        url: `/chat/rooms/${roomId}`,
        method: "PATCH",
        body: patch || {},
      }),
      invalidatesTags: ["ChatRooms"],
    }),
  }),
});

// ⬇️ добавил useLazyGetMessagesQuery
export const {
  useListRoomsQuery,
  useGetOrCreateDirectMutation,
  useCreateGroupMutation,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useMarkReadMutation,
  useToggleMessageReactionMutation,
  useRemoveMessageReactionMutation,
  useGetMessageReactionsQuery,
  useGetPinnedQuery,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useUpdateRoomMutation,
} = chatApi;

