# Audit чата (Mongo + Socket) — 15.01.2026

## Scope и источники
- `server/src/mongoModels/chat/ChatRoom.js`
- `server/src/mongoModels/chat/ChatMessage.js`
- `server/src/services/system/chat/chatService.js`
- `server/src/controllers/system/chat/Chat.controller.js`
- `server/src/routes/system/chatRouter.js`
- `server/src/socket/chatSocket.js`
- `server/src/socket/index.js`
- `server/src/middleware/auth.js`
- `client/src/store/rtk/chatApi.js`
- `client/src/store/slices/chatSlice.js`
- `client/src/sockets/useChatSocket.js`
- `client/src/pages/Chat/*`
- `client/src/pages/system/MainLayoutPage/index.js`
- `client/src/config/menu.js`, `client/src/App.js`

---

## A) Архитектура (Mongo)

### Коллекции

#### `chat_rooms` (ChatRoom)
Основные поля:
- `companyId` (String, required)
- `type` (`direct` | `group`)
- `participants[]`: `{ userId, role: member|admin, lastReadMessageId, lastReadAt, mutedUntil }`
- `title`, `avatarUrl`
- `lastMessageAt`, `lastMessagePreview`
- `lastPinnedMessageId`, `lastPinnedAt`
- `createdBy`
- `isArchived`, `isDeleted`
- `createdAt`, `updatedAt`

Индексы:
- `{ companyId: 1, updatedAt: -1 }`
- `{ companyId: 1, type: 1, "participants.userId": 1 }` (direct-room lookup)
- `{ companyId: 1, lastPinnedAt: -1 }`

#### `chat_messages` (ChatMessage)
Основные поля:
- `roomId` (ObjectId -> ChatRoom)
- `companyId` (String)
- `authorId` (String)
- `text`
- `attachments[]`: `{ type, url, name, size, mimeType }`
- `replyToMessageId` (ObjectId -> ChatMessage)
- `forward` (Mixed) + `forwardBatchId`, `forwardBatchSeq`
- `editedAt`, `deletedAt`
- `isSystem`, `meta` (systemType/systemPayload)
- `isPinned`, `pinnedAt`, `pinnedBy`
- `createdAt`, `updatedAt`

Индексы:
- `{ roomId: 1, createdAt: -1 }`
- `{ companyId: 1, text: "text" }`
- `{ roomId: 1, isPinned: 1, pinnedAt: -1, createdAt: -1 }`

### Отдельные коллекции
- Отдельных коллекций для receipts/threads/pins нет.
- Read-receipts хранятся в `chat_rooms.participants.lastRead*`.
- Pin state хранится в `chat_messages.isPinned` + `chat_rooms.lastPinned*`.

---

## B) API / Backend

### Auth / company context
- REST: `auth` middleware берёт `companyId` из `payload.cid` и кладёт в `req.user.companyId` (`server/src/middleware/auth.js`).
- Chat routes используют только `auth` (без `companyIdGuard`).
- Socket: `server/src/socket/index.js` валидирует JWT, берёт `payload.cid`, кладёт в `socket.user.companyId`.

### REST endpoints (`server/src/routes/system/chatRouter.js`)
- `GET /api/chat/rooms` — список комнат + `myUnreadCount`.
- `POST /api/chat/direct` — создать/получить direct-чат.
- `POST /api/chat/group` — создать группу.
- `GET /api/chat/rooms/:roomId/messages` — сообщения комнаты (before/limit).
- `GET /api/chat/rooms/:roomId/pins` — список pinned сообщений.
- `POST /api/chat/rooms/:roomId/messages` — отправка сообщения.
- `POST /api/chat/rooms/:roomId/read` — mark-as-read.
- `POST /api/chat/rooms/:roomId/pin/:messageId` — pin.
- `POST /api/chat/rooms/:roomId/unpin/:messageId` — unpin.

### Socket events (`server/src/socket/chatSocket.js`)
**Client -> Server:**
- `chat:join` / `chat:leave`
- `chat:send`
- `chat:pin` / `chat:unpin`
- `chat:typing`
- `chat:read`

**Server -> Client:**
- `chat:message:new`
- `chat:message:read`
- `chat:message:pinned`
- `chat:message:unpinned`
- `chat:system:deleted`
- `chat:typing`

