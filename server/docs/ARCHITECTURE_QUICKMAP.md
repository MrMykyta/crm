# ARCHITECTURE QUICKMAP

## 1) TL;DR
1. Backend entrypoint: [`server/index.js`](../index.js), app assembly: [`server/app.js`](../app.js).
2. API mounts in `app.js`: `app.use('/api', rootRouter)` + `mountAll(app, '/api')`.
3. Chat HTTP module mounts via registry as `/api/chat` (not via `rootRouter`).
4. Smoke checks: [`server/scripts/smoke.js`](../scripts/smoke.js), run `cd server && npm run smoke`.
5. Main non-break contracts: auth+validation error format, chat legacy payloads for reactions/markRead.

## 2) Repository Map (key folders)
- Server: [`server/`](../)
  - [`server/src/routes`](../src/routes)
  - [`server/src/controllers`](../src/controllers)
  - [`server/src/services`](../src/services)
  - [`server/src/middleware`](../src/middleware)
  - [`server/src/socket`](../src/socket)
  - [`server/src/system`](../src/system), [`server/src/wms`](../src/wms)
- Client chat UI: [`client/src/pages/Chat`](../../client/src/pages/Chat)

### Directory tree (depth 3): `server/src`
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

### Directory tree (depth 3): `client/src/pages/Chat`
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

## 3) Server Entrypoints
- HTTP server/bootstrap: [`server/index.js`](../index.js)
  - `http.createServer(app)`
  - socket init via `initSocket(server)`
- Express app composition: [`server/app.js`](../app.js)
  - security middleware, parsers, routes, errorHandler
  - `/health`, `/api/health`
  - `/api` root mount + module registry mount

## 4) Request Pipeline (current order)
1. `requestContext` (requestId/log context): [`server/src/middleware/requestContext.js`](../src/middleware/requestContext.js)
2. security/misc (`helmet`, `compression`, rate-limit, `cors`): [`server/app.js`](../app.js)
3. body parsers (`express.json`, `express.urlencoded`)
4. routes (`/api` rootRouter + module registry)
5. global `errorHandler` last: [`server/src/middleware/errorHandler.js`](../src/middleware/errorHandler.js)

Where auth context is built:
- [`server/src/middleware/auth.js`](../src/middleware/auth.js)
  - sets `req.companyId`
  - sets `req.user = { id, role, permissions, membership, companyId }`

Where `companyId` is guarded:
- [`server/src/middleware/companyIdGuard.js`](../src/middleware/companyIdGuard.js)
  - rejects explicit `companyId` in `body/query/params`.

## 5) Error/Response Contracts
- Response helper: [`server/src/http/response.js`](../src/http/response.js)
  - `ok(res, data) -> { data }`
  - `created(res, data) -> { data }`
  - `noContent(res) -> 204`
  - `fail(res, status, message, details?, code?) -> { message, code?, details? }`
- Global error JSON: [`server/src/middleware/errorHandler.js`](../src/middleware/errorHandler.js)
  - normalized output: `{ message, code?, details? }`
  - no stack in production.
- Base error class: [`server/src/errors/AppError.js`](../src/errors/AppError.js)
- Compatibility layer (deprecated): [`server/src/errors/ApplicationError.js`](../src/errors/ApplicationError.js)

## 6) Routing Map
Root API router: [`server/src/routes/rootRouter.js`](../src/routes/rootRouter.js)

Main domains mounted under `/api`:
- `/auth` -> `system/authRouter`
- `/users`, `/companies`, `/members`, `/departments`, `/counterparties`, `/contact*`, `/deals`, `/tasks`, `/notes`
- `/warehouses`, `/locations`, `/inventory-*`, `/receipts`, `/transfers`, `/shipments`, `/adjustments`, `/cycle-counts`
- `/products`, `/brands`, `/categories`, `/attributes`, `/channels`, `/price-lists`, etc.
- `/files`, `/public-files`, `/notifications`, `/acl`, `/system`

Chat mount:
- module registration: [`server/src/modules/systemChatModule.js`](../src/modules/systemChatModule.js)
- registry: [`server/src/lib/moduleRegistry.js`](../src/lib/moduleRegistry.js)
- final URL prefix: `/api/chat/*`

