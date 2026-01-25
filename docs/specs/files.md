# Files System Spec (Unified) + Migration Plan v1

## 1) Terms
- **File / Attachment**: единая сущность файла в системе (метаданные + storagePath).
- **ownerType / ownerId**: ссылка на бизнес‑сущность, к которой относится файл.
- **purpose**: назначение файла (avatar, background, logo, image, document, media, other).
- **visibility**: доступность файла (`private` по умолчанию, `public` только для website assets).
- **publicKey**: публичный ключ для выдачи public‑файлов без раскрытия внутренних id.

---

## 2) Data model (attachments/files)

**Table:** `files` (или переиспользовать `attachments`, но на уровне API/доков использовать термин Files)

**Fields (minimal):**
- `id` (uuid, PK)
- `companyId` (uuid, NOT NULL)
- `ownerType` (enum, NOT NULL)
- `ownerId` (uuid, NOT NULL)
- `purpose` (enum, NOT NULL, default: `file`)
- `visibility` (enum: `private|public`, default: `private`)
- `publicKey` (string, nullable, unique when not null)
- `filename` (string, original name)
- `safeName` (string, stored name)
- `mime` (string)
- `size` (int)
- `storagePath` (string)
- `uploadedBy` (uuid)
- `createdAt` / `updatedAt` / `deletedAt`

**Indexes:**
- `(companyId, ownerType, ownerId)`
- `(publicKey)` unique
- `(companyId, visibility)`
- `(companyId, purpose)` (optional)

**OwnerType (current + target):**
- `user`, `company`, `counterparty`, `product`, `deal`, `task`, `order`, `offer`, `contact`, `department`, `chatMessage`, `brand`

---

## 3) API Contract

### 3.1 POST /api/files/upload
**Type:** multipart/form-data

**Fields:**
- `file` (binary, required)
- `ownerType` (string, required)
- `ownerId` (uuid, required)
- `purpose` (string, optional, default `file`)
- `visibility` (string, optional, default `private`)

NOTE:
- Поле `visibility` игнорируется и принудительно устанавливается в `private`,
  если ownerType/purpose не входят в whitelist public‑use‑cases.
- Клиент не может повысить уровень доступности файла самостоятельно.

**Response (200/201):**
```json
{
  "data": {
    "id": "uuid",
    "ownerType": "user",
    "ownerId": "uuid",
    "purpose": "avatar",
    "visibility": "private",
    "publicKey": null,
    "filename": "photo.jpg",
    "mime": "image/jpeg",
    "size": 123456,
    "url": "/api/files/uuid/download",
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
}
```

### 3.2 GET /api/files/:id/download (private)
**Auth required.**

**Response:** binary stream with headers:
- `Content-Type`
- `Content-Disposition`

### 3.3 GET /api/public-files/:publicKey (public)
**Auth not required.**

**Response:** binary stream (public assets only).

### 3.4 DELETE /api/files/:id
**Auth required.**

**Response:**
```json
{ "ok": true }
```

### 3.5 GET /api/files?ownerType&ownerId&purpose
**Auth required.**

**Response:**
```json
{ "data": [ { "id": "..." } ], "meta": { "count": 1 } }
```

---

## 4) Security / ACL rules

### 4.1 Company scope
- `companyId` всегда берётся из `req.user.companyId`.
- `ownerId` валидируется на принадлежность компании.

### 4.1.1 Ownership validation
- `ownerId` валидируется через соответствующий доменный сервис:
  - `user` → UserService
  - `company` → CompanyService
  - `counterparty` → CounterpartyService
  - `product` → ProductService
  - `deal/order/offer/task/contact/department` → соответствующий сервис
  - `chatMessage` → ChatService (membership + room scope)
- Files service не содержит бизнес‑логики владения, а только делегирует проверку.

### 4.2 Permissions (минимальный список)
- `file:upload` (или `attachment:upload`)
- `file:read` (или `attachment:read`)
- `file:delete` (или `attachment:delete`)

### 4.3 Per use‑case policy
- **PRIVATE by default**: user avatar/background, counterparty avatar, deal/task/order/offer docs, chat attachments.
- **PUBLIC allowed**: product images, brand/company marketing assets (website only).

**PUBLIC allowed ONLY for:**
- ownerType: `product` (purpose: `product_image`)
- ownerType: `brand` / `company` (purpose: `website_asset`)

Любая попытка установить `visibility=public` для других ownerType или purpose
должна приводить к `400 VALIDATION_ERROR`.

### 4.4 Delete rules
- Автор загрузки (uploadedBy) может удалить свой файл, если это разрешено бизнес‑контекстом ownerType.
- System `admin` / `owner` компании может удалить любой private‑файл.
- Public‑файлы могут быть удалены только system `admin` / `owner`.
- Удаление по умолчанию soft‑delete (`deletedAt`), физическое удаление — отдельной задачей/джобой.

---

## 5) Storage layout

**Private (default):**
```
/uploads/<companyId>/<ownerType>/<ownerId>/<fileId>_<safeName>
```

**Public (optional):**
```
/public-uploads/<publicKey>_<safeName>
```

**safeName strategy:**
- `safeName = <timestamp>-<rand>.<ext>`
- Store original filename separately (`filename`).

---

## 6) Migration plan (v1)

1) **Add unified API** `/api/files/*` in parallel with existing `/api/uploads` and `/api/attachments`.
2) **Migrate frontend by use‑case** (user avatar → company logo → background → product → chat).
3) **Lock down `/api/uploads`**:
   - add auth
   - forbid `companyId` from body/query
4) **Restrict public static** for private files; only `/api/public-files/:publicKey` remains public.
5) **Cleanup legacy storage** paths and orphan files.

---

## 7) Open questions
- Нужно ли хранить `publicKey` для всех public‑files или только для subset (website assets)?
- Нужен ли soft‑delete или hard delete для public assets?
- Требуется ли размер/формат ограничений по ownerType (например, avatar max 5MB)?

