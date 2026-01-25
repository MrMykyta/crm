# Report: Files Visibility / Permissions Matrix + Use‑case Map

## Executive summary
- В коде уже есть **две параллельные системы** upload/download: публичный `/api/uploads` и защищённый `/api/attachments`.
- `/api/uploads` не защищён auth и принимает `companyId/uploadedBy` из body → высокий риск tenant leak и подмены владельца.
- `/uploads/*` отдаётся как **public static** без проверок, что противоречит “private by default”.
- Метаданные файлов хранятся в SQL `attachments`, но ownerType/ownerId используются непоследовательно, а путь хранения расходится (uploads vs public/uploads).
- На фронте upload используется **только** через `/api/uploads` (avatars/background/logo), а `attachments` API не используется.
- Для чата есть `attachments[]` в Mongo, но **нет** безопасного pipeline.
- Нужна единая политика visibility + permissions и единый Files API.

---

## 1) Поля/места хранения URL и file‑reference

### Backend (модели/коллекции)
- `server/src/models/crm/user.js`:
  - `avatarUrl`, `backgroundUrl`
- `server/src/models/crm/company.js`:
  - `avatarUrl`
- `server/src/models/crm/counterparty.js`:
  - `avatarUrl`
- `server/src/models/pim/brand.js`:
  - `logoUrl`
- `server/src/models/system/attachments.js`:
  - метаданные файлов: `storagePath`, `filename`, `mime`, `size`, `ownerType`, `ownerId`, `uploadedBy`, `companyId`
- `server/src/mongoModels/chat/ChatRoom.js`:
  - `avatarUrl`
- `server/src/mongoModels/chat/ChatMessage.js`:
  - `attachments[]` (url, name, size, mimeType, type)
- `server/src/models/system/userpreferences.js`:
  - `appearance` / `background` JSON (в них может храниться background URL)

### Frontend (схемы/данные)
- `client/src/schemas/user.schema.js` → `avatarUrl`
- `client/src/schemas/company.schema.js` → `avatarUrl`
- `client/src/hooks/useBrandAndBackground.js` → использует `company.avatarUrl`, `user.avatarUrl`
- `client/src/store/rtk/userApi.js` → `appearance.backgroundPath` / `background.url`
- `client/src/pages/Chat/ChatWindow/index.js` → отображение `message.attachments[0].name`

---

## 2) Все текущие upload/download точки

### Backend upload endpoints

**A) Public upload**
- `POST /api/uploads/:ownerType/:ownerId?purpose=avatar|background|logo|file`
  - Файл: `server/src/routes/system/uploadRouter.js`
  - **Auth: нет**
  - Storage: `uploads/<ownerDir>/<ownerId>/<filename>`
  - MIME/size лимиты: есть (image 5MB, file 500MB)
  - Метаданные: `attachments` запись

**B) Upload by URL**
- `POST /api/uploads/by-url/:ownerType/:ownerId`
  - **Auth: нет**
  - Позволяет скачивать remote URL в uploads
  - MIME/size лимиты: есть, но без auth

**C) Protected attachments upload**
- `POST /api/attachments/upload`
  - Файл: `server/src/routes/system/attachmentRouter.js`
  - **Auth: да**
  - Storage: `uploads/<companyId>/<timestamp>-<safeName>`
  - MIME/size лимиты: нет

### Backend download/serve
- **Public static**:
  - `app.use('/uploads', express.static(...))` в `server/app.js`
  - **Без auth**
- **Protected download**:
  - `GET /api/attachments/:id/download` → `AttachmentService.getForDownload(companyId, id)`

### Frontend upload usage
- `client/src/store/rtk/uploadApi.js`:
  - `uploadFile` → `/uploads/:ownerType/:ownerId`
  - `attachFromUrl` → `/uploads/by-url/:ownerType/:ownerId`
- Используется в:
  - `UserAvatarHeader` (user avatar)
  - `CompanyInfoPage` (company avatar)
  - `AppearanceForm` (user background)

---

## 3) Use‑case policy matrix

