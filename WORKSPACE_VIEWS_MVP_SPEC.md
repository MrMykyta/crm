# Workspace Views — MVP Spec (locked decisions)

> Статус: **spec / locked**. Никакого кода, никаких миграций. Документ закрепляет 14 MVP-решений из обсуждения по [`WMS_WORKSPACE_VIEWS_V2.md`](./WMS_WORKSPACE_VIEWS_V2.md) и даёт достаточно деталей, чтобы Phase 1 стартовала без новых уточнений.
> Дата: 2026-06-04.
> Все open questions из §10 V2-аудита **закрыты ниже** для MVP.

---

## 0. Что зафиксировано в одном экране

| # | Решение | MVP-объём |
|---|---|---|
| 1 | Scope | `system` + `personal`. **Без** `company` / `team` / sharing. |
| 2 | System views | Создаются сидером/ensure-service. User может `hide`/`pin`/`reorder`. **Не может** редактировать `filter`/`sort`/`columns`/`name`. |
| 3 | Personal views | User может `create`/`update`/`delete` свои. Видны только владельцу. Hard-limit **50 на (user, module)**. |
| 4 | User prefs | Поля: `pinned`, `hidden`, `sortOrder`, `lastUsedAt`. |
| 5 | URL strategy | System: `?view=<key>`. Personal: `?viewId=<uuid>`. Если оба заданы — `viewId` побеждает. |
| 6 | Sidebar | Ширина **280px**. Показываем только pinned. **Макс 5** pinned per module в sidebar. |
| 7 | In-page picker | До 6 views — tabs. Больше — dropdown. Всегда есть **"Manage views"** action. |
| 8 | Manage drawer | List + pin/unpin + hide/unhide (system) + delete + rename (personal). **Без** sharing. |
| 9 | Dynamic placeholders | `$current_user`, `$today_start`, `$today_end`, `$user_default_warehouse`. |
| 10 | MVP modules | Реализуем только `wms.documents`. Архитектура готова к `crm.leads`, `crm.deals`, `oms.orders`, `pim.products`. |
| 11 | DB schema | `workspace_views` + `workspace_view_user_prefs`. См. §11. |
| 12 | Backend endpoints | 7 endpoints. См. §12. |
| 13 | Frontend components | `WorkspaceViewPicker` (P2), `WorkspaceViewsSidebarSection` (P2), `WorkspaceViewsDrawer` (P3), `WorkspaceViewEditor` (P4). |
| 14 | Phases | P1 backend → P2 frontend foundation → P3 manage drawer → P4 personal-view-from-current-filters. |

---

## 1. Scope (locked)

- **In MVP**: `scope ENUM('system','personal')`. ENUM закладываем уже сейчас, чтобы будущее `company`/`team` добавились через `ALTER TYPE ADD VALUE`, без миграции данных.
- **Out of MVP**: `company`-views, `team`-views, любой sharing (direct share, scope upgrade), audit trail.
- **Гайд для имплементации**: любая логика «show me what is visible» = `scope='system' OR (scope='personal' AND owner_user_id=:userId)`.

---

## 2. System views (locked)

### 2.1. Происхождение
- Создаются **idempotent ensure-service'ом** (не миграцией), вызываемым:
  - на boot'е (один раз per company, при первой загрузке модуля), **или**
  - по cron'у one-shot при добавлении новой company.
- Имена/иконки/фильтры заданы статически в `serverside` registry (`src/services/workspaceViews/systemViewsRegistry/wms.documents.js`).
- При каждом запуске ensure: `findOrCreate by (company_id, module, key)`. Уже существующие НЕ перезаписываются — это позволит позже менять system views осторожно (через миграции данных, не сидер).
- `is_locked = true` для system. UI запрещает редактирование через disabled-кнопки + API возвращает 409 на PATCH/DELETE.

