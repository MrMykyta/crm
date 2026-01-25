# Спецификация чата (Telegram‑style + floating window)

## Обзор
Внутренний чат для сотрудников одной компании (multi‑tenant). Источник данных — MongoDB (rooms/messages) + Socket.io для realtime. Доступ только через `req.user.companyId`, без передачи `companyId` в query/body/params.

Цели:
- Telegram‑style UX: reply, forward, pin, read receipts, typing.
- Два режима UI: full page `/main/chat` и мини‑окно (floating) поверх `/main/*`.
- Единый источник данных (store + socket) для page и window.

Не входит в scope (на этом шаге): интеграция внешних мессенджеров, видео/звонки, end‑to‑end шифрование.

---

## Типы чатов
- **direct**: 1:1 чат между двумя участниками.
- **group**: группа с ролью `admin`/`member`.
  - Создатель — `admin` (owner). Расширенный owner‑флаг можно трактовать логически, не добавляя новое поле.

---

## Модель данных (на базе текущих Mongo моделей)

### ChatRoom (`chat_rooms`)
- `companyId` (обязателен)
- `type`: `direct` | `group`
- `participants[]`: `{ userId, role, lastReadMessageId, lastReadAt, mutedUntil, hiddenAt }`
- `title`, `avatarUrl`
- `lastMessageAt`, `lastMessagePreview`
- `lastPinnedMessageId`, `lastPinnedAt`
- `createdBy`, `isArchived`, `isDeleted`

### ChatMessage (`chat_messages`)
- `roomId`, `companyId`, `authorId`
- `text`, `attachments[]`
- `replyToMessageId`
- `forward` + `forwardBatchId/Seq`
- `editedAt`, `editedBy`, `deletedAt`, `deletedBy`
- `isSystem`, `meta`
- `isPinned`, `pinnedAt`, `pinnedBy`

Дополнений к модели минимально: использовать `editedAt/editedBy`, `deletedAt/deletedBy` для edit/delete, `participants.hiddenAt` для скрытия direct‑чата, `isArchived` для archive (опционально `archivedAt/archivedBy`).

---

## Права доступа и scope

Базовое правило: **любой доступ требует membership в комнате** + `companyId` из `req.user`.

Политика по ролям:
- **Direct**: оба участника могут писать, отвечать, пересылать, редактировать/удалять свои сообщения, пинить/откреплять.
- **Group**:
  - `admin`/owner: add/remove участников, rename/cover, pin/unpin, delete any message, archive/unarchive.
  - `member`: send/reply/forward, edit/delete только свои сообщения.

Безусловно запрещено:
- использовать `companyId` из body/query/params;
- операции с комнатами/сообщениями без проверки membership.

---

## Фичи сообщений (Telegram‑style)

### Reply
- `replyToMessageId` на сообщение в той же комнате.
- UI превью (author + snippet), клик — jump к сообщению.
- Если оригинал удалён — показывать placeholder.

### Forward
- Одно поле ввода для batch‑forward.
- `forward` хранит snapshot: originalAuthorId, textSnippet, originalMessageId.
- Источник forward должен принадлежать компании; допускается пересылка между комнатами внутри компании.

### Pin
- Права на pin/unpin определены в MVP‑политике.
- В комнате хранится `lastPinnedMessageId` + доступен список pinned.
- UI pinned‑bar показывает последний pin + переход к сообщению.

### Edit/Delete/Archive/Pin (MVP policy)
- **Edit**: только автор, окно 15 минут; поля `editedAt`, `editedBy`; редактируем только `text`.
- **Delete**: soft delete; поля `deletedAt`, `deletedBy`; UI показывает “Сообщение удалено”.
- **Delete permissions**: автор может удалить своё; `admin`/owner может удалить любое в группе.
- **Direct**: “удалить чат” = hide для пользователя (`participants.hiddenAt`); при новом сообщении `hiddenAt` сбрасывается.
- **Group**: hard delete запрещён; archive = `isArchived=true` (status=`archived` логически); archived‑чат доступен только на чтение; `admin`/owner может archive/unarchive.
- **Pin/unpin permissions**: direct — оба участника; group — только `admin`/owner.

---

## API + Socket (целевая спецификация)

