# Report: Uploads/Attachments Unification (Audit + Target Architecture)

## Executive summary
- В репозитории существуют **две параллельные системы**: `uploadRouter` (`/api/uploads/*`) и `attachmentRouter` (`/api/attachments/*`). Они не совместимы по правилам, путям хранения и безопасности.
- `/api/uploads` **не защищён auth** и принимает `companyId/uploadedBy` из body/query → высокий риск tenant leak и подмены автора.
- `/uploads/*` отдаётся через **public static** без проверок, что неприемлемо для приватных файлов.
- `attachmentRouter` защищён auth, но **нет лимитов/валидации MIME**, слабая валидация ownerType/ownerId, и есть **расхождение путей хранения** (`uploads` vs `public/uploads`).
- Метаданные хранятся в SQL-таблице `attachments`, но есть разрыв имён модели (`Attachments` vs `Attachment`) и слабая связность с upload роутами.
- На фронте upload используется **только через `/api/uploads`** (avatar/background/logo). `/api/attachments` не используется.
- В ChatMessage уже есть `attachments[]`, но **нет безопасного pipeline для upload/download**.
- Нужен **единый модуль Files** с едиными правилами авторизации, storage layout, download policy и миграцией, иначе пайплайны будут множиться.

---

## Current state inventory

### Backend

#### 1) Upload маршруты

**A. `/api/uploads` (public, без auth)**
- Файл: `server/src/routes/system/uploadRouter.js`
- Подключение: `server/app.js` → `app.use('/api/uploads', uploadRoutes)` (без `auth`)
- Эндпоинты:
  - `POST /api/uploads/:ownerType/:ownerId?purpose=avatar|background|logo|file`
  - `POST /api/uploads/by-url/:ownerType/:ownerId`
- Транспорт: `multer.diskStorage`, `node-fetch` (для by-url)
- Лимиты/MIME:
  - Изображения: PNG/JPEG/WEBP/GIF/SVG, лимит 5MB
  - Файлы: pdf/zip/xls/xlsx/txt/csv/json и др., лимит 500MB
- Storage path:
  - `server/uploads/<ownerDir>/<ownerId>/<filename>`
  - `relPath` → `/uploads/<ownerDir>/<ownerId>/<filename>` (публичный URL)
- Метаданные:
  - Запись в `attachments` через `Attachment.create` (model resolved через `pickModel`)
  - Дополнительно может обновлять `avatarUrl/backgroundUrl/logoUrl` в сущностях User/Company/Counterparty
- **Security:**
  - Нет auth, companyId и uploadedBy читаются из body/query
  - Нет проверок ownership/ACL

**B. `/api/attachments` (auth)**
- Файл: `server/src/routes/system/attachmentRouter.js`
- Подключение: `server/src/routes/rootRouter.js` → `rootRouter.use('/attachments', auth, ...)`
- Эндпоинты:
  - `GET /api/attachments`
  - `POST /api/attachments/upload`
  - `GET /api/attachments/:id/download`
  - `DELETE /api/attachments/:id`
- Транспорт: `multer.diskStorage` (без MIME/size лимитов)
- Storage path:
  - `uploads/<companyId>/<timestamp-safeName>`
- Метаданные:
  - `server/src/controllers/system/Attachment.controller.js`
  - `server/src/services/system/attachmentService.js`
- **Security:**
  - Auth есть (companyId из токена)
  - Нет явной валидации ownerType/ownerId, нет ACL

#### 2) Download / serve
- Public static:
  - `server/app.js` → `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`
  - **Любой** может скачать `/uploads/...` без auth
- Защищённый download:
  - `GET /api/attachments/:id/download` → проверка `companyId` в `AttachmentService.getForDownload`

#### 3) Метаданные и модели
- SQL таблица: `attachments`
  - Модель: `server/src/models/system/attachments.js` (modelName = `Attachments`)
  - Миграция: `server/src/migrations/20250819145912-create-attachments.js`
  - Поля: `companyId, ownerType, ownerId, filename, mime, size, storagePath, uploadedBy, createdAt`
  - Enum ownerType: `counterparty, deal, task, order, offer, product, contact, user, company, department`
- Связь с продуктами:
  - `product_attachments` → `server/src/models/pim/productattachment.js`
  - CRUD `server/src/routes/pim/productAttachment.router.js` + `productAttachmentService.js`

#### 4) Использование/зависимости
- `uploadRouter` напрямую обновляет `avatarUrl/backgroundUrl/logoUrl` (User/Company/Counterparty)
- `attachmentRouter` и `AttachmentService` работают только с таблицей `attachments`
- `productAttachmentService` использует `companyId` из query (может быть подменён)

#### 5) Несоответствия/баги
- Путь удаления файлов:
  - `AttachmentService.remove` удаляет из `public/uploads`, но upload сохраняет в `uploads` → риск «висячих» файлов
- Модель:
  - `attachmentService` импортирует `{ Attachment }`, но модель называется `Attachments` → риск runtime ошибки/undefined
- Enum ownerType:
  - В `uploadRouter` поддерживаются только `user/company/counterparty`, хотя enum шире

---

### Frontend

#### 1) RTK Query endpoints
- `client/src/store/rtk/uploadApi.js`:
  - `uploadFile` → `POST /uploads/:ownerType/:ownerId`
  - `attachFromUrl` → `POST /uploads/by-url/:ownerType/:ownerId`
  - Передаёт `companyId` и `uploadedBy` в body
- `/api/attachments` не используется на фронте

#### 2) UI компоненты для загрузки
- `client/src/components/media/AvatarEditable`
- `client/src/components/inputs/ImagePicker`

