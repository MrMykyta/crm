# Workspace Views v2 — архитектурный аудит и переработка

> Статус: **audit + recommendation**. Никакого кода. Цель — спроектировать единый механизм Workspace Views для всей CRM (CRM/OMS/PIM/WMS/...) на десятилетие вперёд, не только закрыть пробелы текущей реализации в WMS.
> Дата: 2026-06-04.
> Связано: [`WMS_PLAN_REALIZATION.md`](./WMS_PLAN_REALIZATION.md), `client/src/components/common/WorkspaceViewsPopover/`, `client/src/config/menu.js`, `client/src/components/layout/Sidebar/`.

---

## 0. TL;DR

- **Текущее v1 — это «hover popover с захардкоженным списком».** Работает как proof-of-concept, но **архитектурно не масштабируется** на пользовательские views, многомодульную CRM и десятки/сотни views в одном модуле.
- **Корень проблемы #1**: views — это **не доменная сущность**, а массив в `menu.js`. Пользователь не может ничего сохранить, скрыть или переименовать. Расширение требует деплоя.
- **Корень проблемы #2**: hover-popover **не масштабируется по UX**: фрагильный hover-bridge, нет flip/scroll/keyboard, нет места под search/edit, оторван от навигации, недружелюбен к touch.
- **Корень проблемы #3**: sidebar **248px** не оставляет дыхания длинным меткам (`Налаштування користувача` = 24 символа, при этом по бокам ещё icon + padding). При нестинге views внутри sidebar'а места не хватит.
- **Корень проблемы #4**: текущая реализация **только для WMS**. Лиды, сделки, заказы, продукты, документы продаж — все требуют точно такой же механики. Если оставить как есть, мы получим N разных решений вместо одного.
- **Рекомендация**: переехать на **Variant D (комбинированный)** — Linear/Notion-style: рельс модулей + контекстная панель + in-page picker + Cmd-K. Views — нормальная доменная сущность в БД, с системными и пользовательскими, с per-user prefs (pin/hide/order). Sidebar расширить до **280px** + явный «pinned views» подраздел. Hover-popover **убрать** как primary навигацию (оставить только как secondary on icon-rail в collapsed state).

---

## 1. Что сейчас реализовано (короткий recap)

| Компонент | Файл | Что делает |
|---|---|---|
| Popover | `client/src/components/common/WorkspaceViewsPopover/{jsx,module.css}` | Portal-render, hover-bridge, glass-стиль, slide-in анимация `translateX(-16px → 0)`. |
| Sidebar обёртка | `client/src/components/layout/Sidebar/index.js` → `WorkspaceMenuLink` | Wrap-аем `<NavLink>` div'ом, держим `open` state и `closeTimer` (180ms), читаем активную view через `useLocation` + `?view=`. |
| Меню | `client/src/config/menu.js` | Один пункт `wmsDocuments` с **захардкоженным массивом** `views: [...]` (10 элементов). |
| Page-dispatcher | `client/src/pages/wms/WmsDocumentsPage/index.js` | `switch(view)` → ReceiptsListPage / ShipmentsListPage / ... / `UnifiedDocumentsView` для `all`. |
| API | `useListWarehouseDocumentsQuery` → `GET /api/wms/documents` | Возвращает unified row shape; views работают через `?view=` + query параметры. |

Конкретика по числам:
- Sidebar: `--sidebar-w: 248px`, `--sidebar-w-collapsed: 76px`. Icon 20px, gap 12px, item padding 8-12px → **под текст реально остаётся ≈ 170-190px**.
- Длиннейшие метки: `Налаштування користувача` (24 chars, UA), `Складські залишки` (17 chars, UA), `Корректировки RW/PW` (19 chars, RU). При 13.5px шрифте ≈ 14 chars per 100px → **24-символьные метки впритык**, без запаса под индикаторы/счётчики.
- Popover: `min-width: 240px`, `max-width: 320px`. Позиционирование — голое `r.right + 8`, **без overflow handling**: при scrolled sidebar или маленьком экране панель может уехать за нижний край и быть обрезанной. Нет flip-to-left, нет `max-height + scroll`.
- Меню v1: **5 секций, 23 item'а**. Реалистичный объём через год — 60+ item'ов (роли, разрешения, отчёты, finance, HR, помимо текущих модулей).

---

## 2. Аудит — проблемы текущей реализации

