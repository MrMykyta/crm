# ARCHITECTURE QUICKMAP

## 1) TL;DR
1. Точка входа backend: [`server/index.js`](../index.js), сборка приложения: [`server/app.js`](../app.js).
2. API монтируется в `app.js`: `app.use('/api', rootRouter)` + `mountAll(app, '/api')`.
3. HTTP-модуль чата монтируется через registry как `/api/chat` (не через `rootRouter`).
4. Smoke-проверки: [`server/scripts/smoke.js`](../scripts/smoke.js), запуск `cd server && npm run smoke`.
5. Критичные контракты: формат auth/validation ошибок и legacy payload у chat reactions/markRead.

## 2) Карта репозитория (ключевые папки)
- Сервер: [`server/`](../)
  - [`server/src/routes`](../src/routes)
  - [`server/src/controllers`](../src/controllers)
  - [`server/src/services`](../src/services)
  - [`server/src/middleware`](../src/middleware)
  - [`server/src/socket`](../src/socket)
  - [`server/src/system`](../src/system), [`server/src/wms`](../src/wms)
- Chat UI клиента: [`client/src/pages/Chat`](../../client/src/pages/Chat)

### Дерево каталогов (depth 3): `server/src`
```txt
server/src
server/src/acl
server/src/config
server/src/constants
server/src/controllers
server/src/controllers/crm
server/src/controllers/oms
server/src/controllers/pim
server/src/controllers/system
server/src/controllers/system/chat
server/src/controllers/wms
server/src/db
server/src/errors
server/src/http
server/src/http/auth
server/src/http/company
server/src/http/contacts
server/src/http/counterparty
server/src/http/deals
server/src/http/departments
server/src/http/tasks
server/src/http/user
server/src/http/userCompany
server/src/lib
server/src/middleware
server/src/migrations
server/src/models
server/src/models/crm
server/src/models/oms
server/src/models/pim
server/src/models/system
server/src/models/wms
server/src/modules
server/src/mongoModels
server/src/mongoModels/chat
server/src/mongoModels/events
server/src/routes
server/src/routes/crm
server/src/routes/oms
server/src/routes/pim
server/src/routes/system
server/src/routes/system/chat
server/src/routes/wms
server/src/schemas
server/src/seeders
server/src/services
server/src/services/crm
server/src/services/oms
server/src/services/pim
server/src/services/system
server/src/services/system/chat
server/src/services/wms
server/src/socket
server/src/system
server/src/system/auth
server/src/system/auth/schemas
server/src/system/chat
server/src/system/chat/schemas
server/src/utils
server/src/wms
server/src/wms/schemas
```

### Дерево каталогов (depth 3): `client/src/pages/Chat`
```txt
client/src/pages/Chat
client/src/pages/Chat/ChatCreateDirect
client/src/pages/Chat/ChatInput
client/src/pages/Chat/ChatSidebar
client/src/pages/Chat/ChatWindow
client/src/pages/Chat/components
client/src/pages/Chat/components/ChatAttachment
client/src/pages/Chat/components/ChatHeader
client/src/pages/Chat/components/ChatMessages
client/src/pages/Chat/components/ChatSearchBar
client/src/pages/Chat/components/ForwardDialog
client/src/pages/Chat/components/MessageContextMenu
client/src/pages/Chat/hooks
client/src/pages/Chat/utils
```

## 3) Точки входа сервера
- HTTP server/bootstrap: [`server/index.js`](../index.js)
  - `http.createServer(app)`
  - инициализация сокетов через `initSocket(server)`
- Сборка Express-приложения: [`server/app.js`](../app.js)
  - security middleware, parsers, routes, errorHandler
  - `/health`, `/api/health`
  - монтирование `/api` + module registry

## 4) Request pipeline (текущий порядок)
1. `requestContext` (requestId/лог-контекст): [`server/src/middleware/requestContext.js`](../src/middleware/requestContext.js)
2. security/misc (`helmet`, `compression`, rate-limit, `cors`): [`server/app.js`](../app.js)
3. body parsers (`express.json`, `express.urlencoded`)
4. routes (`/api` rootRouter + module registry)
5. глобальный `errorHandler` последним: [`server/src/middleware/errorHandler.js`](../src/middleware/errorHandler.js)

Где формируется auth-контекст:
- [`server/src/middleware/auth.js`](../src/middleware/auth.js)
  - выставляет `req.companyId`
  - выставляет `req.user = { id, role, permissions, membership, companyId }`

Где guard по `companyId`:
- [`server/src/middleware/companyIdGuard.js`](../src/middleware/companyIdGuard.js)
  - запрещает явный `companyId` в `body/query/params`.

## 5) Контракты ошибок/ответов
- Response helper: [`server/src/http/response.js`](../src/http/response.js)
  - `ok(res, data) -> { data }`
  - `created(res, data) -> { data }`
  - `noContent(res) -> 204`
  - `fail(res, status, message, details?, code?) -> { message, code?, details? }`
- Глобальный формат ошибок: [`server/src/middleware/errorHandler.js`](../src/middleware/errorHandler.js)
  - нормализованный output: `{ message, code?, details? }`
  - в production без stack.
- Базовый класс ошибки: [`server/src/errors/AppError.js`](../src/errors/AppError.js)
- Compatibility-слой (deprecated): [`server/src/errors/ApplicationError.js`](../src/errors/ApplicationError.js)

## 6) Routing map
Root API router: [`server/src/routes/rootRouter.js`](../src/routes/rootRouter.js)