| Use‑case | ownerType / purpose | Required visibility | Who can upload | Who can view/download | Current endpoint/path | Risks | Target endpoint |
|---|---|---|---|---|---|---|---|
| User avatar | `user` / `avatar` | PRIVATE (внутри company) | user (self) / admin | company members | `/api/uploads/users/:id` | no-auth, companyId spoofing, public URL | `/api/files/upload` (auth, ownerType=user, purpose=avatar) |
| User background | `user` / `background` | PRIVATE | user (self) | company members (or only self) | `/api/uploads/users/:id?purpose=background` | same as above | unified `/api/files/upload` |
| Company avatar/logo | `company` / `avatar` | PRIVATE (CRM), PUBLIC (website if enabled) | owner/admin | company members; public only if flagged | `/api/uploads/company/:id` | no-auth, public URL | unified `/api/files/upload` + `visibility` |
| Counterparty avatar | `counterparty` / `avatar` | PRIVATE | CRM users with edit rights | company members | `/api/uploads/counterparties/:id` (implicit) | no-auth, public URL | unified `/api/files/upload` |
| Brand logo | `brand` / `logo` | PRIVATE (CRM) or PUBLIC (website) | admin/owner | company members; public if flagged | **нет отдельного upload** (possible via `/api/uploads`) | no auth, public URL | unified `/api/files/upload` |
| Product images | `product` / `image` | PUBLIC (website) + PRIVATE (internal) | product editors | public for website, private for CRM | `/api/uploads` + `product-attachments` | no auth + public URL | unified `/api/files/upload` + `visibility=public` |
| Product docs/specs | `product` / `document` | PRIVATE by default | product editors | company members | `/api/uploads` + `product-attachments` | same | unified `/api/files/upload` |
| Deal/Task/Order/Offer attachments | `deal/task/order/offer` | PRIVATE | CRM roles w/ edit | company members | **нет pipeline** | missing secure storage | unified `/api/files/upload` |
| Chat attachments | `chatMessage` | PRIVATE (room members) | room member | room members only | **нет upload/download** | no safe download | unified `/api/files/upload` + room membership download guard |
| Website assets (future) | `company` / `brand` / `product` | PUBLIC | admin/owner | public | **нет** | public URL strategy missing | unified `/api/files/upload` + publicKey |

---

## 4) Public vs Private policy

### Allowed PUBLIC (only)
- Product images (website catalogue)
- Brand/company marketing assets (logo, hero, banner) — **если включён website mode**

### Always PRIVATE
- User avatars/backgrounds (internal identity)
- Counterparty avatars
- Deal/Task/Order/Offer attachments
- Chat attachments

### URL/publicKey strategy (recommendation)
- Для public: использовать `publicKey` (uuid/slug) вместо внутренних ownerId
- URL вида: `/public-files/{publicKey}`
- Исключить прямое раскрытие `companyId`/`ownerId`

---

## 5) Recommendations for unified Files API

### Mandatory fields
- `id`, `companyId`, `ownerType`, `ownerId`
- `uploadedBy`, `purpose`, `visibility` (`private` default)
- `filename`, `mime`, `size`, `storagePath`
- `publicKey` (nullable, for public files)

### Upload checks
- `companyId` only from token
- ownership validation: ownerId must belong to company
- permission check (role/ACL per ownerType)
- MIME/size enforced consistently

### Download checks
- Private: require auth + membership + ACL
- Public: allow via publicKey only
- No `express.static` for private files

---

## Appendix: Key files & endpoints

### Backend
- `server/app.js` (public static /uploads, /api/uploads)
- `server/src/routes/system/uploadRouter.js`
- `server/src/routes/system/attachmentRouter.js`
- `server/src/controllers/system/Attachment.controller.js`
- `server/src/services/system/attachmentService.js`
- `server/src/models/system/attachments.js`
- `server/src/migrations/20250819145912-create-attachments.js`
- `server/src/models/crm/user.js`, `company.js`, `counterparty.js`
- `server/src/models/pim/brand.js`
- `server/src/mongoModels/chat/ChatMessage.js`, `ChatRoom.js`

### Frontend
- `client/src/store/rtk/uploadApi.js`
- `client/src/components/media/AvatarEditable`
- `client/src/components/inputs/ImagePicker`
- `client/src/components/user/UserAvatarHeader/index.js`
- `client/src/pages/company/CompanyInfoPage/index.js`
- `client/src/pages/users/UserSettingsPage/sections/AppearanceForm/index.js`
- `client/src/store/rtk/chatApi.js`

