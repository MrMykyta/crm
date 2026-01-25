# Report: Chat Files Audit (backend + frontend)

## Executive summary
- В репозитории уже есть **два независимых пайплайна загрузки**: публичный `/api/uploads/*` и защищённый `/api/attachments/*`.
- Статика `/uploads/*` отдаётся **публично** без авторизации, что не подходит для корпоративного чата.
- `uploadRouter` **не защищён auth**, принимает `companyId`/`uploadedBy` из body/query, не проверяет membership → риск tenant leak и подмены авторства.
- `attachmentRouter` защищён auth, но **нет лимитов/фильтра MIME**, нет валидации ownerType/ownerId.
- Есть **несоответствие путей хранения** (`uploads` vs `public/uploads`) и риск «висячих» файлов.
- В ChatMessage уже есть поле `attachments[]`, но **загрузки и безопасной выдачи нет**.
- На фронте есть `uploadApi` и UI для аватаров/фонов; **общего upload для чата нет**.
- Для Chat attachments потребуется унификация хранилища, доступов и метаданных (MVP можно на базе текущего attachments).

---

## Что уже есть

### Backend
**1) Публичный upload API**
- Роут: `server/src/routes/system/uploadRouter.js`
  - `POST /api/uploads/:ownerType/:ownerId?purpose=avatar|background|logo|file`
  - `POST /api/uploads/by-url/:ownerType/:ownerId`
- Транспорт: `multer.diskStorage` + `node-fetch` (upload by URL)
- Допустимые MIME + лимиты:
  - Изображения: PNG/JPEG/WEBP/GIF/SVG, лимит 5MB
  - Файлы: pdf/zip/xls/xlsx/txt/csv/json и др., лимит 500MB
- Сохранение:
  - Путь: `server/uploads/{ownerDir}/{ownerId}/{filename}`
  - URL: `/uploads/{ownerDir}/{ownerId}/{filename}` (публичный)
- Метаданные:
  - Создаётся запись в `attachments` через `Attachment.create(...)`
  - Дополнительно может обновлять `avatarUrl/backgroundUrl/logoUrl` в `User/Company/Counterparty`
- **Безопасность**:
  - **Нет auth** (см. `server/app.js`: `app.use('/api/uploads', uploadRoutes)` без `auth`)
  - `companyId` и `uploadedBy` берутся из body/query
  - Нет проверки принадлежности ownerId к компании

**2) Защищённый attachments API**
- Роут: `server/src/routes/system/attachmentRouter.js` (подключён в `rootRouter` с `auth`)
  - `GET /api/attachments`
  - `POST /api/attachments/upload`
  - `GET /api/attachments/:id/download`
  - `DELETE /api/attachments/:id`
- Транспорт: `multer.diskStorage` без фильтров/лимитов
- Сохранение:
  - Путь: `uploads/{companyId}/{timestamp}-{safeName}`
- Контроллер/сервис:
  - `server/src/controllers/system/Attachment.controller.js`
  - `server/src/services/system/attachmentService.js`
  - Листинг/скачивание по `companyId`
- **Безопасность**:
  - Авторизация есть, но **нет ACL/permission проверок**
  - `ownerType/ownerId` не валидируются

**3) Статика / выдача файлов**
- `server/app.js`:
  - `app.use('/uploads', express.static(path.join(__dirname,'uploads')))`
  - Файлы публичны по URL `/uploads/...`
- `Attachment.controller.download` выдаёт файл только по `companyId`

**4) Модель хранения метаданных**
- Модель: `server/src/models/system/attachments.js`
  - `companyId, ownerType, ownerId, filename, mime, size, storagePath, uploadedBy, createdAt`
  - `ownerType` enum: `counterparty, deal, task, order, offer, product, contact, user, company, department`
- Миграция: `server/src/migrations/20250819145912-create-attachments.js`
- Связка с продуктами: `server/src/models/pim/productattachment.js` → `attachments`

**5) Chat attachments (Mongo)**
- `server/src/mongoModels/chat/ChatMessage.js`
  - `attachments[]` с `{ type, url, name, size, mimeType }`
  - **Но** upload/безопасная выдача для чата отсутствуют

**6) Разнобой путей хранения**
- `uploadRouter` пишет в `server/uploads/...`
- `AttachmentController.download` читает из `uploads/...`
- `attachmentService.remove` удаляет из `public/uploads/...` (не совпадает)
- `server/upload/storage.js` использует `public/uploads` (не используется)

