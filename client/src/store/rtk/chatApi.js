// src/store/rtk/chatApi.js
import { crmApi } from './crmApi';

export const chatApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    // список комнат
    listRooms: build.query({
      query: () => '/chat/rooms',
      providesTags: ['ChatRooms'],
    }),

    // найти/создать личный чат
    getOrCreateDirect: build.mutation({
      query: (otherUserId) => ({
        url: '/chat/direct',
        method: 'POST',
        body: { otherUserId },
      }),
      invalidatesTags: ['ChatRooms'],
    }),

    // СОЗДАТЬ ГРУППУ
    createGroup: build.mutation({
      query: ({ title, participantIds }) => ({
        url: '/chat/group',
        method: 'POST',
        body: { title, participantIds },
      }),
      // после создания группы перезапрашиваем список комнат
      invalidatesTags: ['ChatRooms'],
    }),

    // сообщения комнаты
    getMessages: build.query({
      query: ({ roomId, before }) => ({
        url: `/chat/rooms/${roomId}/messages`,
        params: before ? { before } : {},
      }),
      providesTags: (result, error, arg) => [
        { type: 'ChatMessages', id: String(arg.roomId) },
      ],
    }),

    // отправка сообщения (REST, сейчас в основном используем сокет,
    // но пусть останется — может пригодиться)
    sendMessage: build.mutation({
      query: ({ roomId, text, attachments, replyTo }) => ({
        url: `/chat/rooms/${roomId}/messages`,
        method: 'POST',
        body: { text, attachments, replyTo },
      }),
      invalidatesTags: (r, e, arg) => [
        { type: 'ChatMessages', id: String(arg.roomId) },
        'ChatRooms',
      ],
    }),

    // отметка прочитанным
    markRead: build.mutation({
      query: ({ roomId, messageId }) => ({
        url: `/chat/rooms/${roomId}/read`,
        method: 'POST',
        body: { messageId },
      }),
    }),
  }),
});

export const {
  useListRoomsQuery,
  useGetOrCreateDirectMutation,
  useCreateGroupMutation,      // <-- новый хук
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkReadMutation,
} = chatApi;