### 2.1. Views захардкожены в `menu.js`
**Симптомы:**
- Чтобы добавить «Документы за сегодня» — нужен PR, code-review, деплой.
- Один и тот же view одинаково выглядит у всех пользователей; нельзя скрыть «PZK» у роли, которая ими не пользуется.
- Пользователи (бухгалтер vs логистик vs продажник) видят одинаковую «свалку» views и не могут привести её под свою работу.
- Нет возможности **именовать**, **переупорядочивать**, **закреплять** или **расшаривать** views.
- Захардкоженные ключи (`view=pz`) пересекаются с user-defined именами → если завтра позволим user-defined, неизбежен конфликт неймспейсов.

**Архитектурный вывод:** Workspace View **должен быть** полноценной доменной сущностью в БД, не строкой в конфиге. Системные views — это просто «view с user_id=null, scope=system»; они отличаются от пользовательских только происхождением и правами на правку.

### 2.2. Hover popover плохо масштабируется
**Конкретные UX-провалы:**
1. **Fragile hover-bridge.** 180ms close-таймер + CSS-«bridge» 8px слева — рабочее решение для 3-5 элементов, но если view'ов 15-20, пользователь будет **постоянно случайно закрывать панель** при попытке перейти к нижним пунктам. Особенно при resize/scroll.
2. **Нет focus/keyboard.** Нет Tab-навигации, нет Esc, нет up/down → не accessible. Power-users (бухгалтеры) ненавидят.
3. **Нет search/filter внутри панели.** При 20+ views без поиска не найти нужный. Linear и Notion решают это inline-фильтром.
4. **Нет места под inline-действия.** Нельзя «Edit», «Duplicate», «Hide», «Set default» прямо из popover — некуда поместить.
5. **Touch-unfriendly.** На планшете и в touchscreen-кассах hover вообще не работает — popover не открывается без клика, что превращает его в кликабельное меню, но без anchor-семантики.
6. **Overflow на маленьких экранах.** При высоте 800px и большом списке popover уходит за viewport. Нет flip-up, нет scroll внутри.
7. **Оторван от навигации.** Панель появляется на пустом месте справа от меню — визуально не «дочернее» меню. Пользователь не понимает, что view-list связан с конкретным модулем.
8. **Невозможно «пристегнуть» popover.** Если пользователь работает с несколькими views поочерёдно, ему приходится каждый раз наводить курсор и ждать анимацию. Sticky-state нужен.

**Архитектурный вывод:** hover-popover как **primary** навигация для views — это **анти-паттерн** на CRM-масштабе. Он годится как **secondary**: rail в collapsed state + Cmd-K команда. Primary должно быть persistent.

### 2.3. Sidebar 248px не масштабируется на много модулей и views
**Конкретно:**
- Сейчас при 5 секциях × 4-5 items section имеем ≈ 25 элементов. Высоты 32-36px → **≈ 800-900px**. На MacBook (864px видимая высота) уже **скроллится**.
- Добавление views в sidebar (как pinned) увеличит этот объём вдвое. Без collapse — sidebar превратится в **бесконечный скролл**.
- Длиннейшие метки впритык. `Складские документы → Korekty PZ` (~28 chars вместе) в просто sidebar item не уместится.
- Collapsed (76px) показывает только иконки — но **иконки модулей в текущей `menu.js` дублируются** (`FileText` стоит у 5 пунктов, `Users` у 3). В collapsed состоянии **не отличить** «Контакты» от «Клиенты» от «Контрагенты».
- Нет иерархии: section-header + item — единственный уровень; nested views, **submenu**, accordions нигде не реализованы.

**Архитектурный вывод:** sidebar в его текущем виде упёрся в потолок. Нужно либо:
- расширить до 280-300px и явно вложить views с indent'ом (Notion-style), или
- разделить на **icon rail (44-56px)** + **контекстная панель (240-280px)** (Linear/VS Code/Figma-style).

Полу-мера «оставить 248px и спрятать всё в popover» — то, что сейчас. Это плохо масштабирует, что мы и наблюдаем.

