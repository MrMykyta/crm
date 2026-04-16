# RUNBOOK DEV

## 1) Локальный запуск

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

Файл smoke: [`server/scripts/smoke.js`](../scripts/smoke.js)

Проверяет:
- доступность `/api/health`
- валидацию auth на пустых login/refresh
- защиту от неавторизованного доступа к warehouses/chat rooms

## 3) Типовые проблемы

### 401 / 403
Проверьте:
- `Authorization: Bearer <token>`
- что в payload токена есть `sub` и `cid`
- auth-контекст в [`server/src/middleware/auth.js`](../src/middleware/auth.js)
- проверку прав в [`server/src/middleware/requirePermission.js`](../src/middleware/requirePermission.js)

### 400 Validation failed
Проверьте:
- какая схема подключена в роуте (`validate(...)`)
- middleware [`server/src/middleware/validate.js`](../src/middleware/validate.js)
- расположение Joi-схем:
  - [`server/src/system/auth/schemas`](../src/system/auth/schemas)
  - [`server/src/system/chat/schemas`](../src/system/chat/schemas)
  - [`server/src/wms/schemas`](../src/wms/schemas)

### Проблемы socket (chat realtime)
Проверьте:
- bootstrap сокетов [`server/src/socket/index.js`](../src/socket/index.js)
- chat handlers [`server/src/socket/chatSocket.js`](../src/socket/chatSocket.js)
- helper для emit [`server/src/socket/chatEmitter.js`](../src/socket/chatEmitter.js)
- token на клиенте в socket handshake (`auth.token` / query / auth header)

### Проблемы позиционирования chat menu/reactions
Проверьте:
- util позиционирования [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
- компонент меню [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
- контейнер и wiring [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)

## 4) Мини-набор команд

### Проверка синтаксиса (один файл)
```bash
node --check server/app.js
node --check server/src/middleware/errorHandler.js
```

### Быстрый grep по архитектурным точкам
```bash
rg -n "companyId|req.user|mountAll" server/src server/app.js
rg -n "registerModule|/chat|rooms/:roomId/messages" server/src
```

### Проверка монтирования роутов
```bash
rg -n "rootRouter.use\\(" server/src/routes/rootRouter.js
sed -n '1,220p' server/src/routes/system/chat/index.js
```

## 5) Debug checklist (chat request)
1. Убедиться, что маршрут смонтирован как `/api/chat` через module registry.
2. Убедиться, что `auth` выставил `req.user` + `req.companyId`.
3. Убедиться, что применён middleware прав `chat.read`/`chat.write`.
4. Убедиться, что payload проходит Joi-схему chat.
5. Убедиться, что контроллер отдаёт ожидаемый формат ответа (legacy там, где требуется).