### 2.2. Базовый набор system views для `wms.documents` (MVP)
| key | name_i18n_key | icon | filter |
|---|---|---|---|
| `all` | `workspaceViews.wms.documents.all` | `LayoutGrid` | `{}` |
| `pz` | `workspaceViews.wms.documents.pz` | `Truck` | `{"where":[{"field":"type","op":"in","value":["PZ"]}]}` |
| `wz` | `workspaceViews.wms.documents.wz` | `Send` | `{"where":[{"field":"type","op":"in","value":["WZ"]}]}` |
| `mm` | `workspaceViews.wms.documents.mm` | `ArrowRightLeft` | `{"where":[{"field":"type","op":"in","value":["MM"]}]}` |
| `rw` | `workspaceViews.wms.documents.rw` | `MinusCircle` | `{"where":[{"field":"type","op":"in","value":["RW"]}]}` |
| `pw` | `workspaceViews.wms.documents.pw` | `PlusCircle` | `{"where":[{"field":"type","op":"in","value":["PW"]}]}` |
| `posted-today` | `workspaceViews.wms.documents.postedToday` | `CalendarCheck` | `{"where":[{"field":"date","op":"gte","value":"$today_start"},{"field":"date","op":"lt","value":"$today_end"}]}` |

`is_default = true` только для `all`. Остальные — `false`.

### 2.3. Юзерские права над system views
- Может: `pin/unpin`, `hide/unhide`, `reorder` (через `prefs.sortOrder`), touch (для recently used).
- Не может: `update`/`delete`, изменить `name`/`filter`/`sort`/`columns`/`icon`.

---

## 3. Personal views (locked)

- Поле `scope = 'personal'`, `owner_user_id = :userId`.
- Видимость: **только владелец**. Любой `GET` от другого user'а — НЕ возвращает чужие personal views.
- Лимит: **50 per (user, module)**. При попытке 51-й → `409 PERSONAL_VIEW_LIMIT_EXCEEDED` с `details: { limit: 50, currentCount: 50 }`.
- Удаление: только владелец. Hard-delete (cascade на user_prefs).
- Поля редактируемые: `name`, `icon`, `filter`, `sort`, `columns`, `description`. Запрещено менять: `scope`, `owner_user_id`, `module`, `key` (всегда null для personal), `is_locked` (всегда false), `is_default` (всегда false; default — это только system или company-level в будущем).

---

## 4. User prefs (locked)

Поля: `pinned BOOLEAN`, `hidden BOOLEAN`, `sortOrder INTEGER`, `lastUsedAt TIMESTAMP NULL`.

Поведение:
- **Pin/unpin**: меняет `pinned`. При первом pin'е `sortOrder` устанавливается как `MAX(sortOrder) + 1` для этого (user, module).
- **Hide/unhide**: меняет `hidden`. Скрытая view не возвращается в дефолтном `GET /api/workspace-views?module=...`. Чтобы показать в Manage drawer'е — фронт зовёт `?includeHidden=true`.
- **Reorder**: PATCH user_prefs с новым `sortOrder`. MVP реализуется через действие `pin` с явным `sortOrder` (отдельный endpoint reorder не нужен).
- **lastUsedAt**: меняется через `POST /:id/actions/touch`. Фронт зовёт touch на смене активной view (debounced 1s). Используется для будущего «Recently used».

Невидимое для user'а правило: **prefs создаются лениво** — при первом pin/hide/touch. Если у user'а нет prefs row, считаем `pinned=false, hidden=false, sortOrder=0, lastUsedAt=null`.

---

## 5. URL strategy (locked)

- **System view**: `/main/wms/documents?view=pz`.
- **Personal view**: `/main/wms/documents?viewId=abc-123-...`.
- **Если оба**: `viewId` побеждает.
- **Ни одного**: используется system view с `is_default=true` (для `wms.documents` это `view=all`).

Преимущества:
- URL'ы system views остаются "красивыми" и шарятся как `?view=pz`.
- Personal views не нуждаются в slug'е → uniqueness тривиальна (UUID).
- Не нужна миграция URL'ов при перепроектировании v3.

Frontend контракт: при `view` И `viewId` одновременно — взять `viewId`, проигнорировать `view`. На бэке — то же правило в endpoint resolver'е (если понадобится).

---

## 6. Sidebar (locked)