### 2.4. Решение монолитное (только WMS), а нужно cross-module
**Конкретно:** механизм Workspace Views будет нужен в:
- **Leads** (My leads / Hot leads / Unassigned / Today's calls)
- **Clients/Counterparties** (My clients / By region / By account manager / VIP)
- **Deals** (My pipeline / This quarter / Stalled / Won this week)
- **Orders** (Today / Pending / Shipped / Returns)
- **Offers** (Draft / Sent / Accepted)
- **Documents** (Invoices / Drafts / Overdue)
- **Products** (Active / Low stock / By category)
- **Tasks** (My tasks / Overdue / Delegated)
- **WMS Documents** (текущий use-case)
- **Calendar/Tasks** (Today / Week / by assignee)

Если на каждый из этих модулей будем делать **свой** popover/menu/dispatcher — получим **8-10 параллельных систем**. UX consistency пропадает, разработка съедает время, баги размножаются.

Текущая попытка сделать `WorkspaceViewsPopover` универсальным компонентом — **правильная**, но дальше:
- меню всё равно дёргает захардкоженный `views: [...]`,
- нет общего бэкэнда для хранения,
- нет общего понимания «что такое view» (фильтр? колонки? сортировка? чарт vs таблица vs канбан?).

**Архитектурный вывод:** нужна **single platform layer** — модель данных + сервисы + 1-2 UI-сurface'а, которыми пользуются все модули. WMS — первый клиент, остальные подключаются последовательно.

---

## 3. Industry patterns — как это делают взрослые продукты

| Продукт | Где живут views | UI surface | System vs Personal | Что хорошо для нас |
|---|---|---|---|---|
| **Linear** | Per-team views («My Issues», «Active», «Backlog») как first-class. Custom views = saved filters + group + sort. | Sidebar section per team; нажать на view → переход. Cmd-K палитра для прыжков. Внутри view — `Views` picker сверху страницы. | System views shipped из коробки. Custom — на user level, можно расшарить team-у. | Cmd-K + persistent sidebar — **золотой стандарт** для power-users. Per-team scope (= per-company у нас). |
| **Notion** | Views принадлежат **базе данных** (странице). Каждая БД может иметь N views (Table, Board, Calendar, Gallery). | Tabs внутри page (горизонтально); добавить view = кнопка `+`. Sidebar — иерархия страниц, не views. | Все views персональные по умолчанию, но shared (в воркспейсе видны всем). Sort order — общий. | Views = per-resource, не per-user. Tabs внутри page — компактно, не загромождает sidebar. |
| **Airtable** | Views per table (Grid, Calendar, Gallery, Kanban, Form). Collaborative permissions (locked / personal / collaborative). | Sidebar внутри table (slide-out) со списком views. Edit/duplicate/share inline. | Каждый view имеет `creatorId` + sharing scope. | Богатые типы views (не только filtered table) — нам пригодится для канбан в Leads/Deals. |
| **Salesforce Lightning** | List Views per object (Account, Lead, Opportunity). | Dropdown сверху страницы со списком views. Pin views в `Recently Used`. | System (read-only out-of-box) vs My (personal) vs Public/Shared. Visibility: «Only I», «All users», «Specific groups». | **Sharing scopes** — критично для multi-tenant. Visibility rules. |
| **HubSpot** | Filtered views per object (Contacts, Companies, Deals). Limit 50 per user. | Toolbar dropdown + favorites stars. | Private / Team / Everyone. Pinned to top of dropdown. | **Limit + sharing** — гигиена storage. Pin-to-favorites. |
| **Pipedrive** | Filters (= saved filter) per resource. | «Filter» dropdown в page header + saved filters list. | Private vs Shared. Favorites star. | Простой, рабочий, минимальный feature set — хороший MVP-ориентир. |
| **Microsoft Dynamics 365** | System Views (solution-managed) vs Personal Views per entity. | Dropdown в page header, + Advanced Find для построения нового. | Solution-aware (system, package). Personal — owned by user. Sharing via security roles. | **Solution/package model** — если будем продавать модули по подпискам, view'ы инсталлируются с модулем. |
| **Odoo** | `ir.filters` — domain (filter) + context (sort, group). Filter per model. | Filter dropdown в search-bar; favorites + share. | User-owned + optional `user_id=null` (global). Group-based sharing. | Один backend object под views для всех модулей — **наш план**. |
| **monday.com** | Views per board (Main Table, Kanban, Timeline, Calendar...). | Tabs внутри board. View permissions per role. | View ownership; permissions cascade с board. | Tabs паттерн + view as a «type» (table/kanban/calendar). |
| **Slack** | Channel sidebar с user prefs (hide/star/order); per-channel `notification` overrides. | Sidebar с persistent channel list + sections (user-defined). | Канал — общая сущность; что показывать в sidebar — личное предпочтение. | **User prefs отдельно от объекта** — то, что нам нужно для `hidden/pinned/order`. |
| **VS Code** | Activity Bar (rail) + Side Bar (контент). Extensions добавляют views в side bar. | Rail 48px → клик меняет содержимое side bar. | Системные views (Explorer, Search) + extension-defined views. User может скрыть/перетащить. | **Rail + contextual panel** — паттерн для будущей CRM-платформы. |

### 3.1. Сквозные выводы из обзора
1. **Views — не строки в конфиге, а доменная сущность.** Все крупные продукты хранят их в БД, в виде «filter + sort + columns + visualization + ownership + visibility».
2. **Sidebar + per-page picker — лучше, чем popover.** Никто из крупных не делает hover-popover как primary для views. Linear/Notion/Airtable/Salesforce — все используют либо постоянный sidebar, либо tabs/dropdown в шапке страницы. Hover-popover мы видим только как secondary (например, hover-tooltip на свернутом sidebar).
3. **Pin / hide / reorder = per-user prefs, отдельная таблица.** Объект view общий; user prefs — индивидуальные.
4. **System views существуют по умолчанию, но скрываемы.** Salesforce/Dynamics/Linear — все имеют system views, но user может их hide.
5. **Cmd-K палитра — необходимость.** Power-users (бухгалтер, оператор склада) предпочитают keyboard над mouse.
6. **Views могут быть разных types**: filtered list, board (kanban), calendar, chart. На уровне domain'а нам нужно заложить enum, даже если в MVP только `list`.

---

## 4. Workspace View как доменный объект

### 4.1. Минимальная модель данных (предложение, для будущей миграции)

**`workspace_views`** — общая таблица для всех модулей:

| Колонка | Тип | Семантика |
|---|---|---|
| `id` | UUID PK | |
| `company_id` | UUID FK companies | Multi-tenant scope. |
| `module` | STRING(64) | Идентификатор «куда» применима view: `wms.documents`, `crm.leads`, `oms.orders`, `pim.products`. Свободный namespace, регистрируется фронтом + бэком. |
| `key` | STRING(64) | Машинный идентификатор внутри module (`all`, `pz`, `my-drafts`). Уникален per (company, module). |
| `scope` | ENUM | `system` / `company` / `team` / `personal`. См. §5. |
| `owner_user_id` | UUID NULL | Кто создал/владеет (для `personal`/`team`). NULL для `system`/`company`. |
| `team_id` | UUID NULL | Для `team`-scope. |
| `name` | STRING(120) | Отображаемое имя (или ключ i18n для `system`). |
| `name_i18n_key` | STRING(120) NULL | Если view системная и должна локализоваться. |
| `description` | TEXT NULL | Подсказка. |
| `icon` | STRING(40) NULL | Имя Lucide-иконки (`Inbox`, `Star`, `Truck`...). |
| `filter` | JSONB | Сериализованный фильтр-объект, понятный модулю (`{type:'PZ', status:'posted', ...}`). |
| `sort` | JSONB | Сортировка (`[{field:'createdAt', dir:'desc'}, ...]`). |
| `columns` | JSONB NULL | Видимые колонки + порядок (для list-views). |
| `viewType` | STRING(16) | `list` / `board` / `calendar` / `chart`. MVP: только `list`. |
| `is_default` | BOOLEAN | Default view, если ничего не выбрано. Один на (module, company). |
| `is_locked` | BOOLEAN | Системные views: пользователь не может редактировать, но может скрыть/закрепить. |
| `created_at`, `updated_at` | TIMESTAMP | |

Индексы:
- `(company_id, module)` для page load.
- `(company_id, module, key)` UNIQUE — защита от дублей.
- `(owner_user_id)` для «my views».

### 4.2. Per-user prefs (отдельная таблица)

**`workspace_view_user_prefs`** — для hide / pin / order, **не** для самой view:

| Колонка | Тип | Семантика |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `view_id` | UUID FK workspace_views | |
| `hidden` | BOOLEAN | Скрыта в sidebar этому юзеру. |
| `pinned` | BOOLEAN | Закреплена (вверху списка / в sidebar). |
| `sort_order` | INTEGER | Позиция в списке (только когда `pinned`). |
| `last_used_at` | TIMESTAMP | Для «recent views». |
| `created_at`, `updated_at` | TIMESTAMP | |

Уникальный ключ: `(user_id, view_id)`.

**Почему отдельная таблица**: отделение объекта от prefs позволяет:
- расшаривать views без «оптимизации» личного порядка,
- легко мигрировать (`workspace_views` стабильна, prefs — изменчивы),
- персональные действия (pin/hide) не блокируют чужой view object.

### 4.3. Опциональные расширения (v2/v3)

- `workspace_view_acl`: фine-grained permissions (читать/редактировать/удалять/расшарить) для `team`-scope с группами.
- `workspace_view_audit`: лог изменений (Salesforce-style audit trail).
- `workspace_view_packages`: «пакеты» views, поставляемые с модулем — для нашего будущего «marketplace» модулей.

### 4.4. Что хранить в `filter` JSONB
Модуль-специфичный, но с общей формой:
```json
{
  "where": [
    {"field": "type", "op": "in", "value": ["PZ", "WZ"]},
    {"field": "status", "op": "eq", "value": "posted"},
    {"field": "createdAt", "op": "gte", "value": "$today_start"}
  ],
  "search": null,
  "params": {"warehouseId": "$user_default_warehouse"}
}
```
Особенности:
- `$today_start`, `$current_user`, `$user_default_warehouse` — **dynamic placeholders**, резолвятся на бэке per-request. Без них view «Мои документы» либо невозможен, либо требует пересохранения каждый день.
- Бэк-сервис per-module имеет mapper «filter JSON → SQL where». Уже есть в `warehouseDocumentsService`, можно обобщить.

---

## 5. System / Company / Team / Personal — четыре уровня видимости

| Scope | Кто видит | Кто редактирует | Use-case |
|---|---|---|---|
| **`system`** | Все в компании | Никто (или только admin модуля через миграцию) | «Все документы», «PZ», «WZ» — out-of-box. Скрываемы per-user через prefs. |
| **`company`** | Все в компании | Admin компании | «Документы склада Łódź», созданный админом и доступный всем сотрудникам. |
| **`team`** | Участники team | Owner + team admins | «Документы команды отгрузки» — внутри отдела. (v2/v3, опционально.) |
| **`personal`** | Только owner | Owner | «Мои черновики», «Сегодня». User создаёт, никто кроме него не видит. |

**Sharing**: переход `personal → team/company` — действие «расшарить» (Salesforce-style). После расшаривания owner всё ещё имеет приоритет на правку.

**Default view**: ровно одна view с `is_default=true` на (module, company). Если у user'а ещё нет prefs — он попадает в default.

**Per-user override default**: prefs может содержать «default_view_id» как поле — user может выбрать свою default per-module (HubSpot pattern).

---

## 6. Sidebar — что менять и до какой ширины

### 6.1. Аудит конкретных размеров

| Параметр | Сейчас | Боль |
|---|---|---|
| Ширина expanded | 248px | Длинные метки (24 chars UA) впритык. На нестинг views нет дыхания. |
| Ширина collapsed | 76px | Иконки + label у нескольких ширина одинаковая. В collapsed = только иконка. |
| Item высота | 32-36px | Достаточно. |
| Icon size | 20px | Норм. |
| Gap icon-label | 12px | Норм. |
| Padding inline | 8-12px | Норм. |
| Section header | есть | Норм. |
| Nested item | **нет** | Views некуда вкладывать визуально. |

### 6.2. Сценарии ширины

**Вариант W1 — оставить 248px:**
- Плюсы: минимум миграции, привычка.
- Минусы: нет места под счётчики (`3` непрочитанных), длинные UA-метки впритык, nested views — невозможны без жертв.

**Вариант W2 — расширить до 280px (PROPOSED):**
- Плюсы: +32px дают воздух под счётчики, индикаторы, nested views с indent 12-16px.
- Минусы: −32px от content area — терпимо на ≥1440px дисплеях, тесно на 1280px.

**Вариант W3 — rail (48px) + контекстная панель (240-260px) = 288-308px total:**
- Плюсы: Linear/VS Code/Figma-стандарт. Рельс с иконками модулей всегда виден; контекстная панель меняется per-module и **естественно** держит views. Collapse = только рельс.
- Минусы: больший рефакторинг. Меню `menu.js` становится двухуровневым: `module` (рельс) + `items` (панель). Section header теряет смысл.

**Рекомендация**: для v2 идти на **W2 (280px)**, для v3 (через 3-6 месяцев, когда модулей станет 10+) — мигрировать на **W3 (rail + panel)**. Это эволюционный путь без болезненного переезда.

### 6.3. Что показывать в sidebar

С учётом scopes:
- Sidebar показывает **module nodes** (Leads, Deals, Documents, Stock balances, Warehouse docs, ...).
- Внутри module-node — **pinned views** этого пользователя (только pinned).
- Все остальные views доступны через:
  - **In-page picker** (tabs/dropdown сверху страницы модуля),
  - **Cmd-K палитра**.

Это **не** «sidebar показывает 10 views» — это «sidebar показывает 1-3 закреплённых, остальные — внутри страницы». Salesforce / Linear делают именно так.

### 6.4. Иконки

Дублирование (`FileText` у 5 пунктов) → пересмотреть набор. Lucide достаточно богат: `Inbox`, `Folder`, `Archive`, `Truck`, `Package`, `ClipboardCheck`, `Receipt`, `ShoppingBag`, etc. На rail (collapsed/W3) **уникальность иконок критична** — это единственный визуальный идентификатор.

---

## 7. Сравнение 4 вариантов навигации

### 7.1. Variant A — Hover Flyout (то, что сейчас)

**Как работает:** курсор над пунктом меню → popover справа с views.

| Плюс | Минус |
|---|---|
| Минималистичный sidebar. | Hover-bridge fragile. |
| Один компонент в одном месте. | Нет focus/keyboard/touch. |
| Анимация ощущается «лёгкой». | Нет места под search/edit/inline-actions. |
| | Overflow без flip/scroll. |
| | Оторван от навигации (не «дочернее» меню). |
| | Не работает в collapsed (76px) state. |
| | Не дружит с большим списком (15+ views). |

**Вердикт:** **только как secondary** (например, mini-tooltip на icon-rail в collapsed state). Не primary.

### 7.2. Variant B — Collapsible Submenu (Notion / VS Code Explorer)

**Как работает:** клик по «Складские документы» в sidebar → раскрывается accordion с views под ним.

| Плюс | Минус |
|---|---|
| Persistent (не закрывается). | Если views много, sidebar становится «бесконечным скроллом». |
| Keyboard-friendly. | Глобальный sidebar не помещает 5 модулей × 10 views = 50 items без скролла. |
| Привычная парадигма (file explorer). | На collapsed (76px) submenu не помещается. |
| Хороший fit для **pinned views**. | Чтобы увидеть все views модуля, нужно «развернуть» — много кликов. |

**Вердикт:** **хороший паттерн для pinned views внутри sidebar**, но не годится для «полного» каталога views. Sidebar превращается в портянку.

### 7.3. Variant C — Workspace Drawer (HubSpot side panel, Linear command-K)

**Как работает:** клик по модулю → выезжает широкая (~360-480px) панель/drawer с полным списком views, search, edit-actions, pin/hide.

| Плюс | Минус |
|---|---|
| Много места под views + search + edit. | Двух-шаговая навигация: открыть drawer → выбрать view. |
| Persistent, не закрывается случайно. | Закрывать вручную. |
| Touch-friendly. | Требует extra-real estate (на 1280px экранах перекрывает контент). |
| Поддерживает inline-actions. | UX-непривычно (не file explorer, не tabs). |

**Вердикт:** отличный «manage views» surface, но как primary navigation медленный. Хорошо подходит для **secondary**: «Manage views» / «Edit views» кнопка, которая открывает drawer.

### 7.4. Variant D — Combined (RECOMMENDED)

**Композиция:**
1. **Sidebar** = модули (как icons + labels) + **3-5 pinned views** под каждым модулем (collapsible submenu, Variant B).
2. **In-page picker** в шапке страницы каждого модуля: tabs или dropdown со всеми views модуля + кнопка `+` для создания (Notion/Salesforce-style).
3. **Cmd-K палитра** для прыжков по views (`gv` → list views → fuzzy search → enter).
4. **«Manage views» drawer** (Variant C) для массового управления, pin/hide/share/edit (вызывается из in-page picker или из settings).
5. **Hover-tooltip** на collapsed sidebar — fallback (Variant A reused) для квикта в свёрнутом состоянии.

| Поверхность | Кто использует | Как часто |
|---|---|---|
| Sidebar (pinned) | Все | Постоянно |
| In-page picker (tabs/dropdown) | Все | Часто |
| Cmd-K | Power-users | Часто |
| Manage drawer | Admins / поверхностно — все | Редко (при настройке) |
| Hover-tooltip (collapsed) | Когда sidebar свёрнут | Редко |

**Каждая поверхность решает свою задачу.** Это паттерн Linear / Salesforce / monday.com.

| Плюс | Минус |
|---|---|
| Каждый use-case покрыт правильной поверхностью. | Больше компонентов разработать (но reusable). |
| Масштабируется на сотни views и десяток модулей. | Больше документации/onboarding. |
| Keyboard, touch, accessible. | |
| Cross-module — всё единое. | |

**Вердикт:** **рекомендованная стратегия для CRM-платформы**.

---

## 8. Рекомендованная архитектура (концептуально)

### 8.1. Backend

**Доменная модель (см. §4):**
- `workspace_views` — общая таблица для всех модулей.
- `workspace_view_user_prefs` — per-user pin/hide/order.

**Сервис `workspaceViewsService`:**
- `list({ companyId, userId, module })` → объединяет system + company + personal views для этого user'а, применяет prefs (hidden/pinned/order), возвращает упорядоченный список.
- `getById({ companyId, viewId, userId })` → одна view с правами доступа.
- `create({ companyId, userId, module, name, filter, sort, columns, scope })` → создание.
- `update`, `delete`, `share` (changes scope), `setDefault`, `togglePin`, `toggleHide`, `reorder`.
- Резолвер dynamic placeholders (`$current_user`, `$today_start`).

**Контроллер + endpoint:**
- `GET /api/workspace-views?module=wms.documents` — список для текущего user'а.
- `POST /api/workspace-views` — создать.
- `PATCH /api/workspace-views/:id` — обновить.
- `DELETE /api/workspace-views/:id`.
- `POST /api/workspace-views/:id/actions/pin`, `/hide`, `/share`, `/set-default`, `/duplicate`.

**Module-side resolver:**
- Каждый модуль (WMS, Leads, Deals...) экспортирует mapper: «filter JSON → params для своего listing endpoint». Сейчас WMS-DOCS-2 уже принимает `type/status/search/warehouseId/dateFrom/dateTo` — он органично примет view-filter.
- Регистрация модуля: `registerModule('wms.documents', { defaultFilterShape, fieldRegistry, supportedSorts, ... })` — статическая мета, не БД.

### 8.2. Frontend

**Слой данных:**
- RTK API slice `workspaceViewsApi`:
  - `useListWorkspaceViewsQuery({ module })`
  - `useCreateWorkspaceViewMutation`, `useUpdateWorkspaceViewMutation`, etc.
- Selector `selectPinnedViewsByModule(module)` — для sidebar.

**Компоненты (универсальные, не WMS-specific):**
- `<WorkspaceViewPicker module={...} />` — in-page picker (tabs или dropdown), Notion-style.
- `<WorkspaceViewsSidebarSection module={...} />` — подсекция в sidebar с pinned views (Variant B сокращённый).
- `<WorkspaceViewsDrawer module={...} />` — Variant C, manage screen.
- `<WorkspaceViewEditor view={...} />` — форма редактирования (фильтр-builder, имя, scope, columns).
- Расширение `<CommandPalette />` (если есть) или новый компонент: «Workspace views» категория в Cmd-K.

**Sidebar:**
- `menu.js` упрощается: только модули, без захардкоженных views.
- Каждый модуль может иметь optional `viewsModuleKey: 'wms.documents'` — sidebar секция подтягивает pinned views из `workspaceViewsApi` под этот module key.
- Иконки модулей — пересмотр для уникальности.

**Hover-popover (текущий):**
- **Удалить** как primary surface.
- **Опционально** оставить как mini-tooltip для collapsed sidebar — переименовать в `<SidebarMiniFlyout />`, не путать с views.

### 8.3. Page-dispatcher для модуля

- `/main/wms/documents` остаётся одной страницей.
- Внутри страницы — `<WorkspaceViewPicker module="wms.documents" />` в page header.
- Активная view → её `filter` JSON → передаётся в `useListWarehouseDocumentsQuery` как параметры.
- `?view=<view_id>` (UUID) или `?view=<slug>` (для системных). Slug удобнее для шаринга URL'ов.
- При смене view URL обновляется (история навигации сохраняется).

---

## 9. План внедрения по этапам

### Phase 0 — заземление (1-2 дня, **до** любого UI)
- Документировать модель данных (этот файл — основа).
- Закрыть открытые вопросы (раздел 10).
- Спроектировать registry of modules (`wms.documents` keys, field schema, sorts).

### Phase 1 — Backend foundation (3-5 дней)
- Миграция: `workspace_views` + `workspace_view_user_prefs`.
- Sequelize-модели + сервис.
- Seed для **system views** WMS: `all`, `pz`, `wz`, `mm`, `rw`, `pw`, `inventory` (то, что сейчас в `menu.js`).
- API endpoint `GET/POST/PATCH/DELETE /api/workspace-views`.
- Smoke: создать company, list system views, создать personal view, pin/hide, list для другого user'а (изоляция prefs).

### Phase 2 — Frontend foundation (3-5 дней)
- RTK slice + hooks.
- Универсальный `<WorkspaceViewPicker />`.
- Подключить к `/main/wms/documents` (заменить захардкоженный switch на picker + dynamic filter mapping).
- Cmd-K палитра расширить (если есть) или создать lite-версию.
- Sidebar: убрать захардкоженный `views` массив; добавить рендер `pinnedViews` через API.

### Phase 3 — Sidebar widening (1 день)
- Расширить sidebar до 280px.
- Пересмотр иконок (уникальность).
- Длинные метки + truncate с `title` tooltip'ом.

### Phase 4 — Manage drawer + sharing (3-5 дней)
- `<WorkspaceViewsDrawer />`: список всех views, pin/hide/duplicate/share/rename/delete inline.
- Sharing UI: scope picker (personal → company → team).
- View editor: фильтр-builder, имя, columns, sort.

### Phase 5 — Расширение на CRM/OMS/PIM (по 2-3 дня каждый)
- Leads: `crm.leads` module key, system views («My leads», «Hot», «Unassigned»).
- Deals: `crm.deals`, system views по статусам и owner'у.
- Products: `pim.products`, system views по категориям.
- Orders, Offers, Invoices, etc.
- На этом этапе платформа уже доказала себя, добавление модуля = только seed + меппер фильтра.

### Phase 6 — Power-features (после v1 GA)
- View types: board (Kanban), calendar, chart.
- Team-scope + team_id из roles.
- View packages (для будущего marketplace).
- Workspace export/import.
- Audit trail.

### Phase 7 — Layout v3 (через 3-6 месяцев)
- Migration to rail + contextual panel (W3) — когда модулей станет 10+.
- Не блокирует ничего из вышеперечисленного.

---

## 10. Открытые вопросы / решения для product / design

1. **Scope в MVP**: делать ли team-scope сразу или оставить только system/company/personal? Рекомендую **2 уровня (system + personal)** в MVP, добавить company/team в v2.
2. **Sharing UI**: разрешить пользователю шарить свою view другому конкретному пользователю (direct share) или только через переключение scope на company-wide?
3. **Лимит views per user**: HubSpot ставит 50. У нас? Рекомендую soft-limit 100 в MVP, с предупреждением выше.
4. **Default view**: один per (company, module) или per-user override? Рекомендую: company-wide default + per-user override в prefs.
5. **Sidebar pinned limit**: сколько pinned views максимум в sidebar под одним модулем? 5-7 — рекомендую (Linear style).
6. **In-page picker**: tabs (горизонтально) или dropdown? Tabs только когда views ≤ 6; dropdown — когда больше. Можно делать гибрид: до 6 — tabs, дальше — overflow «...» dropdown.
7. **Cmd-K**: уже есть в проекте? Если нет — отдельная задача. Без него v2 жизнеспособен, но power-users пострадают.
8. **Dynamic placeholders**: какие резолверы важны для MVP? Минимум: `$current_user`, `$today_start`, `$today_end`, `$user_default_warehouse`.
9. **Views в URL**: использовать UUID (`?view=abc-def`) или slug (`?view=my-drafts`)? Slug удобнее для шаринга, но требует уникальности на user/company scope.
10. **Sidebar width расширение**: 280px сейчас (W2) или сразу замахиваться на W3 (rail+panel)? Рекомендую W2 → W3 через 3-6 месяцев.
11. **i18n у user-defined views**: переводить ли name? Рекомендую нет — это user-string, на языке создателя.
12. **Custom icons**: разрешить ли user'у выбирать иконку для своей view? Lucide-набор большой; в MVP можно дать picker из 20-30 топовых.

---

## 11. Финальная рекомендация

**Перейти на Variant D (combined)** с поэтапным rollout:
1. Сначала backend foundation + replace захардкоженных WMS views на DB-backed (Phase 1 + 2).
2. Sidebar 280px + sidebar pinned views (Phase 2 + 3).
3. Manage drawer + view editor + sharing (Phase 4).
4. Cross-module rollout (Phase 5).
5. Layout v3 — только когда модулей станет 10+ (Phase 7).

**Текущий `WorkspaceViewsPopover` — не выкидывать** (это reusable mini-flyout для collapsed sidebar), но **снять с него роль primary navigation**. Меню `menu.js` упростить — захардкоженные `views: [...]` уйдут в БД.

**Главный сдвиг сознания** — view это **доменный объект**, не UI-конфиг. Это меняет всё: storage, API, sharing, lifecycle, аудит, multi-tenancy. И именно это превращает Workspace Views из «удобной фишки WMS» в **платформенную возможность** CRM, которая работает одинаково в Leads/Deals/Orders/WMS/Tasks/Products через одну реализацию.

---

> Этот документ — архитектурная база. Никакого кода, миграций, UI-изменений на данном шаге. Следующий шаг — согласовать §10 «Открытые вопросы» с product/design, после чего стартовать **Phase 1 (Backend foundation)** по §9.