#### 3) Где используются
- User avatar: `client/src/components/user/UserAvatarHeader/index.js`
- Company logo/avatar: `client/src/pages/company/CompanyInfoPage/index.js`
- User background: `client/src/pages/users/UserSettingsPage/sections/AppearanceForm/index.js`

#### 4) Хранение результата
- Используются URL из ответа `/api/uploads` (хранятся как `avatarUrl`, `backgroundPath`, и т.д.)

---

## Use-case matrix (current vs target)

| Use-case | Current endpoint | Metadata model | Storage path | Risks | Recommended future endpoint |
|---|---|---|---|---|---|
| User avatar | `POST /api/uploads/users/:id` | `attachments` | `uploads/users/<id>/...` (public) | no-auth, companyId from body, public URL | `POST /api/files/upload` (auth, ownerType=user) |
| User background | `POST /api/uploads/users/:id?purpose=background` | `attachments` | `uploads/users/<id>/...` (public) | same as above | `/api/files/upload` + `purpose=background` |
| Company logo/avatar | `POST /api/uploads/company/:id` | `attachments` | `uploads/companies/<id>/...` (public) | same as above | `/api/files/upload` (auth, ownerType=company) |
| Counterparty logo/avatar | (possible via /uploads) | `attachments` | `uploads/counterparties/<id>` | no auth, no ownership check | `/api/files/upload` (auth, ownerType=counterparty) |
| Product images/attachments | `POST /api/uploads/...` + `product-attachments` join | `attachments` + `product_attachments` | mixed | no ACL, companyId in query | `/api/files/upload` + `POST /api/files/link` or direct ownerType=product |
| Deal/Task/Order/Offer files | enum allows, no dedicated endpoints | `attachments` | undefined | missing pipeline | `/api/files/upload` + ownerType=deal/task/etc |
| Chat attachments (planned) | none | `chat_messages.attachments` | none | no secure download | `/api/files/upload` + ownerType=chatMessage + signed/secure download |

---

## P0 / P1 risks

**P0 (Critical)**
- `/api/uploads` without auth → любой может загрузить файл, подставить `companyId`, связать с чужим ownerId
- `/uploads/*` public static → утечка приватных файлов, невозможно enforce membership
- `companyId/uploadedBy` берутся из body/query → tenant leak и spoofing автора

**P1 (High)**
- Несовпадение storage path (uploads vs public/uploads) → file leaks + delete не работает
- Нет единой модели download policy (public vs private)
- Нет ACL/permission enforcement (permissions существуют в constants, но не применяются)

**P2 (Medium)**
- ownerType enum шире, чем поддерживаемые upload-роуты
- `AttachmentService` может использовать неверную модель имени
- productAttachmentService допускает query.companyId override

---

## Target architecture: One Upload System

### 1) Unified API
- `POST /api/files/upload`
  - multipart `file`
  - body: `{ ownerType, ownerId, purpose, visibility }`
- `POST /api/files/by-url`
- `GET /api/files/:id/download`
- `DELETE /api/files/:id`
- `GET /api/files?ownerType&ownerId`

### 2) Data model (Files/Attachments)
Обязательные поля:
- `id`, `companyId`, `ownerType`, `ownerId`, `uploadedBy`
- `filename`, `mime`, `size`, `storagePath`
- `purpose` (avatar/logo/background/document/media)
- `visibility` (`public` | `private`)
- `createdAt`, `deletedAt` (soft-delete)

### 3) Storage layout
- Единый путь:
  - `uploads/<companyId>/<ownerType>/<ownerId>/<fileId>_<safeName>`
- Для public:
  - либо отдельный `public-uploads/` каталог
  - либо same path + signed/authorized download

### 4) Security rules
- `companyId` только из токена (`req.user.companyId`)
- Ownership validation по ownerType/ownerId (membership + ACL)
- Permissions:
  - upload/delete/read по роли и ownerType
- Запрет public static для private

---

## Migration plan (safe, 3–6 этапов)
1) **Добавить unified endpoints параллельно**, не ломая старые `/api/uploads`.
2) Перевести use-case’ы по очереди (User avatar → Company logo → Background → Product → Chat).
3) Закрыть `/api/uploads`:
   - повесить auth
   - запретить `companyId` из body
4) Перевести download на защищённые эндпоинты, отключить public static для private.
5) Провести cleanup старых файлов и выровнять storage path.

---

## Appendix

### Backend files/endpoints
- `server/app.js` (static `/uploads`, `/api/uploads`)
- `server/src/routes/system/uploadRouter.js` (public upload)
- `server/src/routes/system/attachmentRouter.js` (auth upload/list/download/delete)
- `server/src/controllers/system/Attachment.controller.js`
- `server/src/services/system/attachmentService.js`
- `server/src/models/system/attachments.js`
- `server/src/migrations/20250819145912-create-attachments.js`
- `server/src/models/pim/productattachment.js`
- `server/src/services/pim/productAttachmentService.js`
- `server/src/routes/pim/productAttachment.router.js`
- `server/src/mongoModels/chat/ChatMessage.js`

### Frontend files
- `client/src/store/rtk/uploadApi.js`
- `client/src/components/media/AvatarEditable`
- `client/src/components/inputs/ImagePicker`
- `client/src/components/user/UserAvatarHeader/index.js`
- `client/src/pages/company/CompanyInfoPage/index.js`
- `client/src/pages/users/UserSettingsPage/sections/AppearanceForm/index.js`
- `client/src/store/rtk/chatApi.js` (attachments payload)

### ownerType enums
- `attachments.ownerType` enum: `counterparty, deal, task, order, offer, product, contact, user, company, department`
- `uploadRouter` supports only: `user, company, counterparty`