- **Ширина**: `--sidebar-w: 280px` (сейчас 248px → +32px). Collapsed остаётся 76px.
- **Что показываем под module-node**: только views где `prefs.pinned = true`.
- **Максимум pinned per module в sidebar**: **5**. Шестую view спрятать с пометкой "+N more" → клик открывает Manage drawer.
- **Сортировка**: по `prefs.sortOrder ASC`.
- **Поведение клика на module-node**: переход на default view (`?view=<default_key>` или `?viewId=<...>` в порядке предпочтения). Не открывает submenu — submenu **уже раскрыт** (always-expanded для модулей с pinned views).
- **Visual nesting**: indent 16px, у каждой pinned view — иконка из `view.icon` (или dot если icon null), label.
- **Collapsed state (76px)**: pinned views НЕ показываем, только module-icon. Hover на module-icon → mini-flyout (старый `WorkspaceViewsPopover` переиспользуется как secondary surface) со списком pinned + ссылкой «Open …» на module page.

---

## 7. In-page picker (locked)

Это рендерится в шапке страницы модуля (`/main/wms/documents`).

**Pattern selection rule:**
- Видимых views (`hidden=false`) **≤ 6**: горизонтальные tabs.
- **> 6**: dropdown trigger ("All documents ▾") → popup со списком + search-input + actions.

**Состав tabs/list:**
1. Все non-hidden views, сортировка: pinned first (по `sortOrder`), затем по `lastUsedAt DESC`, затем алфавитно.
2. Активная view подсвечена.
3. **Всегда** в конце: action-кнопка **"Manage views"** → открывает `WorkspaceViewsDrawer`.

**Создание новой personal view** (Phase 4): кнопка `+` рядом с picker'ом, открывает inline `WorkspaceViewEditor` (модал/drawer) с предзаполненным `filter` из текущего состояния URL (q/type/status/dateFrom/...).

---

## 8. Manage drawer (locked)

`WorkspaceViewsDrawer` — slide-in справа, ширина ~420px.

**MVP-функции** (только это):
- Список **всех** views для модуля (system + personal), включая `hidden`.
- Per-row:
  - Тип (badge "System" / "Personal" / иконка lock).
  - Имя + иконка.
  - Pin toggle.
  - Hide/unhide toggle (для system) ИЛИ delete (для personal — только для своих).
  - Rename (только personal).
- "Create new view" кнопка → `WorkspaceViewEditor` (Phase 4).
- Reorder через drag-and-drop **в первой версии — нет**. Reorder делается через `sortOrder` в PATCH; UX — отложить на Phase 3.5 (опц).

**Не в MVP**:
- Sharing (упр. scope), team-assignment.
- Bulk-actions.
- Audit log.
- Duplicate (clone view — отдельная задача).

---

## 9. Dynamic placeholders (locked)

MVP поддерживает **4 placeholder'а** в `filter` JSONB:

| Placeholder | Resolver | Use-case |
|---|---|---|
| `$current_user` | `req.user.id` | "Мои документы" |
| `$today_start` | `dateFromAtZone(req.user.timezone, 00:00)` | "Сегодня" |
| `$today_end` | `dateFromAtZone(req.user.timezone, 23:59:59.999)` | "Сегодня" (закрытый интервал opt) |
| `$user_default_warehouse` | `companyWarehouseDocumentSettings.defaultWarehouseId` | "Мой склад" |

**Резолвинг происходит на backend'е** в момент применения filter'а к запросу. Сохранённый в БД filter — **не модифицируется**.

Невалидный placeholder (или невозможный резолв — например, нет default warehouse) → серверный warning в логе + фильтр-условие пропускается (best-effort, не падать).

Расширения (out of MVP): `$current_company`, `$this_week_start`, `$this_month_start`, `$last_30_days`. Список расширяется без миграции — только сервисный код.

---

## 10. MVP modules (locked)

**Реализуем в MVP**: только `module = 'wms.documents'`.

**Архитектура подготовлена к** (значит storage/API/UI nothing-WMS-specific):
- `crm.leads`
- `crm.deals`
- `oms.orders`
- `pim.products`

**Гайд для расширения** (post-MVP):
1. Добавить module в backend registry — описать allowed `filter.fields`, default sort, viewType.
2. Добавить system views в `systemViewsRegistry`.
3. На фронте — вставить `<WorkspaceViewPicker module="..." />` в page header.
4. Связать filter→URL mapping для нового модуля.

