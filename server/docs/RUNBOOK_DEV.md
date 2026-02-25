# RUNBOOK DEV

## 1) Local Start

### Backend (Express)
```bash
cd server
npm install
npm run dev
```

### Frontend (React)
```bash
cd client
npm install
npm start
```

## 2) Smoke
```bash
cd server
npm run smoke
```

Smoke file: [`server/scripts/smoke.js`](../scripts/smoke.js)

It verifies:
- `/api/health` is reachable
- auth validation on empty login/refresh
- unauthorized protection on warehouses/chat rooms

## 3) Typical Failures

### 401 / 403
Check:
- `Authorization: Bearer <token>`
- token payload has `sub` and `cid`
- auth context in [`server/src/middleware/auth.js`](../src/middleware/auth.js)
- permission check in [`server/src/middleware/requirePermission.js`](../src/middleware/requirePermission.js)

### 400 Validation failed
Check:
- schema used in route (`validate(...)`)
- middleware [`server/src/middleware/validate.js`](../src/middleware/validate.js)
- Joi schema locations:
  - [`server/src/system/auth/schemas`](../src/system/auth/schemas)
  - [`server/src/system/chat/schemas`](../src/system/chat/schemas)
  - [`server/src/wms/schemas`](../src/wms/schemas)

### Socket issues (chat realtime)
Check:
- socket bootstrap [`server/src/socket/index.js`](../src/socket/index.js)
- chat handlers [`server/src/socket/chatSocket.js`](../src/socket/chatSocket.js)
- emitter helper [`server/src/socket/chatEmitter.js`](../src/socket/chatEmitter.js)
- client token in socket handshake (`auth.token` / query / auth header)

### Chat menu/reactions positioning
Check:
- position util [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
- menu component [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
- container wiring [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)

## 4) Mini Command Set

### Syntax check (single file)
```bash
node --check server/app.js
node --check server/src/middleware/errorHandler.js
```

### Fast grep (key architecture points)
```bash
rg -n "companyId|req.user|mountAll" server/src server/app.js
rg -n "registerModule|/chat|rooms/:roomId/messages" server/src
```

### Routing inspection
```bash
rg -n "rootRouter.use\\(" server/src/routes/rootRouter.js
sed -n '1,220p' server/src/routes/system/chat/index.js
```

## 5) Debug Checklist (chat request)
1. Confirm route mounted at `/api/chat` via module registry.
2. Confirm `auth` attached `req.user` + `req.companyId`.
3. Confirm permission middleware for `chat.read`/`chat.write`.
4. Confirm Joi payload accepted by chat schema.
5. Confirm controller keeps expected response shape (legacy where required).