Основные домены под `/api`:
- `/auth` -> `system/authRouter`
- `/users`, `/companies`, `/members`, `/departments`, `/counterparties`, `/contact*`, `/deals`, `/tasks`, `/notes`
- `/warehouses`, `/locations`, `/inventory-*`, `/receipts`, `/transfers`, `/shipments`, `/adjustments`, `/cycle-counts`
- `/products`, `/brands`, `/categories`, `/attributes`, `/channels`, `/price-lists`, и т.д.
- `/files`, `/public-files`, `/notifications`, `/acl`, `/system`

Монтирование чата:
- регистрация модуля: [`server/src/modules/systemChatModule.js`](../src/modules/systemChatModule.js)
- registry: [`server/src/lib/moduleRegistry.js`](../src/lib/moduleRegistry.js)
- итоговый префикс: `/api/chat/*`

Критичные маршруты (не ломать):
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/warehouses`
- `GET /api/chat/rooms`
- `POST /api/chat/rooms/:roomId/messages`
- `GET /api/health`

## 7) Smoke tests
- Скрипт: [`server/scripts/smoke.js`](../scripts/smoke.js)
- Проверяет:
  - `GET /api/health -> 200`
  - `POST /api/auth/login` с пустым body -> `400`
  - `POST /api/auth/refresh` с пустым body -> `400`
  - `GET /api/warehouses` без токена -> `401`
  - `GET /api/chat/rooms` без токена -> `401`
- Зачем: проверяет роутинг, auth middleware, валидацию и формат ошибок.
- Как расширять: добавлять записи в `checks` вида `{ method, path, expectedStatus, body?, expectData?, expectMessage? }`.

## 8) Карта chat module (server)
HTTP flow:
1. Router: [`server/src/routes/system/chat/index.js`](../src/routes/system/chat/index.js)
2. Controller: [`server/src/controllers/system/chat/Chat.controller.js`](../src/controllers/system/chat/Chat.controller.js)
3. Service adapter: [`server/src/services/system/chat/chatModuleService.js`](../src/services/system/chat/chatModuleService.js)
4. Legacy service (Mongo/business): [`server/src/services/system/chat/chatService.js`](../src/services/system/chat/chatService.js)

Socket flow:
- socket init: [`server/src/socket/index.js`](../src/socket/index.js)
- chat handlers: [`server/src/socket/chatSocket.js`](../src/socket/chatSocket.js)
- emit helper: [`server/src/socket/chatEmitter.js`](../src/socket/chatEmitter.js)

Chat endpoints (монтируются как `/api/chat`):
- `GET /rooms`
- `POST /direct`
- `POST /group`
- `GET /rooms/:roomId/messages`
- `POST /rooms/:roomId/messages`
- `PATCH /rooms/:roomId/messages/:messageId`
- `DELETE /rooms/:roomId/messages/:messageId`
- `GET /rooms/:roomId/pins`
- `POST /rooms/:roomId/read`
- `POST /rooms/:roomId/pin/:messageId`
- `POST /rooms/:roomId/unpin/:messageId`
- `GET /messages/:messageId/reactions`
- `POST /messages/:messageId/reactions`
- `DELETE /messages/:messageId/reactions/:emoji`
- `PATCH /rooms/:roomId`

Legacy payload (осознанно сохранены для фронтового контракта):
- `GET /messages/:messageId/reactions` -> `{ reactions }`
- `POST /messages/:messageId/reactions` -> legacy `payload`
- `DELETE /messages/:messageId/reactions/:emoji` -> legacy `payload`
- `POST /rooms/:roomId/read` -> legacy `result`

## 9) Карта Chat UI (client)
- Контейнер/оркестрация чата: [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)
- Контекстное меню (absolute в chat container): [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
- Калькулятор позиционирования (clamp/overflow): [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
- Linkify util (безопасно, без `dangerouslySetInnerHTML`): [`client/src/utils/linkifyMessage.js`](../../client/src/utils/linkifyMessage.js)
- Рендер текста сообщений: [`client/src/pages/Chat/components/ChatMessages/index.js`](../../client/src/pages/Chat/components/ChatMessages/index.js)
- Стили ссылок/меню/реакций: [`client/src/pages/Chat/ChatPage.module.css`](../../client/src/pages/Chat/ChatPage.module.css)

## 10) Где править что
| Задача | Файл(ы) |
|---|---|
| Проблемы JWT/auth | `server/src/middleware/auth.js`, `server/src/utils/tokenService.js` |
| Проблемы company scope/context | `server/src/middleware/companyIdGuard.js`, `server/src/middleware/auth.js` |
| Формат API ошибок | `server/src/middleware/errorHandler.js`, `server/src/errors/AppError.js`, `server/src/http/response.js` |
| Ошибки валидации | `server/src/middleware/validate.js` + Joi схемы в `server/src/system/**/schemas`, `server/src/wms/schemas` |
| Проблемы монтирования роутов | `server/app.js`, `server/src/routes/rootRouter.js`, `server/src/lib/moduleRegistry.js` |
| Поведение chat HTTP | `server/src/routes/system/chat/index.js`, `server/src/controllers/system/chat/Chat.controller.js`, `server/src/services/system/chat/*` |
| Проблемы chat socket | `server/src/socket/index.js`, `server/src/socket/chatSocket.js`, `server/src/socket/chatEmitter.js` |
| Меню вылезает за chat window | `client/src/pages/Chat/utils/calcFloatingPosition.js`, `client/src/pages/Chat/components/MessageContextMenu/index.js`, `client/src/pages/Chat/ChatWindow/index.js` |
| Ссылки не кликаются/небезопасны | `client/src/utils/linkifyMessage.js`, `client/src/pages/Chat/components/ChatMessages/index.js`, `client/src/pages/Chat/ChatPage.module.css` |