Никаких новых миграций для добавления модуля не требуется.

---

## 11. Database schema (locked)

Точная минимальная миграция для Phase 1.

### 11.1. `workspace_views`

| Колонка | Тип | NULL | Default | Заметки |
|---|---|---|---|---|
| `id` | UUID PK | NO | UUIDv4 | |
| `company_id` | UUID | NO | — | FK `companies(id)` ON DELETE CASCADE |
| `module` | VARCHAR(64) | NO | — | `'wms.documents'`, и т.д. |
| `key` | VARCHAR(64) | YES | — | Только для `scope='system'`. NULL для personal. |
| `scope` | ENUM | NO | `'personal'` | `('system','personal')` |
| `owner_user_id` | UUID | YES | — | NULL для system, NOT NULL для personal. FK `users(id)` ON DELETE CASCADE. |
| `name` | VARCHAR(120) | NO | — | Отображаемое имя (или fallback при отсутствии перевода). |
| `name_i18n_key` | VARCHAR(120) | YES | — | Для system views: `workspaceViews.wms.documents.pz` и т.п. |
| `description` | TEXT | YES | — | |
| `icon` | VARCHAR(40) | YES | — | Lucide-имя. |
| `filter` | JSONB | NO | `'{}'::jsonb` | См. §13.1 для shape. |
| `sort` | JSONB | YES | — | Массив `[{field,dir}]`. |
| `columns` | JSONB | YES | — | Список column id'ов. |
| `view_type` | VARCHAR(16) | NO | `'list'` | MVP: только `'list'`. |
| `is_default` | BOOLEAN | NO | false | |
| `is_locked` | BOOLEAN | NO | false | true для system. |
| `created_at` | TIMESTAMP | NO | NOW() | |
| `updated_at` | TIMESTAMP | NO | NOW() | |

**Constraints:**
- `CHECK ((scope = 'system' AND owner_user_id IS NULL AND key IS NOT NULL) OR (scope = 'personal' AND owner_user_id IS NOT NULL AND key IS NULL))` — name `workspace_views_scope_chk`.
- `UNIQUE(company_id, module, key) WHERE key IS NOT NULL` — partial unique. System uniqueness.
- `UNIQUE(company_id, module) WHERE is_default = true` — partial unique. Один default на (company, module).

**Indexes:**
- `(company_id, module)` — для list по модулю.
- `(owner_user_id, module)` — для "my views" lookup.
- `(scope)` — light, для админских запросов "сколько system views".

### 11.2. `workspace_view_user_prefs`

| Колонка | Тип | NULL | Default | Заметки |
|---|---|---|---|---|
| `id` | UUID PK | NO | UUIDv4 | |
| `user_id` | UUID | NO | — | FK `users(id)` ON DELETE CASCADE. |
| `view_id` | UUID | NO | — | FK `workspace_views(id)` ON DELETE CASCADE. |
| `pinned` | BOOLEAN | NO | false | |
| `hidden` | BOOLEAN | NO | false | |
| `sort_order` | INTEGER | NO | 0 | |
| `last_used_at` | TIMESTAMP | YES | — | |
| `created_at` | TIMESTAMP | NO | NOW() | |
| `updated_at` | TIMESTAMP | NO | NOW() | |

**Constraints:**
- `UNIQUE(user_id, view_id)` — name `workspace_view_user_prefs_user_view_uniq`.

**Indexes:**
- `(user_id, view_id)` — уже unique.
- `(view_id)` — для CASCADE и обратных запросов.
- `(user_id, last_used_at DESC) WHERE last_used_at IS NOT NULL` — для "Recently used".

### 11.3. ENUM creation order для миграции
1. `CREATE TYPE workspace_view_scope AS ENUM ('system', 'personal');`
2. Create `workspace_views`.
3. Create `workspace_view_user_prefs`.
4. Apply CHECK + UNIQUE partial indexes.

Down: drop tables + drop ENUM type.

---

## 12. Backend endpoints (locked)

Mount под `/api/workspace-views`. Все endpoints `auth + companyIdGuard`.

### 12.1. `GET /api/workspace-views?module=wms.documents&includeHidden=false`