---

### Frontend
**1) Upload API в store**
- `client/src/store/rtk/uploadApi.js`
  - `useUploadFileMutation` → `POST /uploads/:ownerType/:ownerId`
  - `useAttachFromUrlMutation` → `POST /uploads/by-url/:ownerType/:ownerId`
  - Отправляет `companyId` и `uploadedBy` в body

**2) Использования upload на UI**
- Аватар пользователя: `client/src/components/user/UserAvatarHeader/index.js`
- Лого компании: `client/src/pages/company/CompanyInfoPage/index.js`
- Фон пользователя (appearance): `client/src/pages/users/UserSettingsPage/sections/AppearanceForm/index.js`
- Общие UI-компоненты:
  - `client/src/components/media/AvatarEditable`
  - `client/src/components/inputs/ImagePicker`

**3) Chat**
- `client/src/store/rtk/chatApi.js` принимает `attachments` в payload
- В UI используется только `attachments[0].name` для превью (см. `client/src/pages/Chat/ChatWindow/index.js`)
- **Загрузки/превью файлов в чате нет**

---

## Проблемы / риски

### Security
- **/api/uploads открыт без auth** → любой может загрузить файл, подставить `companyId` и `uploadedBy`.
- **Публичный доступ к `/uploads/*`** → нет membership/role проверки при скачивании.
- `uploadRouter` позволяет обновлять `avatarUrl/backgroundUrl/logoUrl` без проверки прав.
- `attachmentRouter` не ограничивает MIME/size → риск злоупотреблений.
- `ownerType/ownerId` в `attachmentRouter` не валидируются.

### Data consistency
- Несоответствие путей хранения (`uploads` vs `public/uploads`) → удаление может не чистить файлы.
- `AttachmentService.list` включает `association: 'uploader'`, но в модели `attachments` нет описанной ассоциации → потенциальная ошибка на runtime.

### Chat readiness
- В `attachments` enum нет типа для чата (`chat`/`message`).
- `uploadRouter` принимает только `user/company/counterparty` как ownerType — чат не поддерживается.
- Нет системной выдачи файлов для чата (нужен защищённый download по room/membership).

---

## Рекомендованный путь для MVP chat attachments (без кода)
1) **Выбрать единый пайплайн**: либо `attachments` (SQL) + ссылки в Mongo, либо отдельная `ChatAttachment` коллекция. Для MVP проще переиспользовать `attachments`.
2) **Добавить ownerType** для чата (`chatMessage` или `chat`) в `attachments` enum и нормализовать `uploadRouter`.
3) **Сделать upload только через auth** и брать `companyId` только из `req.user.companyId`.
4) **Запретить public static для chat**: выдача через защищённый endpoint (membership + companyId).
5) **Унифицировать storage path** (`uploads` vs `public/uploads`) и удалить `public/uploads` из remove-логики.
6) **Добавить лимиты и MIME-фильтры** в защищённый upload (как минимум как в `uploadRouter`).
7) **Привязка attachment к сообщению**: в ChatMessage хранить `{ attachmentId, url, mimeType, size }`.
8) **Индексы для вкладок Медиа/Документы**: нужен быстрый поиск по companyId/roomId/type.
9) **Frontend**: новый chat upload flow через store/RTK Query, без `companyId` в body; использовать возвращаемый `attachmentId`.

---

## Список файлов для будущей реализации (без правок сейчас)

### Backend
- `server/app.js` (static `/uploads`, защита /api/uploads)
- `server/src/routes/system/uploadRouter.js`
- `server/src/routes/system/attachmentRouter.js`
- `server/src/controllers/system/Attachment.controller.js`
- `server/src/services/system/attachmentService.js`
- `server/src/models/system/attachments.js`
- `server/src/migrations/20250819145912-create-attachments.js`
- `server/src/mongoModels/chat/ChatMessage.js`

### Frontend
- `client/src/store/rtk/uploadApi.js`
- `client/src/store/rtk/chatApi.js`
- `client/src/pages/Chat/ChatInput/index.js` (кнопка вложений)
- `client/src/pages/Chat/ChatWindow/index.js` (рендер превью/attachments)
- `client/src/components/media/AvatarEditable` / `client/src/components/inputs/ImagePicker` (если переиспользовать)