### Реализация (сервис)
- `sendMessage` обновляет `lastMessageAt/Preview` в комнате.
- `pin/unpin` обновляет `chat_messages.isPinned` и `chat_rooms.lastPinned*`, удаляет системные pin-сообщения при unpin.
- `markAsRead` пишет `participants.lastReadMessageId/At`.

---

## C) Security / Tenant isolation

### Что уже нормально
- Все Mongo queries в `chatService` используют `companyId`.
- `chat:join` проверяет membership по `participants.userId`.
- Socket disconnect при отсутствии `userId`/`companyId`.

### Риски и нарушения
**HIGH**
- REST `GET /chat/rooms/:roomId/messages` и `GET /chat/rooms/:roomId/pins` не проверяют membership. Если известен `roomId`, можно читать сообщения чужой комнаты в рамках своей компании.
- REST `POST /chat/rooms/:roomId/messages`, `pin/unpin` не проверяют membership. Можно писать/пинить в чужих комнатах своей компании.
- Socket `chat:send`, `chat:pin`, `chat:unpin`, `chat:typing` не проверяют membership (только `roomId + companyId`). Возможна отправка/пин/typing в чужую комнату своей компании.

**MEDIUM**
- `createGroup`/`getOrCreateDirect` не валидируют, что `participantIds` принадлежат этой компании. Возможны комнаты с «чужими» userId и неконсистентные данные.
- Нет RBAC/permissions на chat endpoints (любой участник может пинить/создавать группу/пересылать system messages).
- `isSystem` сообщения можно отправлять клиентом без ограничений (спуфинг системных событий).

**LOW**
- `replyToMessageId` и `forwardFrom` не валидируются на принадлежность комнате (только `companyId`).
- `markRead` не проверяет, что `messageId` принадлежит комнате.

---

## D) UX / Frontend

### Страницы и роуты
- Страница чата: `/main/chat` (`client/src/pages/Chat/index.js`).
- Пункт меню: `client/src/config/menu.js`.

### Store / State
- RTK Query: `client/src/store/rtk/chatApi.js` (rooms/messages/pin).
- Redux slice: `client/src/store/slices/chatSlice.js` (rooms/messages, drafts, pinned, activeRoomId).
- Socket слушается глобально в `MainLayoutPage` (`useChatSocket(activeRoomId)`), socket инициализируется в `MainLayoutPage` и дублируется в `ChatPage`.

### UX особенности
- Список комнат + поиск (фильтр по локальному списку, без server search).
- Сообщения: пагинация вверх (`before`), day‑группировка.
- Reply/Forward/Pin реализованы в UI.
- Edit/Delete в UI есть, но handlers пустые.
- Pinned bar строится из текущего списка сообщений; endpoint `GET /chat/rooms/:roomId/pins` не используется.
- Read receipts: строятся на сравнении `lastReadMessageId` (сравнение строк ObjectId может быть неточным).
- i18n отсутствует (строки захардкожены на RU).

---

## Что уже есть vs что нужно сделать

### Уже есть
- Модели Mongo: комнаты/сообщения, reply/forward/pin, read receipts.
- REST + socket для базовых операций.
- Страница /main/chat с рабочим UI.
- Forward (single + batch), pin/unpin, typing, read status.

### Нужно сделать
- Membership checks на все REST и socket операции.
- Валидация участников при создании чатов (company membership).
- Политика прав (кто может pin/unpin, кто может add/remove участников).
- Edit/Delete (использовать `editedAt`/`deletedAt`).
- Интеграция pinned list в UI (не только из загруженных сообщений).
- Мини‑оконный режим (floating) и единый источник данных для page/window.

---

## План работ (этапы)

**P0 Security fixes**
- Membership checks на REST и socket.
- Блокировка `isSystem` от клиентов (разрешать только серверу).
- Проверка `participantIds` на принадлежность company.

**P1 Page chat hardening**
- i18n строк.
- Edit/Delete политики + REST/socket события.
- Пин‑бар на основе `GET /pins`.

**P2 Mini window**
- Floating UI поверх `/main/*`, общий store/socket.
- Сохранение активного чата и scroll позиции.

**P3 Reply/Forward/Pin polishing**
- Валидация reply/forward источников.
- Улучшение pinned/forward UX и истории.