**Query params:**
- `module` (required): `'wms.documents'`, etc.
- `includeHidden` (optional, default false): include views где `prefs.hidden=true`.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "module": "wms.documents",
      "key": "pz",
      "scope": "system",
      "name": "PZ — Receipts",
      "nameI18nKey": "workspaceViews.wms.documents.pz",
      "description": null,
      "icon": "Truck",
      "filter": { "where": [...] },
      "sort": [{"field":"createdAt","dir":"desc"}],
      "columns": null,
      "viewType": "list",
      "isDefault": false,
      "isLocked": true,
      "ownerUserId": null,
      "prefs": {
        "pinned": true,
        "hidden": false,
        "sortOrder": 2,
        "lastUsedAt": "2026-06-04T..."
      },
      "createdAt": "...",
      "updatedAt": "..."
    },
    ...
  ]
}
```

**Filtering logic:**
- Возвращает: system + personal-of-current-user, входящие в `module`.
- Если `includeHidden=false` → исключает views где `prefs.hidden=true`.
- **Default sort**: pinned first (by `prefs.sortOrder ASC`), затем по `lastUsedAt DESC NULLS LAST`, затем по `name ASC`.

### 12.2. `POST /api/workspace-views`

**Body:**
```json
{
  "module": "wms.documents",
  "name": "My drafts",
  "icon": "FileEdit",
  "description": null,
  "filter": { "where": [{"field":"status","op":"eq","value":"draft"}] },
  "sort": [{"field":"createdAt","dir":"desc"}],
  "columns": null
}
```

**Behavior:**
- Создаёт personal view (`scope='personal'`, `owner_user_id=req.user.id`, `key=null`, `is_locked=false`, `is_default=false`).
- Validation:
  - `module` required, регистрируется in backend registry (валидно только если модуль "известен").
  - `name` 1..120 chars, не пустой.
  - `filter` обязателен (минимум `{}` пустой объект).
  - Лимит **50 personal views per (user, module)** → 409 `PERSONAL_VIEW_LIMIT_EXCEEDED`.

**Response 201**: новая view DTO (без `prefs` блока — фронт зовёт touch + pin отдельно если нужно).

### 12.3. `PATCH /api/workspace-views/:id`

**Body** (partial — все опц):
```json
{
  "name": "...",
  "icon": "...",
  "description": "...",
  "filter": { ... },
  "sort": [ ... ],
  "columns": [ ... ]
}
```

**Behavior:**
- Только для personal views, принадлежащих текущему user'у.
- Для system views → 403 `SYSTEM_VIEW_NOT_EDITABLE`.
- Поля `scope`, `module`, `key`, `ownerUserId`, `isDefault`, `isLocked` менять нельзя — если переданы, игнорируются.

**Response 200**: обновлённая view DTO.

### 12.4. `DELETE /api/workspace-views/:id`

**Behavior:**
- Только personal-views, owned by `req.user.id`.
- System views → 403 `SYSTEM_VIEW_NOT_DELETABLE`.
- ON DELETE CASCADE убирает все `workspace_view_user_prefs` rows для этой view.

**Response 204** (no body).

### 12.5. `POST /api/workspace-views/:id/actions/pin`

**Body:**
```json
{ "pinned": true, "sortOrder": 3 }
```
- `pinned` (required, boolean).
- `sortOrder` (optional integer). Если не передан и `pinned=true` — bumped до `MAX(sortOrder)+1` для (user, module).

**Behavior:**
- Upsert `workspace_view_user_prefs` для (req.user.id, view.id). Создаст row если не было.
- Работает для **любой visible** view (system + personal). Не зависит от прав редактирования.

**Response 200**: `{ "prefs": { pinned, hidden, sortOrder, lastUsedAt } }`.

### 12.6. `POST /api/workspace-views/:id/actions/hide`

**Body:**
```json
{ "hidden": true }
```
- `hidden` (required boolean).

**Behavior:**
- Upsert prefs row.
- При `hidden=true` дополнительно auto-`pinned=false` (нельзя закреплённую сделать скрытой одновременно). Frontend контракт: если user закрепил и потом скрыл — pin снимается.

**Response 200**: `{ "prefs": { ... } }`.

### 12.7. `POST /api/workspace-views/:id/actions/touch`

**Body**: пусто.

**Behavior:**
- Upsert prefs row, `lastUsedAt = NOW()`.
- Используется фронтом при активации view (debounced 1s).

**Response 200**: `{ "prefs": { ..., lastUsedAt } }`.

### 12.8. Общие ошибки
- 401: нет токена / просрочен (стандартный auth middleware).
- 403: системные ограничения (`SYSTEM_VIEW_NOT_EDITABLE`, `SYSTEM_VIEW_NOT_DELETABLE`, `PERSONAL_VIEW_NOT_OWNED`).
- 404: view не существует или скрыта от user'а.
- 409: `PERSONAL_VIEW_LIMIT_EXCEEDED`, `UNKNOWN_MODULE`.
- 400: `VALIDATION_ERROR` (некорректный `filter`, `module`, `name`).

---

## 13. Frontend components (locked)

### 13.1. `WorkspaceViewPicker`

**Файл**: `client/src/components/common/WorkspaceViews/WorkspaceViewPicker.jsx`.

**Props:**
```ts
{
  module: string;                  // 'wms.documents'
  routeBase: string;               // '/main/wms/documents'
  activeViewId?: string | null;    // UUID, from ?viewId
  activeViewKey?: string | null;   // string, from ?view (system)
  onViewActivated?: (view) => void; // for telemetry / touch debounce
  onOpenManage: () => void;        // open WorkspaceViewsDrawer
  onCreateView?: () => void;       // Phase 4: open editor; null in Phase 2
}
```

**Поведение:**
- Загружает views через `useListWorkspaceViewsQuery({ module })`.
- Если visible views ≤ 6 → рендерит tabs strip.
- Если > 6 → рендерит dropdown trigger ("All documents ▾") + popup со списком + search-input.
- В конце списка/tabs всегда: action "Manage views" (вызывает `onOpenManage`).
- Если `onCreateView` передан, рядом с picker'ом — кнопка `+`.
- На клик view: меняет URL (`?view=...` или `?viewId=...`), зовёт `touch` action API через debounced 1s.

**Active view resolution** (фронтовая):
```
if (activeViewId)         → match by id
else if (activeViewKey)   → match by key && scope='system'
else                       → match by isDefault=true
```

### 13.2. `WorkspaceViewsSidebarSection`

**Файл**: `client/src/components/common/WorkspaceViews/WorkspaceViewsSidebarSection.jsx`.

**Props:**
```ts
{
  module: string;
  routeBase: string;
  collapsed: boolean;        // sidebar collapsed state
  styles: object;            // sidebar's CSS-module classes (для inherit)
}
```

**Поведение:**
- В expanded mode: рендерит до 5 pinned views под module-node. Каждая — `<NavLink>` с иконкой + label + (active highlight если URL matched).
- Если pinned > 5 — рендерит "+N more" кнопку, клик → open Manage drawer.
- Если pinned == 0 — рендерит ничего (module-node остаётся одиночной строкой).
- В collapsed mode: рендерит ничего (pinned views не помещаются). Hover на module-icon → старый `WorkspaceViewsPopover` (mini-flyout) показывает список pinned + "Open module".

### 13.3. `WorkspaceViewsDrawer` (Phase 3)

**Файл**: `client/src/components/common/WorkspaceViews/WorkspaceViewsDrawer.jsx`.

**Props:**
```ts
{
  module: string;
  open: boolean;
  onClose: () => void;
}
```

**Поведение:**
- Slide-in справа, width 420px.
- Загружает views с `includeHidden=true`.
- Список с per-row:
  - Badge: "System" / "Personal".
  - Иконка + name.
  - Pin/unpin toggle.
  - Eye-icon: hide/show toggle.
  - Trash-icon: delete (только для personal owned by me).
  - Edit-icon (pencil): inline rename для personal.
- Внизу drawer'а: кнопка "Create new view" → open `WorkspaceViewEditor` (Phase 4, до этого — disabled с подсказкой "Coming soon").

### 13.4. `WorkspaceViewEditor` (Phase 4)

**Файл**: `client/src/components/common/WorkspaceViews/WorkspaceViewEditor.jsx`.

**Props:**
```ts
{
  mode: 'create' | 'edit';
  module: string;
  initialView?: ViewDTO;          // для edit mode
  initialFilterFromUrl?: Filter;  // для create-from-current-filters
  onSave: (view) => void;
  onCancel: () => void;
}
```

**Поведение:**
- Modal/drawer (420-480px).
- Fields: name, icon (picker из ~20 топовых Lucide), description.
- Filter editor: MVP **plaintext JSON-textarea** (sic) — full filter builder — Phase 5+.
  - Альтернатива: в Phase 4 показывать read-only preview filter'а как chips, "Edit filter" disabled с подсказкой "Use page filters and click 'Save as view'".
- Sort + Columns — MVP read-only.
- На save: POST/PATCH endpoint.

---

## 14. RTK Frontend layer (locked)

Создать `client/src/store/rtk/workspaceViewsApi.js` (injected в `crmApi`):

```js
useListWorkspaceViewsQuery({ module, includeHidden })
useCreateWorkspaceViewMutation()
useUpdateWorkspaceViewMutation()  // body { id, ...patch }
useDeleteWorkspaceViewMutation()  // arg: id
usePinWorkspaceViewMutation()     // body { id, pinned, sortOrder }
useHideWorkspaceViewMutation()    // body { id, hidden }
useTouchWorkspaceViewMutation()   // body { id }
```

Tags: `WorkspaceViews:LIST:<module>` для invalidations.

---

## 15. Frontend selectors / helpers

```js
// client/src/utils/workspaceViews.js
resolveActiveView(views, urlViewId, urlViewKey) → view | null
resolveDefaultView(views) → view | null
groupViewsForSidebar(views, { max=5 }) → { pinned: [...], rest: [...], overflowCount }
groupViewsForPicker(views, { tabsThreshold=6 }) → { mode: 'tabs'|'dropdown', items: [...] }
```

---

## 16. Implementation phases (locked)

### Phase 1 — Backend foundation
**Goal:** schema + service + API + system views для `wms.documents` в БД.

**Deliverables:**
- Migration: создание `workspace_views` + `workspace_view_user_prefs`, ENUM, constraints, indexes.
- Sequelize models: `WorkspaceView`, `WorkspaceViewUserPref`.
- Service `workspaceViewsService`: list/create/update/delete/pin/hide/touch + ensure-system-views.
- Module registry (server-side): `systemViewsRegistry/wms.documents.js` с 7 system views (§2.2).
- Boot hook: `ensureSystemViewsForCompany(companyId)` вызывается при первом list-запросе на module для компании (lazy).
- Dynamic-placeholder resolver: 4 placeholder'а из §9.
- Endpoints в `routes/workspaceViews.router.js`, mount `/api/workspace-views` в `rootRouter`.
- Smoke `smokeWorkspaceViewsApi.js`: создать company + user, ensure system views (7 rows), create personal view, hit лимит (51-я → 409), pin/hide/touch, проверить fortified filter (`hidden` not in default list, в `includeHidden=true` — есть).

**Acceptance:**
- Все 7 endpoints возвращают 200/201/204/4xx согласно §12.
- `findOrCreate` ensure'а идемпотентен (повторный вызов не плодит system views).
- `PATCH/DELETE` на system view → 403.
- Personal view limit 50 строго enforced.
- Регрессии: `smokeWarehouseDocumentsList`, `smokeCostingWmsFlows` — без изменений.

### Phase 2 — Frontend foundation
**Goal:** `WorkspaceViewPicker` + sidebar pinned views работают для `wms.documents`.

**Deliverables:**
- RTK API slice `workspaceViewsApi.js` со всеми 7 хуками (§14).
- Helpers `utils/workspaceViews.js` (§15).
- Component `WorkspaceViewPicker` (§13.1).
- Component `WorkspaceViewsSidebarSection` (§13.2).
- В `WmsDocumentsPage`:
  - Удалить захардкоженный `switch(view)`.
  - В шапке page рендерить `<WorkspaceViewPicker module="wms.documents" routeBase="/main/wms/documents" ... />`.
  - URL `?view=` и `?viewId=` обрабатывать согласно §5.
  - Active view's `filter` транслировать в `useListWarehouseDocumentsQuery` (filter→params mapper — небольшой утилит per-module).
- В `Sidebar`:
  - Убрать захардкоженный `views: [...]` из `menu.js` (закомментить или удалить).
  - Под `wmsDocuments` item — рендерить `<WorkspaceViewsSidebarSection module="wms.documents" routeBase="/main/wms/documents" />`.
  - **Sidebar width расширить до 280px** (CSS variable).
- В i18n: добавить `workspaceViews.wms.documents.<key>` переводы для 7 system views в 4 локали.

**Acceptance:**
- На `/main/wms/documents` без `?view=` показывается default (`all`).
- Pinned (max 5) видны в sidebar, остальные — в picker.
- Picker: ≤6 views — tabs, >6 — dropdown.
- Pin/unpin из любой surface обновляет другую surface (RTK tag invalidation).
- `?view=pz` и `?viewId=<uuid>` корректно выбирают view.
- Build chain: `CI=false npm --prefix client run build` + `docker compose build frontend` — без новых ошибок.

### Phase 3 — Manage drawer
**Goal:** `WorkspaceViewsDrawer` (§13.3) с pin/hide/delete/rename.

**Deliverables:**
- Component `WorkspaceViewsDrawer`.
- Action `onOpenManage` в `WorkspaceViewPicker` (вызывает drawer).
- Inline-actions per row: pin/unpin, hide/unhide, delete (personal), rename inline (personal).
- "Create new view" кнопка disabled (`Coming soon` — это Phase 4).
- i18n: keys для drawer'а.

**Acceptance:**
- Открывается из picker'а и из sidebar'а ("+N more" overflow).
- Hide system view → она пропадает из picker и sidebar (после refetch).
- Delete personal view → она пропадает + cascade на prefs.
- Rename personal view → новое имя в picker.

### Phase 4 — Create personal view from current filters
**Goal:** кнопка `+` рядом с picker'ом → `WorkspaceViewEditor` (§13.4) с предзаполненным `filter` из текущего URL state.

**Deliverables:**
- Component `WorkspaceViewEditor` (модал, MVP-минимум: name + icon + read-only filter preview).
- Кнопка `+` в `WorkspaceViewPicker` (видна, если есть права создавать — в MVP всегда true).
- Маппер URL state → filter JSON (per-module helper).
- "Save as view" из page header (быстрый path — без открытия drawer'а).

**Acceptance:**
- Из текущей страницы со включёнными фильтрами (e.g. `?q=PZ-2026&type=PZ`) кнопка `+` создаёт personal view с этим filter'ом.
- View сразу появляется в picker (RTK invalidation).
- Hit лимита 50 → frontend показывает toast с `PERSONAL_VIEW_LIMIT_EXCEEDED`.

---

## 17. Что НЕ делаем в MVP (явно out-of-scope)

- `scope='company'` / `scope='team'`.
- Sharing personal views другим юзерам.
- View duplication / clone.
- Drag-and-drop reorder (sortOrder только через явный PATCH).
- View types кроме `list` (board/kanban/calendar/chart — Phase 6+).
- Audit log / change history.
- View packages / marketplace.
- Workspace export/import.
- Cmd-K палитра расширение (если в проекте есть Cmd-K — отдельная задача).
- Layout v3 (rail + contextual panel) — Phase 7 в V2-аудите.
- Расширение на crm.leads / crm.deals / oms.orders / pim.products — Phase 5 в V2-аудите (после стабилизации wms.documents).

---

## 18. Финальная команда «как имплементировать»

1. **Прочитать §11–§16** — это всё, что нужно для Phase 1+2.
2. Phase 1: backend, ~3-5 дней (включая smoke).
3. Phase 2: frontend, ~3-5 дней.
4. Phase 3: manage drawer, ~2-3 дня.
5. Phase 4: editor, ~2-3 дня.

Готово к старту. Никаких новых решений до Phase 5 не требуется.

---

> Этот документ — закрытая MVP-спецификация. Любые отклонения от §0..§17 — это change request, не «детали имплементации». Если по ходу Phase 1 выяснится, что нужно ещё одно поле или endpoint — это знак вернуться сюда и расширить spec, а не пилить «на лету».