Critical routes (do not break):
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/warehouses`
- `GET /api/chat/rooms`
- `POST /api/chat/rooms/:roomId/messages`
- `GET /api/health`

## 7) Smoke Tests
- Script: [`server/scripts/smoke.js`](../scripts/smoke.js)
- Checks:
  - `GET /api/health -> 200`
  - `POST /api/auth/login` empty body -> `400`
  - `POST /api/auth/refresh` empty body -> `400`
  - `GET /api/warehouses` no token -> `401`
  - `GET /api/chat/rooms` no token -> `401`
- Why useful: validates route wiring, auth middleware, validation, error format.
- Extend pattern: add `{ method, path, expectedStatus, body?, expectData?, expectMessage? }` in `checks`.

## 8) Chat Module Map (server)
HTTP flow:
1. Router: [`server/src/routes/system/chat/index.js`](../src/routes/system/chat/index.js)
2. Controller: [`server/src/controllers/system/chat/Chat.controller.js`](../src/controllers/system/chat/Chat.controller.js)
3. Service adapter: [`server/src/services/system/chat/chatModuleService.js`](../src/services/system/chat/chatModuleService.js)
4. Legacy service (Mongo/business): [`server/src/services/system/chat/chatService.js`](../src/services/system/chat/chatService.js)

Socket flow:
- socket init: [`server/src/socket/index.js`](../src/socket/index.js)
- chat handlers: [`server/src/socket/chatSocket.js`](../src/socket/chatSocket.js)
- emit helper: [`server/src/socket/chatEmitter.js`](../src/socket/chatEmitter.js)

Chat endpoints (mounted as `/api/chat`):
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

Legacy payloads intentionally preserved (frontend contract):
- `GET /messages/:messageId/reactions` -> `{ reactions }`
- `POST /messages/:messageId/reactions` -> legacy `payload`
- `DELETE /messages/:messageId/reactions/:emoji` -> legacy `payload`
- `POST /rooms/:roomId/read` -> legacy `result`

## 9) Chat UI Map (client)
- Chat container/orchestration: [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)
- Context menu (absolute in chat container): [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
- Position calculator (clamp/overflow rules): [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
- Linkify util (safe, no `dangerouslySetInnerHTML`): [`client/src/utils/linkifyMessage.js`](../../client/src/utils/linkifyMessage.js)
- Message text renderer: [`client/src/pages/Chat/components/ChatMessages/index.js`](../../client/src/pages/Chat/components/ChatMessages/index.js)
- CSS for links/menu/reactions: [`client/src/pages/Chat/ChatPage.module.css`](../../client/src/pages/Chat/ChatPage.module.css)

## 10) Where To Change What
| Task | File(s) |
|---|---|
| JWT/auth issues | `server/src/middleware/auth.js`, `server/src/utils/tokenService.js` |
| company scope/context issues | `server/src/middleware/companyIdGuard.js`, `server/src/middleware/auth.js` |
| API error format | `server/src/middleware/errorHandler.js`, `server/src/errors/AppError.js`, `server/src/http/response.js` |
| Validation errors | `server/src/middleware/validate.js` + Joi schemas in `server/src/system/**/schemas`, `server/src/wms/schemas` |
| Router mount problems | `server/app.js`, `server/src/routes/rootRouter.js`, `server/src/lib/moduleRegistry.js` |
| Chat HTTP behavior | `server/src/routes/system/chat/index.js`, `server/src/controllers/system/chat/Chat.controller.js`, `server/src/services/system/chat/*` |
| Socket chat problems | `server/src/socket/index.js`, `server/src/socket/chatSocket.js`, `server/src/socket/chatEmitter.js` |
| Menu goes out of chat window | `client/src/pages/Chat/utils/calcFloatingPosition.js`, `client/src/pages/Chat/components/MessageContextMenu/index.js`, `client/src/pages/Chat/ChatWindow/index.js` |
| Links not clickable/safe | `client/src/utils/linkifyMessage.js`, `client/src/pages/Chat/components/ChatMessages/index.js`, `client/src/pages/Chat/ChatPage.module.css` |