### REST (существующее)
- `GET /api/chat/rooms`
- `POST /api/chat/direct`
- `POST /api/chat/group`
- `GET /api/chat/rooms/:roomId/messages?before&limit`
- `GET /api/chat/rooms/:roomId/pins`
- `POST /api/chat/rooms/:roomId/messages`
- `POST /api/chat/rooms/:roomId/read`
- `POST /api/chat/rooms/:roomId/pin/:messageId`
- `POST /api/chat/rooms/:roomId/unpin/:messageId`

### REST (добавить минимум)
- `PATCH /api/chat/rooms/:roomId/messages/:messageId` — edit
- `DELETE /api/chat/rooms/:roomId/messages/:messageId` — delete (soft)
- `PATCH /api/chat/rooms/:roomId` — rename/group meta
- `POST /api/chat/rooms/:roomId/participants` — add
- `DELETE /api/chat/rooms/:roomId/participants/:userId` — remove

### Socket (существующее)
- `chat:join`, `chat:leave`
- `chat:send`, `chat:pin`, `chat:unpin`
- `chat:typing`, `chat:read`
- server events: `chat:message:new`, `chat:message:pinned`, `chat:message:unpinned`, `chat:message:read`, `chat:system:deleted`

### Socket (добавить минимум)
- `chat:message:edited`
- `chat:message:deleted`
- `chat:room:updated` (rename/add/remove)

---

## UI / UX

### 1) Page Chat (`/main/chat`)
- Левая колонка: список комнат, поиск, кнопки create direct/group.
- Правая колонка: окно чата (header, search, pinned‑bar, messages list, input).
- Состояния: loading/empty/error/no room selected.

### 2) Mini Chat Window (floating)
- Доступна поверх всех страниц `/main/*`.
- Открытие: кнопка в topbar/side bar (иконка чата).
- Режимы:
  - **Collapsed**: иконка + badge unread.
  - **Expanded**: мини‑окно с текущим чатом и input.
- Поведение:
  - сохраняет активную комнату и позицию скролла;
  - не меняет роутинг, не вызывает повторную загрузку данных;
  - использует те же hooks/selectors, что и page режим.

### Общие UX требования
- Одни и те же компоненты для page и window (`ChatWindow`, `ChatMessages`, `ChatInput`).
- Reply/forward/pin доступны в обоих режимах.
- Read receipts и typing обновляются в realtime.

---

## Store / State
- Single source: Redux `chatSlice` + RTK Query `chatApi` + socket events.
- `activeRoomId` общий для page и window.
- Вынести UI‑state мини‑окна в store (open/collapsed/position).
- Пин‑бар должен уметь показывать pinned сообщения даже если они не загружены в текущем окне истории (использовать `GET /pins`).

---

## Безопасность
- Membership check на всех REST и socket entrypoints.
- Проверка компании у всех `participantIds` при создании/изменении комнат.
- Запрет `isSystem` сообщений от клиента; системные сообщения создаёт только сервер.

---

## Индексы и производительность
- Для сообщений: индекс `{ companyId, roomId, createdAt }` (ускоряет `before` пагинацию).
- Для pinned: `{ companyId, roomId, isPinned, pinnedAt }`.
- Для комнат: `{ companyId, "participants.userId", lastMessageAt }`.
- Пагинация сообщений: limit 50, infinite scroll вверх.

---

## Acceptance criteria
- Page и window режим используют один store и один сокет.
- Никаких запросов без `req.user.companyId` (companyId не в query/body).
- Любая операция с room/message требует membership.
- Reply/Forward/Pin доступны и синхронизируются между page/window.
- Пин‑бар работает даже для старых сообщений.

---

## Что уже есть vs что нужно сделать

### Уже есть
- Модели Mongo, reply/forward/pin поля.
- REST + socket базовых операций.
- Page chat `/main/chat`.
- UI reply/forward/pin/typing.

### Нужно сделать
- Membership checks + роли (admin/member).
- Edit/Delete политики + события.
- Пин‑бар на основе `GET /pins`.
- Мини‑оконный режим.
- i18n для UI строк.

---

## План работ (этапы)

**P0 Security fixes**
- Membership check на REST/socket.
- Валидация участников при создании комнаты.
- Блокировка client‑side `isSystem`.

**P1 Page chat**
- Edit/Delete + роли.
- Pinned list from API.
- i18n.

**P2 Mini window**
- Floating UI с сохранением состояния.

**P3 Polishing**
- Reply/forward UX, системные сообщения, performance.
