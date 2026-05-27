# Orders & Offers Implementation Plan

Документ описывает план полной реализации модулей **Orders / Zamówienia** и **Offers / Oferty** в текущем CRM-проекте: что переиспользуется, что переписывается, какие изменения нужны в backend и frontend, в каком порядке и с какими acceptance-критериями.

Проект: монорепо `crm` (Node.js + Express + Sequelize/PostgreSQL + Mongo, React 19 + RTK Query). Конвенции — см. `CLAUDE.md` в корне.

---

## 1. Current Project Analysis

### 1.1 Backend — что уже есть

**Модели (Sequelize, `server/src/models/oms/`):**
- `offer.js`, `offeritem.js` — зрелые модели с audit-fields (createdBy/updatedBy/sentBy/acceptedBy/...), snapshot-полями товара, JSONB `meta`, `billing/shippingAddressSnapshot`, virtual `customerId`/`currencyCode` для обратной совместимости, `paranoid: true`.
- `order.js`, `orderitem.js` — зрелые: `number`, `source_offer_id`, `customer_id`, `contact_id`, `owner_id`, статусы (`status`, `paymentStatus`, `fulfillmentStatus`), таймштампы (`placedAt`, `confirmedAt`, `shippedAt`, `completedAt`, `cancelledAt`), totals (`totalNet`, `totalTax`, `totalGross`).
- `orderevent.js`, `ordernote.js` — таблицы событий и заметок к заказу.
- `discount.js`, `coupon.js`, `promotion.js`, `creditnote.js`, `package.js`, `invoice.js`, `payment.js` — связанные сущности.

**Миграции (`server/src/migrations/`):**
- `20250822151110-create-offer.js`, `20250822151312-create-order.js`
- `20250827151117-create-offer-item.js`, `20250827151318-create-order-item.js`
- `20250827151625-create-order-event.js`, `20250827151631-create-order-note.js`
- `20260422170000-alter-offers-stage1-foundation.js`, `20260422171000-alter-offer-items-stage1-foundation.js`
- `20260422172000-alter-orders-offer-conversion-foundation.js` (добавляет `number`, `source_offer_id`, индекс `orders_company_number_uniq`), `20260422173000-alter-order-items-offer-conversion-foundation.js`
- `20260423000500-fix-offer-items-variant-nullable.js`
- `20260424120000-create-company-order-settings.js`, `20260424143000-create-company-offer-settings.js`

**Зрелые сервисы (НЕ ТРОГАТЬ):**
- `server/src/services/oms/offerService.js` (~1675 строк) — полная реализация: list/get/create/update/delete с DTO-маппингом, status state machine (`draft → sent → viewed → accepted/rejected/expired/cancelled`), `saveOfferItems` (replace-all), totals (`calculateOfferItemTotals` + `calculateOfferTotals`), `duplicateOffer`, `convertOfferToOrder`, eventService логирование, валидация ссылок на counterparty/contact/owner/deal в company-scope.
- `server/src/services/crm/documentNumberingService.js` — `generateNextDocumentNumber` поддерживает типы `QUOTE` и `ORDER` с pattern-токенами `{YYYY}/{MM}/{SEQ:n}`, unique-constraint retry-loop.
- `server/src/services/crm/companyOfferSettingsService.js`, `companyOrderSettingsService.js` — annotations + nuumbering UI mirror.
- `server/src/services/crm/documentConversionConfig.js` — правила `QUOTE → ORDER`, `QUOTE → INVOICE`, `ORDER → INVOICE`.

**Контроллеры/роутеры (готовы):**
- `server/src/controllers/oms/Offer.controller.js` — тонкие хэндлеры.
- `server/src/routes/oms/offerRouter.js` — REST + actions (`/actions/{send,view,accept,reject,cancel,expire,duplicate,convert-to-order}`), `validateBody`/`validateQuery`/`authorize`.
- `server/src/schemas/offerSchema.js` — Joi-схемы create/update/listQuery/saveItems/actionPayload/duplicatePayload/convertPayload.

**Контроллеры/роутеры Orders — старые / частичные:**
- `server/src/services/oms/orderService.js` — ~175 строк примитивной логики (см. ниже что не так).
- `server/src/controllers/oms/Order.controller.js` — базовый CRUD + `fromOffer`.
- `server/src/routes/oms/orderRouter.js` — НЕ смонтирован в `rootRouter.js`. Лишний `companyIdGuard`. Без `authorize()` и Joi.
- `server/src/schemas/orderSchema.js` — старый формат (`body: Joi.object(...)`), несовместим с `validateBody` middleware.
- `server/src/routes/oms/paymentRouter.js` — содержит баг (`router.get/post` вместо `paymentRouter`), но это вне scope этого плана.

**Permissions (ACL):**
В `offerRouter.js` используются `offer:read`, `offer:create`, `offer:update`, `offer:delete`, `offer:convert`. Аналогичные нужны для `order:*` и должны быть посеяны в системе ACL/permission ролей.

**Root-router (`server/src/routes/rootRouter.js`):**
- `/offers` смонтирован → `oms/offerRouter`.
- `/orders` — НЕ смонтирован (это нужно исправить).

### 1.2 Frontend — что уже есть

**Реализованные модули (эталон стиля):**
- `client/src/pages/CRM/Counterparty/{CounterpartiesPage, CounterpartyDetailPage}` — список + детально, схема `EntityDetailPage` + `ListPage` + `FilterToolbar`.
- `client/src/pages/PIM/Product/{ProductsPage, ProductDetailPage}` — то же.
- `client/src/pages/documents/{DocumentsListPage.jsx, DocumentCreatePage.jsx, DocumentDetailsPage.jsx, DocumentPrintPage.jsx}` — наиболее близкий референс для Orders/Offers (документы с позициями, totals, конвертация).
- `client/src/components/documents/*` — `DocumentForm.jsx`, `DocumentHeader.jsx`, `DocumentItemsTable.jsx`, `DocumentMetaForm.jsx`, `DocumentPreview.jsx`, `useDocumentFormState.js`. Можно переиспользовать паттерны, **но Orders/Offers — отдельная сущность со своими API**, копипастить логику Document не нужно.

**Shared UI (использовать как есть):**
- `components/data/ListPage/index.js` + `components/data/DataTable` — таблица с `REGISTRY` источников, column views, фильтры, пагинация. Нужно зарегистрировать `orders` и `offers` источники.
- `components/data/DetailTabs/index.js` — табы внутри detail-страницы.
- `components/filters/FilterToolbar` — toolbar с фильтрами/поиском/select-ами.
- `components/buttons/AddButton/AddButton` — основной кнопка-плюс.
- `components/Modal` — модалки в стиле проекта.
- `components/inputs/RadixSelect` — селекты.
- `pages/_scaffold/EntityDetailPage.js` — каркас detail-страницы (табы, autosave, draft).
- `hooks/useGridPrefs.js` — column prefs (resize/order/visibility).
- `hooks/useOpenAsModal.js` — навигация modal vs. full page.

**Frontend Orders/Offers — отсутствуют:**
- `client/src/pages/oms/` — папка ПУСТАЯ.
- Нет RTK-слайсов `ordersApi.js` и `offersApi.js`.
- В `client/src/config/menu.js` — нет пунктов Orders/Offers.
- В `client/src/App.js` — нет роутов `/main/oms/orders|offers`.
- В `client/src/store/rtk/realtime.js` — нет маппинга событий `order.*` / `offer.*` → tag invalidations.

**RTK Query (`client/src/store/rtk/`):**
- `crmApi.js` — корневой `createApi`. В `tagTypes` уже зарезервированы `Offer`, `OfferList`, `Order` (нужно добавить `OrderList`). Endpoints добавляются через `crmApi.injectEndpoints` — см. `documentsApi.js`, `counterpartyApi.js`.
- `documentsApi.js` — эталон API-файла (list/get/create/update + convertDocument + getDocumentRenderTemplate).
- `realtime.js` — обрабатывает SSE-события и инвалидирует tag-ы.

**i18n:**
- `client/src/i18n/locales/{en,pl,ru,ua}.json` — нужно добавить ключи `menu.orders`, `menu.offers`, `oms.orders.*`, `oms.offers.*`.

### 1.3 Что переиспользуется

Backend:
- ВСЯ Offers backend-инфраструктура (`offerService.js`, `Offer.controller.js`, `offerRouter.js`, `offerSchema.js`) — НЕ ТРОГАЕМ, расширяем только `convertOfferToInvoice`.
- Модели Order/OrderItem/OrderEvent/OrderNote + миграции — НЕ ТРОГАЕМ.
- Numbering: `documentNumberingService.js` с типами `QUOTE`, `ORDER`.
- Conversion config: `documentConversionConfig.js`.
- Company settings: `companyOfferSettingsService`, `companyOrderSettingsService`.
- Invoice service (для конвертации Offer/Order → Invoice).

Frontend:
- `ListPage` + `DataTable` + `FilterToolbar` + `AddButton` + `Modal` + `EntityDetailPage`.
- `crmApi` + tag system + `realtime.js`.
- `useGridPrefs`, `useOpenAsModal`, форм-инструменты из `components/forms`, `components/inputs`.
- CSS-стили из `pages/styles/`, `pages/CRM/Counterparty/...`, `pages/documents/*`.

### 1.4 Что удалить или переписать

Удалить / переписать:
- `server/src/services/oms/orderService.js` — переписать с нуля по образу `offerService.js`.
- `server/src/controllers/oms/Order.controller.js` — переписать.
- `server/src/routes/oms/orderRouter.js` — переписать (полноценный REST + actions + смонтировать в rootRouter).
- `server/src/schemas/orderSchema.js` — переписать (формат как у `offerSchema.js`).

Создать с нуля:
- Frontend: `client/src/pages/oms/Orders/*`, `client/src/pages/oms/Offers/*`.
- RTK слайсы `client/src/store/rtk/ordersApi.js`, `client/src/store/rtk/offersApi.js`.
- Хуки `client/src/hooks/useOrderFormState.js`, `useOfferFormState.js`.
- Shared OMS-компоненты `client/src/components/oms/*` (форма, items-table, sticky totals sidebar, status badge, filters).
- Маппинг событий в `realtime.js` для `order.*` и `offer.*`.

Не трогать:
- Documents module (`server/src/services/crm/documentService.js`, `routes/crm/documentRouter.js`, `pages/documents/*`, `components/documents/*`).
- Invoice/Receipt/Payment/Warehouse модели и сервисы.
- Counterparty, Contact, Product, Deal.

---

## 2. Target Business Logic

### 2.1 Orders / Zamówienia

Заказ — это подтверждённый коммерческий документ-обязательство. Поддерживаются как ручное создание, так и конверсия из принятого Offer.

**Статусы заказа** (полное соответствие модели `Order.status`):

| Status | Описание | Можно из | Можно в |
|---|---|---|---|
| `draft` | Черновик, редактируется свободно | `new` (нельзя вернуть), создание | `new`, `cancelled` |
| `new` | Создан (например, при конверсии Offer→Order сразу `new`) | `draft`, создание | `confirmed`, `cancelled` |
| `confirmed` | Подтверждён, items зафиксированы | `new` | `paid`, `shipped`, `completed`, `cancelled` |
| `paid` | Оплачен (или paymentStatus=paid) | `confirmed`, `shipped` | `shipped`, `completed`, `returned` |
| `shipped` | Отгружен / fulfilled=fulfilled | `confirmed`, `paid` | `completed`, `returned` |
| `completed` | Закрыт | `paid`, `shipped` | `returned` |
| `cancelled` | Отменён, terminal | `draft`, `new`, `confirmed` | — |
| `returned` | Возврат, terminal | `shipped`, `completed`, `paid` | — |

Дополнительные поля (paymentStatus / fulfillmentStatus) — независимые, не управляются state machine основного `status`, но обновляются автоматически связанными сущностями (Payment, Shipment) или вручную из UI.

**Конверсии:**
- `Offer (accepted) → Order` — реализовано в `offerService.convertOfferToOrder`.
- `Order → Invoice` — нужно реализовать как `orderService.convertOrderToInvoice` (через `invoiceService`).

**Нумерация:**
- Использует `generateNextDocumentNumber({ documentType: 'ORDER', ... })` из `documentNumberingService`.
- Pattern из `DocumentNumberingSetting` для типа `ORDER` (по умолчанию `ZAM/{YYYY}/{MM}/{SEQ:4}`).
- Ручной номер поддерживается: если `payload.number` задан, генерация пропускается, но всё ещё работает unique-check (`orders_company_number_uniq`).
- При конфликте unique (одновременная вставка) — retry до 6 раз с регенерацией номера (паттерн уже реализован в `offerService`).

**Totals:**
- Считаются на backend по той же логике, что и `calculateOfferTotals` (см. `offerService.js`):
  - на уровне line item: `baseNet = qty * priceNet`, дисконт (`fixed` | `percent`) → `discountAmount`, `lineSubtotalNet = baseNet - discountAmount`, `lineVat = lineSubtotalNet * vatRate / 100`, `lineTotalGross = lineSubtotalNet + lineVat`, `unitPriceGross = lineTotalGross / qty`;
  - на уровне заказа: суммы по items + `roundingTotal` (на будущее, сейчас 0).
- Frontend дублирует расчёт «оптимистично» при редактировании (для preview), но **источник правды — backend**. На сохранении бэкенд пересчитывает и возвращает обновлённые суммы.

**Validation:**
- `customerId` (counterparty) обязателен, должен принадлежать companyId.
- `contactId`, `ownerId` — опциональные, должны принадлежать companyId.
- Items: либо `productId` (валидируется в company-scope), либо custom-line с обязательным `nameSnapshot`.
- `currencyCode` 3 символа, по умолчанию `PLN`.
- Discount: `percent` ∈ [0..100]; `fixed` ≤ baseNet.
- Запрет редактирования items при `status ∈ {shipped, completed, cancelled, returned}` (только в `draft/new/confirmed`).
- Запрет смены `status` через PUT/PATCH — только через `/actions/*` (как у Offers).

**События / audit:**
- При CRUD и при смене статуса писать в `OrderEvent` через `eventService.create(...)` (как у Offers).
- Заметки — в `OrderNote`.

### 2.2 Offers / Oferty

Полностью реализован в backend. Расширения:

**Статусы (как есть):**
`draft → sent → viewed → accepted | rejected | expired | cancelled`

**Конверсии:**
- `Offer → Order` — уже есть.
- `Offer → Invoice` — нужно добавить `offerService.convertOfferToInvoice` (новый метод).

**Нумерация:**
- `QUOTE` тип, pattern по умолчанию `OF/{YYYY}/{MM}/{SEQ:4}`.

**Validity:**
- Поля `issueDate`, `validUntil` (DATEONLY). `validUntil >= issueDate`.
- Опционально расчётный `validDays` на UI (issueDate + N days = validUntil).
- Автоматический переход `sent/viewed → expired` — отложенная задача, можно реализовать через CRON (см. P2-задачи), но в первой итерации — ручной action `/actions/expire`.

### 2.3 Frontend UX (общий стиль)

Соответствие модулям Counterparty / Products / Documents:
- **List page**: `ListPage` + `FilterToolbar` (search + select-фильтры) + `AddButton` справа. Колонки настраиваемые через `useGridPrefs`.
- **Detail page**: открывается либо в новой странице (`/main/oms/orders/:id`), либо в modal-режиме при `?modal=1` (как Counterparty).
- **Form layout**: 2 колонки:
  - Левая (основная) — header form: counterparty, contact, dates, currency, status badge; затем items-table; затем notes/terms.
  - Правая (sticky sidebar) — итоги (net/vat/gross), валюта, status timeline, доступные действия (Send/Accept/Convert).
- **Тёмная/glass-стилистика** — все компоненты уже в этом стиле (см. `pages/CRM/Counterparty/CounterpartiesPage/index.js`, `components/data/ListPage/ListPage.module.css`). Мы НЕ создаём новые цветовые токены, используем существующие CSS-vars (`--card-bg`, `--accent`, и т.д.).

---

## 3. Backend Plan

### 3.1 Models

**Не создаём новых моделей.** Существующие достаточны:
- `Order`, `OrderItem`, `OrderEvent`, `OrderNote`, `Offer`, `OfferItem`.

### 3.2 Migrations

**Дополнительные миграции (нужны):**
1. **`<timestamp>-add-orders-events-and-notes-indexes.js`** (если отсутствуют): индексы `order_events(company_id, order_id, created_at)`, `order_notes(company_id, order_id, created_at)`. Проверить — могут уже быть.
2. **`<timestamp>-alter-orders-status-state.js`**: если нужно добавить новые значения в ENUM `orders.status` (значения уже есть: draft/new/confirmed/paid/shipped/completed/cancelled/returned). Скорее всего ничего добавлять не нужно — модель уже совпадает с целевой бизнес-логикой.
3. **(опционально, если нужно)** `<timestamp>-add-order-items-tax-snapshot.js`: проверить, есть ли в `order_items` поля `vat_rate_snapshot`, `unit_snapshot`, `name_snapshot` — судя по модели, есть.

> Перед написанием миграций — прогнать `npx sequelize-cli db:migrate:status` в `/server`, увидеть финальное состояние БД и решать прицельно. Если все нужные поля и индексы уже есть, новых миграций не нужно.

### 3.3 Associations

Уже определены в моделях. Проверить только, что:
- `Offer.belongsTo(Order, as: 'convertedOrder', foreignKey: 'convertedOrderId', constraints: false)` существует.
- `Order.belongsTo(Offer, as: 'sourceOffer', foreignKey: 'sourceOfferId', constraints: false)` существует.
- `Order.hasMany(Invoice, as: 'invoices', foreignKey: 'orderId', onDelete: 'CASCADE')` существует.

Все три уже есть в `server/src/models/oms/{offer.js, order.js}`.

### 3.4 Services

**`server/src/services/oms/offerService.js`** — расширить новой функцией:

```
async function convertOfferToInvoice(id, payload, userContext) {
  // 1. ensure offer.status === 'accepted'
  // 2. invoiceService.createInvoiceFromSource({
  //      sourceType: 'offer',
  //      sourceId: offer.id,
  //      counterpartyId: offer.counterpartyId,
  //      items: mapOfferItemsToInvoiceItems(offer.items),
  //      issueDate, currency, paymentTerms, ...
  //    }, userContext)
  // 3. Log event 'offer.converted_to_invoice'
  // 4. Optionally update offer.meta.convertedInvoiceIds = [...]
}
```

И добавить в экспорт.

**`server/src/services/oms/orderService.js`** — переписать ПОЛНОСТЬЮ по образу `offerService.js`. Структура файла:

- Константы: `ORDER_STATUSES`, `EDITABLE_STATUSES = new Set(['draft','new','confirmed'])`, `TERMINAL_STATUSES = new Set(['cancelled','returned','completed'])`, `STATUS_TRANSITIONS`, `SORTABLE_FIELDS`, `DISCOUNT_TYPES`.
- Утилиты: `asText/asOptionalText/asNumber/asPositiveNumber/asNonNegativeNumber/round/asDateOnly/parsePagination/parseSort/parseBoolean/normalizeStatusList/assertStatus/validateStatusTransition/assertOrderEditable`.
- Validators: `assertCounterpartyInCompany`, `assertContactInCompany`, `assertOwnerInCompany`, `assertOfferInCompany` (если нужно), `assertSalesChannelInCompany`, `assertShippingClassInCompany`.
- Numbering: `generateOrderNumber({companyId, issueDate, transaction})` — обёртка над `generateNextDocumentNumber({documentType: 'ORDER'})`.
- Items helpers: `loadProductsMap`, `buildOrderItemSnapshots`, `normalizeOrderItemInput`, `calculateOrderItemTotals`, `calculateOrderTotals`, `buildNormalizedItems`, `saveOrderItems` (replace-all внутри транзакции).
- DTO mappers: `mapOrderToListDto`, `mapOrderToDetailDto`, `mapOrderItemDto`, `mapCounterpartySummary`, `mapContactSummary`, `mapUserSummary`, `mapOfferSummary`, `mapInvoiceSummary`.
- `buildListWhere` — фильтры по: search (number/notes/counterparty.shortName/fullName/contact name), status[], paymentStatus[], fulfillmentStatus[], counterpartyId, contactId, ownerId, salesChannelId, sourceOfferId, dateFrom/dateTo (по placedAt), amountFrom/amountTo, hasInvoice (boolean).
- Главные функции (public):
  - `listOrders(query, userContext)` — пагинация, сортировка, фильтрация.
  - `getOrderById(id, userContext)` — с items, payments, invoices, shipments, sourceOffer, owner.
  - `createOrder(payload, userContext)` — транзакция, генерация номера (с retry), `assertOrderEditable` пропускается т.к. новый, валидаторы, `saveOrderItems`, log event `order.created`.
  - `updateOrder(id, payload, userContext)` — запрет смены `status` через update (как у Offers), `assertOrderEditable`, обновление items.
  - `deleteOrder(id, userContext)` — только `draft` без invoices/shipments.
  - `saveOrderItems(id, items, userContext)` — отдельный endpoint.
  - `changeOrderStatus(id, targetStatus, payload, userContext)` — state machine, обновление таймштампов (`confirmedAt`, `shippedAt`, `completedAt`, `cancelledAt`), event log.
  - `convertOrderToInvoice(id, payload, userContext)` — создание Invoice через `invoiceService`, копирование items, привязка `invoice.orderId = order.id`. Если `payment_terms` есть — копируется. После — event `order.converted_to_invoice`.
  - `getMeta(query, userContext)` — возвращает enum-список статусов и discount-типов для UI.

**Не дублируем helpers.** Если что-то реально reusable (например, `round`, `asNumber`) — извлечь в `server/src/services/oms/_calc.js` и переиспользовать в offer/order. В первую итерацию допустимо оставить дублирование, чтобы не трогать рабочий `offerService.js`.

### 3.5 Controllers

**`server/src/controllers/oms/Order.controller.js`** — переписать как тонкий слой:

```
const service = require('../../services/oms/orderService');
module.exports.list = async (req, res, next) => { try { res.json(await service.listOrders(req.query, req.user)); } catch (e) { next(e); } };
module.exports.getById = async (req, res, next) => { try { res.json(await service.getOrderById(req.params.id, req.user)); } catch (e) { next(e); } };
module.exports.create = async (req, res, next) => { try { res.status(201).json(await service.createOrder(req.body, req.user)); } catch (e) { next(e); } };
module.exports.update = async (req, res, next) => { try { res.json(await service.updateOrder(req.params.id, req.body, req.user)); } catch (e) { next(e); } };
module.exports.remove = async (req, res, next) => { try { res.json(await service.deleteOrder(req.params.id, req.user)); } catch (e) { next(e); } };
module.exports.saveItems = async (req, res, next) => { try { res.json(await service.saveOrderItems(req.params.id, req.body?.items || [], req.user)); } catch (e) { next(e); } };
module.exports.confirm = async (req, res, next) => { try { res.json(await service.changeOrderStatus(req.params.id, 'confirmed', req.body, req.user)); } catch (e) { next(e); } };
module.exports.ship = async (...) // shipped
module.exports.complete = async (...) // completed
module.exports.cancel = async (...) // cancelled
module.exports.markReturned = async (...) // returned
module.exports.convertToInvoice = async (req, res, next) => { try { res.status(201).json(await service.convertOrderToInvoice(req.params.id, req.body, req.user)); } catch (e) { next(e); } };
module.exports.meta = async (req, res, next) => { try { res.json(await service.getMeta(req.query, req.user)); } catch (e) { next(e); } };
```

**`server/src/controllers/oms/Offer.controller.js`** — добавить `convertToInvoice`:

```
module.exports.convertToInvoice = async (req, res, next) => {
  try { res.status(201).json(await offerService.convertOfferToInvoice(req.params.id, req.body || {}, req.user)); }
  catch (error) { next(error); }
};
```

### 3.6 Routes

**`server/src/routes/oms/orderRouter.js`** — переписать:

```
const orderRouter = require('express').Router();
const OrderController = require('../../controllers/oms/Order.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const orderSchema = require('../../schemas/orderSchema');

orderRouter.get('/meta', authorize('order:read'), OrderController.meta);

orderRouter.get('/', validateQuery(orderSchema.listQuery), authorize('order:read'), OrderController.list);
orderRouter.post('/', validateBody(orderSchema.create), authorize('order:create'), OrderController.create);

orderRouter.get('/:id', authorize('order:read'), OrderController.getById);
orderRouter.put('/:id', validateBody(orderSchema.update), authorize('order:update'), OrderController.update);
orderRouter.patch('/:id', validateBody(orderSchema.update), authorize('order:update'), OrderController.update);
orderRouter.delete('/:id', authorize('order:delete'), OrderController.remove);

orderRouter.put('/:id/items', validateBody(orderSchema.saveItems), authorize('order:update'), OrderController.saveItems);
orderRouter.patch('/:id/items', validateBody(orderSchema.saveItems), authorize('order:update'), OrderController.saveItems);

orderRouter.post('/:id/actions/confirm',    validateBody(orderSchema.actionPayload), authorize('order:update'), OrderController.confirm);
orderRouter.post('/:id/actions/ship',       validateBody(orderSchema.actionPayload), authorize('order:update'), OrderController.ship);
orderRouter.post('/:id/actions/complete',   validateBody(orderSchema.actionPayload), authorize('order:update'), OrderController.complete);
orderRouter.post('/:id/actions/cancel',     validateBody(orderSchema.actionPayload), authorize('order:update'), OrderController.cancel);
orderRouter.post('/:id/actions/return',     validateBody(orderSchema.actionPayload), authorize('order:update'), OrderController.markReturned);
orderRouter.post('/:id/actions/convert-to-invoice', validateBody(orderSchema.convertPayload), authorize('order:convert'), OrderController.convertToInvoice);

module.exports = orderRouter;
```

**`server/src/routes/oms/offerRouter.js`** — добавить строчку:

```
offerRouter.post('/:id/actions/convert-to-invoice', validateBody(offerSchema.convertPayload), authorize('offer:convert'), OfferController.convertToInvoice);
```

**`server/src/routes/rootRouter.js`** — добавить:

```
rootRouter.use("/orders", auth, companyIdGuard, require("./oms/orderRouter"));
```

(Если `/orders` ранее не был зарегистрирован.)

### 3.7 Validators (Joi schemas)

**`server/src/schemas/orderSchema.js`** — переписать в формате `offerSchema.js`:

```
const { Joi, uuid, dateISO, paging } = require('./_common');

const ORDER_STATUSES = ['draft','new','confirmed','paid','shipped','completed','cancelled','returned'];
const PAYMENT_STATUSES = ['pending','paid','refunded','partially_refunded'];
const FULFILLMENT_STATUSES = ['unfulfilled','partial','fulfilled'];
const DISCOUNT_TYPES = ['none','fixed','percent'];

const itemSchema = Joi.object({ /* same shape as offerSchema.itemSchema */ });

const headerCreateSchema = Joi.object({
  number: Joi.string().max(128).allow('', null),
  status: Joi.string().valid('draft','new'),               // на создании только draft/new
  customerId: uuid.required(),                              // counterparty
  contactId: uuid.allow(null),
  ownerId: uuid.allow(null),
  offerId: uuid.allow(null),
  sourceOfferId: uuid.allow(null),
  sourceType: Joi.string().max(32).allow('', null),
  sourceId: uuid.allow(null),
  currencyCode: Joi.string().length(3).uppercase().required(),
  issueDate: dateISO.optional(),
  placedAt: dateISO.optional(),
  paymentTerms: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  leadTime: Joi.string().max(128).allow('', null),
  notes: Joi.string().allow('', null),
  salesChannelId: uuid.allow(null),
  shippingClassId: uuid.allow(null),
  items: Joi.array().items(itemSchema).default([]),
});

const headerUpdateSchema = Joi.object({
  number: Joi.forbidden(),
  status: Joi.forbidden(),                                  // только через /actions
  /* ... все остальные поля как в create, но без required */
  items: Joi.array().items(itemSchema),
}).min(1);

module.exports.listQuery = paging.keys({
  sortBy: Joi.string().max(64),
  sortOrder: Joi.string().valid('ASC','DESC','asc','desc'),
  search: Joi.string().max(200).allow('', null),
  status: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string().valid(...ORDER_STATUSES))),
  paymentStatus: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string().valid(...PAYMENT_STATUSES))),
  fulfillmentStatus: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string().valid(...FULFILLMENT_STATUSES))),
  counterpartyId: uuid,
  customerId: uuid,
  contactId: uuid,
  ownerId: uuid,
  sourceOfferId: uuid,
  hasInvoice: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true','false','1','0')),
  placedAtFrom: dateISO,
  placedAtTo: dateISO,
  amountFrom: Joi.number().min(0),
  amountTo: Joi.number().min(0),
});

module.exports.create = headerCreateSchema;
module.exports.update = headerUpdateSchema;
module.exports.saveItems = Joi.object({ items: Joi.array().items(itemSchema).required() });
module.exports.actionPayload = Joi.object({ internalNotesAppend: Joi.string().max(4000).allow('', null) });
module.exports.convertPayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  notes: Joi.string().allow('', null),
  invoiceType: Joi.string().valid('INVOICE','PROFORMA','ADVANCE_INVOICE').default('INVOICE'),
});
```

**`server/src/schemas/offerSchema.js`** — добавить (если ещё нет) для convert-to-invoice:

```
module.exports.convertToInvoicePayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  notes: Joi.string().allow('', null),
  invoiceType: Joi.string().valid('INVOICE','PROFORMA','ADVANCE_INVOICE').default('INVOICE'),
});
```

(Текущий `convertPayload` используется для convert-to-order и должен остаться без изменений.)

### 3.8 DTO / Mappers

Расположение: внутри `orderService.js` и `offerService.js` (как сейчас в offerService). Дублирования допустимы, читабельность важнее.

`mapOrderToListDto`:
```
{ id, number, status, paymentStatus, fulfillmentStatus, counterparty: {id, name, shortName, fullName}, owner: {id, name, email}, currency, totalGross, placedAt, createdAt, updatedAt, sourceOfferId, hasInvoice: boolean }
```

`mapOrderToDetailDto`:
```
{ ...listDto fields, contactId, ownerId, currencyCode, totalNet, totalTax, totalGross, paymentTerms, deliveryTerms, leadTime, salesChannelId, shippingClassId, items: [mapOrderItemDto], sourceOffer: {id, number, status}, invoices: [{id, number, status, totalGross}], payments: [{...}], availableActions: {canEdit, canDelete, canConfirm, canShip, canCancel, canConvertToInvoice}, statusMetadata: {placedAt, confirmedAt, shippedAt, completedAt, cancelledAt}, createdBy, updatedBy, ... }
```

### 3.9 Security / Multi-tenant

- **companyId guard**: `rootRouter` уже навешивает `auth` + `companyIdGuard`. Дублировать в орденроутере НЕ нужно.
- В сервисе ВСЕ запросы фильтруются по `req.user.companyId`. Никогда не доверять `payload.companyId`.
- Связанные сущности (counterparty, contact, owner, sourceOffer, salesChannel, shippingClass) перед привязкой к Order проверяются в company-scope (см. `offerService.assertCounterpartyInCompany`).
- Permissions: `authorize('order:read'|'order:create'|'order:update'|'order:delete'|'order:convert')` — добавить эти permission-ключи в seed (ACL).

### 3.10 Errors

Использовать `AppError(httpStatus, message, { code, details })` как в `offerService`. Стандартные коды:
- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `INVALID_STATUS_TRANSITION` (409)
- `ORDER_NOT_EDITABLE` (409)
- `ORDER_DELETE_FORBIDDEN` (409)
- `ORDER_ALREADY_CONVERTED` (409)
- `OFFER_ALREADY_CONVERTED` (409)
- `NUMBERING_FAILURE` (409)

Глобальный error handler в `server/src/middleware/errorHandler.js` уже корректно сериализует `AppError`.

### 3.11 Events / Audit

Использовать `eventService.create(companyId, type, payload, target)` из `server/src/services/system/eventService.js` (как в `logOfferEvent` в `offerService`).

Типы событий:
- `order.created`, `order.updated`, `order.deleted`, `order.items.updated`, `order.status.changed`, `order.converted_to_invoice`.
- `offer.converted_to_invoice` (новый).

Заметки — в `OrderNote` через отдельный endpoint (вне scope текущей итерации, но модель есть).

---

## 4. Frontend Plan

### 4.1 Pages

**Orders (`client/src/pages/oms/Orders/`):**
- `OrdersListPage/index.js` — список заказов (table + filters + AddButton).
- `OrderDetailPage/index.js` — детально (header + items + sidebar). Поддерживает `?modal=1`.
- `OrderEditorPage/index.js` — единый компонент для create/edit. Маршруты `/main/oms/orders/new` и `/main/oms/orders/:id/edit`.
- (Опционально) `OrderPrintPage/index.js` — рендер шаблона документа (использовать существующий `DocumentTemplateRenderer`).

**Offers (`client/src/pages/oms/Offers/`):**
- `OffersListPage/index.js`
- `OfferDetailPage/index.js`
- `OfferEditorPage/index.js`
- (Опционально) `OfferPrintPage/index.js`

> Структура зеркальная Counterparty / Documents. Каждая папка содержит `index.js` и при необходимости `*.module.css`.

### 4.2 Shared OMS components

`client/src/components/oms/`:
- `OmsHeaderForm.jsx` — header-форма (counterparty/contact/dates/currency/owner/source). Параметризован `mode: 'order' | 'offer'`.
- `OmsItemsTable.jsx` — таблица позиций с inline-edit (qty, priceNet, vatRate, discountType, discountValue), drag-resort, добавление product/custom-line.
- `OmsTotalsSidebar.jsx` — sticky right sidebar (net/vat/gross, currency, status timeline, action buttons).
- `OmsStatusBadge.jsx` — бэйдж статуса с цветами по конфигу.
- `OmsStatusActionsMenu.jsx` — выпадающее меню действий (Send/Accept/Convert/...).
- `OmsFiltersToolbar.jsx` — расширение `FilterToolbar` с типичными для OMS фильтрами (статус, валюта, дата, owner).
- `OmsItemSearchPopover.jsx` — поиск товаров через `productsApi.useListProductsQuery`.
- `useOmsTotalsCalc.js` — клиентский расчёт totals (зеркало backend-расчёта, для предпросмотра).
- `omsStatusConfig.js` — описание статусов (color, label-i18n-key, allowed-transitions).

> Названия с префиксом `Oms*` — намеренно общие для order/offer, переключаются через prop `mode`. Это уменьшает дублирование и сохраняет единый UX.

### 4.3 Hooks

- `client/src/hooks/useOrderFormState.js` — управление формой заказа: items, totals, validation, draft autosave (localStorage prefix `order:`).
- `client/src/hooks/useOfferFormState.js` — то же для offer.
- (Опционально) `client/src/hooks/useOmsStatusActions.js` — обёртка над action-мутациями (confirm/cancel/...).

### 4.4 API (RTK Query)

**`client/src/store/rtk/ordersApi.js`** — injecte в `crmApi`:
```
listOrders: build.query({ query: args => ({ url: '/orders', params: buildParams(args) }), transformResponse: normalizeList, providesTags: ... })
getOrderById: build.query({ query: id => `/orders/${id}`, providesTags: (_r,_e,id) => [{ type: 'Order', id }] })
createOrder, updateOrder, deleteOrder, saveOrderItems
confirmOrder, shipOrder, completeOrder, cancelOrder, returnOrder
convertOrderToInvoice
getOrderMeta
```

**`client/src/store/rtk/offersApi.js`** — то же:
```
listOffers, getOfferById, createOffer, updateOffer, deleteOffer, saveOfferItems
sendOffer, viewOffer, acceptOffer, rejectOffer, expireOffer, cancelOffer
duplicateOffer
convertOfferToOrder, convertOfferToInvoice
getOfferMeta
```

В обоих файлах — `stripCompanyId` + `normalizeList` как в `documentsApi.js`. Tag-ы: `Order`, `OrderList`, `Offer`, `OfferList`.

**`crmApi.js`** — расширить `tagTypes`:
- Добавить `'OrderList'` (если ещё нет; `Offer`, `OfferList`, `Order` уже есть).

**`realtime.js`** — добавить:
```
if (e === 'order' || t.startsWith('order.')) {
  return [{ type: 'OrderList', id: 'LIST' }, ...ids.map(id => ({ type: 'Order', id }))];
}
if (e === 'offer' || t.startsWith('offer.')) {
  return [{ type: 'OfferList', id: 'LIST' }, ...ids.map(id => ({ type: 'Offer', id }))];
}
```

### 4.5 Routing (`client/src/App.js`)

Добавить роуты внутри основного `<Route path="main">`:
```
<Route path="oms/orders" element={<OrdersListPage />} />
<Route path="oms/orders/new" element={<OrderEditorPage />} />
<Route path="oms/orders/:id" element={<OrderDetailPage />} />
<Route path="oms/orders/:id/edit" element={<OrderEditorPage />} />
<Route path="oms/offers" element={<OffersListPage />} />
<Route path="oms/offers/new" element={<OfferEditorPage />} />
<Route path="oms/offers/:id" element={<OfferDetailPage />} />
<Route path="oms/offers/:id/edit" element={<OfferEditorPage />} />
```

С `React.lazy` (как остальные страницы).

### 4.6 Menu (`client/src/config/menu.js`)

В секции `oms` добавить ДВА пункта **перед** `invoices`:
```
{ key: "offers", icon: FileText, labelKey: "menu.offers", route: "/main/oms/offers", type: "item" },
{ key: "orders", icon: ClipboardList, labelKey: "menu.orders", route: "/main/oms/orders", type: "item" },
```

### 4.7 ListPage registry

В `client/src/components/data/ListPage/index.js` зарегистрировать новые источники:
```
import { useListOrdersQuery } from '../../../store/rtk/ordersApi';
import { useListOffersQuery } from '../../../store/rtk/offersApi';

const REGISTRY = {
  // ... existing
  orders: { useQuery: useListOrdersQuery, adapt: (data) => ({ items: data?.items || [], total: data?.total ?? 0, page: data?.page ?? 1, limit: data?.limit ?? 25 }) },
  offers: { useQuery: useListOffersQuery, adapt: (data) => ({ items: data?.items || [], total: data?.total ?? 0, page: data?.page ?? 1, limit: data?.limit ?? 25 }) },
};
```

### 4.8 Column schemas

`client/src/components/data/ListPage/columnSchemas/ordersColumns.js` — `createOrderListColumns({ onOpenDetail })`:
- number / counterparty / status / paymentStatus / fulfillmentStatus / totalGross / placedAt / owner / createdAt.

`client/src/components/data/ListPage/columnSchemas/offersColumns.js` — `createOfferListColumns(...)`:
- number / counterparty / status / validUntil / totalGross / convertedOrder / owner / createdAt.

Использовать `LinkCell` (как в Counterparties) для primary-ячейки.

### 4.9 i18n keys

В `client/src/i18n/locales/{en,pl,ru,ua}.json` добавить:
- `menu.orders`, `menu.offers`
- `oms.orders.title`, `oms.orders.empty`, `oms.orders.filters.*`, `oms.orders.statuses.{draft,new,confirmed,paid,shipped,completed,cancelled,returned}`, `oms.orders.actions.{add,confirm,ship,complete,cancel,return,convertToInvoice}`, `oms.orders.fields.*`.
- Аналогично `oms.offers.*` (с `send,view,accept,reject,expire,cancel,duplicate,convertToOrder,convertToInvoice`, статусы `draft,sent,viewed,accepted,rejected,expired,cancelled`).
- `oms.common.totals.{net,vat,gross}`, `oms.common.items.{add,remove,custom,product}`, `oms.common.numberManual.placeholder`.

### 4.10 Styles

CSS-modules рядом с компонентами:
- `OrdersListPage/OrdersListPage.module.css` (если нужно отличие от ListPage). В большинстве случаев — НЕ нужно, унаследовать стили `ListPage.module.css`.
- `OrderEditorPage/OrderEditorPage.module.css` — двухколоночный grid, sticky sidebar.
- `components/oms/Oms*.module.css` — стили под каждый компонент.

Использовать существующие CSS-vars (`--card-bg`, `--accent`, `--text-primary`, `--success`, `--danger`, etc.).

### 4.11 UX states

В каждой list-странице:
- **Loading**: skeleton-строки (как в `EntityDetailPage.Skeleton`).
- **Empty**: иллюстрация + текст «Нет заказов» + кнопка `AddButton`.
- **Error**: баннер с retry.

В editor-странице:
- **Loading**: skeleton header + skeleton items table.
- **Saving**: disable submit + spinner на кнопке.
- **Validation errors**: inline-сообщения под полями.
- **Server error**: toast (RadixToast или эквивалент в проекте).

В items-table:
- Drag handle для resort.
- Inline-edit qty/price/vat.
- Empty state: «Добавьте товар или услугу» + поисковая строка product.

---

## 5. Database Schema Draft

### 5.1 Tables (уже есть, без изменений)

**`offers`** (уже создана, см. модель и миграцию `20260422170000-alter-offers-stage1-foundation`):
- `id UUID PK`, `company_id UUID NOT NULL`, `counterparty_id UUID`, `contact_id UUID`, `owner_id UUID`, `deal_id UUID`
- `number VARCHAR(128)`, `status VARCHAR(32) NOT NULL DEFAULT 'draft'`
- `title VARCHAR(255)`, `subject VARCHAR(255)`
- `issue_date DATE`, `valid_until DATE`
- `currency_code VARCHAR(3) NOT NULL DEFAULT 'PLN'`, `exchange_rate DECIMAL(18,6)`
- `source_type VARCHAR(32)`, `source_id UUID`
- `total_net/total_tax/total_gross/discount_total/rounding_total DECIMAL`
- `items_count/lines_count INTEGER`
- `payment_terms/delivery_terms TEXT`, `lead_time/incoterms VARCHAR`
- `notes/internal_notes TEXT`
- `billing_address_snapshot/shipping_address_snapshot JSONB`
- audit & status timestamps: `accepted_at/by, rejected_at/by, sent_at/by, viewed_at/by, cancelled_at/by, converted_at/by, converted_order_id, last_status_changed_at, locked_at/by, revision`
- `meta JSONB NOT NULL DEFAULT '{}'`
- `created_at/updated_at/deleted_at` (paranoid)
- Indexes: `offers_company_number_uniq` (company_id, number), `offers_company_status_idx`, FK на `counterparties`, `contacts`, `users`, `deals`, `orders` (converted_order_id, no FK constraint).

**`offer_items`** (см. `offeritem.js`):
- `id UUID PK`, `company_id UUID`, `offer_id UUID FK CASCADE`
- `sort_order INTEGER`, `product_id UUID`, `variant_id UUID`, `uom_id UUID`
- snapshot-поля (`sku_snapshot`, `name_snapshot`, `description_snapshot`, `unit_snapshot`, `vat_rate_snapshot`, `product_type_snapshot`, `metadata_snapshot JSONB`)
- `qty DECIMAL(14,3)`, `price_net/price_gross DECIMAL(14,2)`, `tax_rate DECIMAL(7,4)`
- `discount_type VARCHAR(16)`, `discount_value DECIMAL(18,4)`, `discount_amount DECIMAL(14,2)`
- `line_subtotal_net/line_vat/line_total_gross DECIMAL(18,4)`
- `is_custom_line BOOLEAN`, `notes TEXT`
- paranoid timestamps.

**`orders`**:
- `id UUID PK`, `company_id UUID NOT NULL`, `number VARCHAR(128)`, `offer_id UUID`, `customer_id UUID NOT NULL`, `contact_id UUID`, `owner_id UUID`, `sales_channel_id UUID`, `shipping_class_id UUID`
- `currency_code VARCHAR(3) NOT NULL`
- `status` ENUM(draft, new, confirmed, paid, shipped, completed, cancelled, returned)
- `payment_status` ENUM(pending, paid, refunded, partially_refunded)
- `fulfillment_status` ENUM(unfulfilled, partial, fulfilled)
- `placed_at, confirmed_at, shipped_at, completed_at, cancelled_at TIMESTAMP`
- `notes/payment_terms/delivery_terms TEXT`, `lead_time VARCHAR(128)`
- `source_type VARCHAR(32)`, `source_id UUID`, `source_offer_id UUID FK offers(id) SET NULL`
- `total_net/total_tax/total_gross DECIMAL(14,2)`
- `created_by/updated_by UUID FK users(id) SET NULL`
- paranoid timestamps
- Indexes: `orders_company_number_uniq` (company_id, number), `orders_company_source_offer_idx` (company_id, source_offer_id).

**`order_items`** — аналогично `offer_items` + `price_list_item_id UUID`.

**`order_events`**, **`order_notes`** — таблицы аудита и заметок (созданы, но в первой итерации можем не использовать UI, серверная сторона пишет в `order_events` через `eventService`).

### 5.2 Дополнительные индексы (проверить и добавить при необходимости)

- `orders (company_id, status, placed_at DESC)` — для list view фильтрация+сортировка.
- `orders (company_id, customer_id, created_at DESC)` — для табов «Заказы» на странице контрагента.
- `order_items (order_id, sort_order)` — для рендера в правильном порядке.
- `offers (company_id, status, issue_date DESC)`.

Если индексов нет — добавить миграцией `add-orders-offers-perf-indexes.js`.

---

## 6. API Contract Draft

База: все эндпоинты под `/api`, требуют `auth` + `companyIdGuard` (применяются в `rootRouter`). `Authorization: Bearer <accessToken>`. `companyId` берётся из JWT, передавать в payload НЕ НУЖНО.

### 6.1 Orders

#### `GET /api/orders`
- Query: `page, limit, sortBy, sortOrder, search, status[], paymentStatus[], fulfillmentStatus[], counterpartyId, customerId, contactId, ownerId, sourceOfferId, hasInvoice, placedAtFrom, placedAtTo, amountFrom, amountTo`.
- Response: `{ items: [OrderListDto], total: number, page: number, limit: number }`.
- Permissions: `order:read`.

#### `GET /api/orders/meta`
- Response: `{ statuses: [...], paymentStatuses: [...], fulfillmentStatuses: [...], discountTypes: [...] }`.

#### `GET /api/orders/:id`
- Response: `OrderDetailDto`.
- Errors: 404 NOT_FOUND.

#### `POST /api/orders`
- Body: `OrderCreateDto` (см. `orderSchema.create`).
- Response (201): `OrderDetailDto`.
- Errors: 400 VALIDATION_ERROR, 409 NUMBERING_FAILURE.

#### `PATCH /api/orders/:id`
- Body: `OrderUpdateDto`. Поле `status` ЗАПРЕЩЕНО, поле `number` ЗАПРЕЩЕНО.
- Errors: 404, 409 ORDER_NOT_EDITABLE, 400.

#### `DELETE /api/orders/:id`
- Errors: 409 ORDER_DELETE_FORBIDDEN (если не draft / есть invoices/shipments).

#### `PUT /api/orders/:id/items`
- Body: `{ items: [OrderItemDto] }`.
- Заменяет все позиции, пересчитывает totals.

#### `POST /api/orders/:id/actions/confirm | ship | complete | cancel | return`
- Body: `{ internalNotesAppend?: string }`.
- State machine из §2.1. Errors: 409 INVALID_STATUS_TRANSITION.

#### `POST /api/orders/:id/actions/convert-to-invoice`
- Body: `{ number?, issueDate?, notes?, invoiceType?: 'INVOICE'|'PROFORMA'|'ADVANCE_INVOICE' }`.
- Response (201): `{ invoice: InvoiceSummaryDto, order: OrderDetailDto }`.
- Permission: `order:convert`.

### 6.2 Offers

(Существующие — без изменений, добавляется один новый action.)

#### `GET /api/offers`, `GET /api/offers/:id`, `POST /api/offers`, `PUT/PATCH /api/offers/:id`, `DELETE /api/offers/:id`
- См. `server/src/routes/oms/offerRouter.js`.

#### `PUT /api/offers/:id/items` — заменить items.

#### `POST /api/offers/:id/actions/{send, view, accept, reject, cancel, expire, duplicate, convert-to-order}` — уже есть.

#### `POST /api/offers/:id/actions/convert-to-invoice` (НОВОЕ)
- Body: `{ number?, issueDate?, notes?, invoiceType?: 'INVOICE'|'PROFORMA'|'ADVANCE_INVOICE' }`.
- Response (201): `{ invoice: InvoiceSummaryDto, offer: OfferDetailDto }`.
- Errors: 409 OFFER_NOT_CONVERTIBLE (если статус ≠ accepted), 409 OFFER_ALREADY_CONVERTED (если ужe конвертирован в invoice).
- Permission: `offer:convert`.

### 6.3 Item DTO shape

```
{
  id?: UUID,
  sortOrder: number,
  productId: UUID|null,
  variantId: UUID|null,
  uomId|unitId: UUID|null,
  nameSnapshot|name: string,
  skuSnapshot|sku: string|null,
  descriptionSnapshot|description: string|null,
  unitSnapshot|unit: string|null,
  vatRateSnapshot|vatRate|taxRate: number (0..999.9999),
  productTypeSnapshot: string|null,
  metadataSnapshot: object|null,
  quantity|qty: number > 0,
  unitPriceNet|priceNet: number >= 0,
  discountType: 'none'|'fixed'|'percent',
  discountValue: number >= 0,
  isCustomLine?: boolean,
  notes?: string|null,
}
```

`lineSubtotalNet`, `lineVat`, `lineTotalGross`, `discountAmount`, `unitPriceGross` — пересчитываются на backend и возвращаются в response, **не** принимаются в request.

---

## 7. Frontend File Tree

```
client/src/
├── pages/
│   └── oms/
│       ├── Orders/
│       │   ├── OrdersListPage/
│       │   │   ├── index.js
│       │   │   └── OrdersListPage.module.css            (если нужны локальные стили)
│       │   ├── OrderDetailPage/
│       │   │   ├── index.js
│       │   │   └── OrderDetailPage.module.css
│       │   ├── OrderEditorPage/
│       │   │   ├── index.js
│       │   │   └── OrderEditorPage.module.css
│       │   └── OrderPrintPage/                          (опционально, P2)
│       └── Offers/
│           ├── OffersListPage/
│           │   ├── index.js
│           │   └── OffersListPage.module.css
│           ├── OfferDetailPage/
│           │   ├── index.js
│           │   └── OfferDetailPage.module.css
│           ├── OfferEditorPage/
│           │   ├── index.js
│           │   └── OfferEditorPage.module.css
│           └── OfferPrintPage/                          (опционально, P2)
│
├── components/
│   └── oms/
│       ├── OmsHeaderForm.jsx
│       ├── OmsHeaderForm.module.css
│       ├── OmsItemsTable.jsx
│       ├── OmsItemsTable.module.css
│       ├── OmsItemSearchPopover.jsx
│       ├── OmsItemSearchPopover.module.css
│       ├── OmsTotalsSidebar.jsx
│       ├── OmsTotalsSidebar.module.css
│       ├── OmsStatusBadge.jsx
│       ├── OmsStatusBadge.module.css
│       ├── OmsStatusActionsMenu.jsx
│       ├── OmsStatusActionsMenu.module.css
│       ├── OmsFiltersToolbar.jsx
│       ├── omsStatusConfig.js
│       └── omsConversionConfig.js
│
├── hooks/
│   ├── useOrderFormState.js
│   ├── useOfferFormState.js
│   ├── useOmsStatusActions.js                            (опционально)
│   └── useOmsTotalsCalc.js
│
├── store/rtk/
│   ├── ordersApi.js
│   └── offersApi.js
│
└── components/data/ListPage/columnSchemas/
    ├── ordersColumns.js
    └── offersColumns.js
```

---

## 8. Deletion / Refactor Plan

### 8.1 Backend — переписать (sample-file → new content)

- `server/src/services/oms/orderService.js` — **полная переписка** (см. §3.4). Старая версия удаляется.
- `server/src/controllers/oms/Order.controller.js` — **полная переписка** (см. §3.5).
- `server/src/routes/oms/orderRouter.js` — **полная переписка** (см. §3.6). Убрать дублирующий `companyIdGuard`.
- `server/src/schemas/orderSchema.js` — **полная переписка** в формате `offerSchema.js` (см. §3.7).

### 8.2 Backend — расширить (НЕ удалять)

- `server/src/routes/rootRouter.js` — добавить строчку `rootRouter.use('/orders', auth, companyIdGuard, require('./oms/orderRouter'));`
- `server/src/services/oms/offerService.js` — добавить `convertOfferToInvoice(...)`.
- `server/src/controllers/oms/Offer.controller.js` — добавить `convertToInvoice`.
- `server/src/routes/oms/offerRouter.js` — добавить роут `/actions/convert-to-invoice`.
- `server/src/schemas/offerSchema.js` — добавить `convertToInvoicePayload`.
- `server/src/services/oms/invoiceService.js` — экспортировать `createInvoiceFromSource({ sourceType, sourceId, counterpartyId, items, ... }, userContext)` (если ещё нет; если функция уже есть с другим API — переиспользовать).
- ACL seed — добавить permissions `order:read`, `order:create`, `order:update`, `order:delete`, `order:convert` (если ещё не посеяны).

### 8.3 Backend — НЕ ТРОГАТЬ

- Все остальные файлы `server/src/services/oms/*`, `server/src/controllers/oms/*`, `server/src/routes/oms/*`.
- Modes Order/OrderItem/Offer/OfferItem/OrderEvent/OrderNote.
- Все миграции (запускать только новые при необходимости).
- `server/src/services/crm/documentNumberingService.js` и весь `crm` слой.
- Documents (`server/src/controllers/crm/Document.controller.js`, `routes/crm/documentRouter.js`).

### 8.4 Frontend — создать с нуля

- Все файлы из §7 (pages, components/oms, hooks, store/rtk).
- Записи в `App.js`, `menu.js`, `realtime.js`, `ListPage/index.js`, i18n-словари.

### 8.5 Frontend — НЕ ТРОГАТЬ

- `client/src/pages/documents/*`, `client/src/components/documents/*`.
- `client/src/pages/CRM/*`, `client/src/pages/PIM/*`.
- `client/src/store/rtk/documentsApi.js`, `counterpartyApi.js`, `productsApi.js`, и остальные.
- `client/src/components/data/{ListPage,DataTable,DetailTabs}` — только дописать в REGISTRY.
- `client/src/components/filters/FilterToolbar`, `components/buttons/AddButton`, `components/Modal`.

---

## 9. Implementation Order

> Каждый шаг — одно small/medium-PR-сообщение. Между шагами Codex должен прогнать тесты/smoke.

1. **Backend audit & ACL seed**
   - Прочитать `server/src/services/oms/offerService.js`, `companyOrderSettingsService.js`, `documentNumberingService.js`.
   - Прогнать `npx sequelize-cli db:migrate:status` в `/server` и убедиться, что все order/offer-миграции применены.
   - Добавить permissions `order:read/create/update/delete/convert` в ACL seed (если их нет). Найти существующий seed для `offer:*` и сделать по аналогии.

2. **Backend: дополнительные индексы (если нужно)**
   - Проверить наличие индексов из §5.2. Если отсутствуют — миграция `add-orders-offers-perf-indexes.js`.
   - `npm run dev` в `/server`, проверить старт.

3. **Backend: переписать `orderSchema.js`**
   - Полная замена в формате `offerSchema.js`.
   - Smoke-test через REST-клиент: вызов `/api/orders` ещё не работает, но schema-файл загружается без ошибок.

4. **Backend: переписать `orderService.js`**
   - Реализация всех функций из §3.4.
   - Юнит-проверка через `node -e "require('./src/services/oms/orderService')"` (синтаксис ОК).
   - Покрытие нетривиальной логики: totals, status transitions, generateOrderNumber retry.

5. **Backend: переписать `Order.controller.js`**
   - Все хэндлеры из §3.5.

6. **Backend: переписать `orderRouter.js` и смонтировать в `rootRouter.js`**
   - Полный REST + actions.
   - Добавить строку в `rootRouter.use('/orders', ...)`.
   - Перезапуск dev-server. `GET /api/orders` (с валидным token+companyId) должен вернуть пустой список / список.

7. **Backend: добавить `offerService.convertOfferToInvoice`**
   - Найти точки интеграции в `invoiceService.js`. Если функции `createInvoiceFromSource` нет — добавить (минимальный обёртка над `Invoice.create` + `InvoiceItem` bulk).
   - Добавить controller-handler, route, schema.

8. **Manual API checks (curl / Postman / VS Code REST Client)**
   - `POST /api/orders` (draft), `PATCH /api/orders/:id`, `PUT /api/orders/:id/items`, `POST /api/orders/:id/actions/confirm`, `POST /api/orders/:id/actions/cancel`, `POST /api/orders/:id/actions/convert-to-invoice`.
   - Аналогично для offer convert-to-invoice.

9. **Frontend: RTK слайсы**
   - Создать `store/rtk/ordersApi.js` и `offersApi.js`.
   - Расширить `crmApi.tagTypes` (`OrderList`).
   - Обновить `realtime.js` маппинг.
   - В `ListPage/index.js` зарегистрировать источники.

10. **Frontend: shared OMS компоненты**
    - `OmsHeaderForm`, `OmsItemsTable`, `OmsTotalsSidebar`, `OmsStatusBadge`, `OmsStatusActionsMenu`, `OmsFiltersToolbar`, `OmsItemSearchPopover`, `useOmsTotalsCalc`, `omsStatusConfig`.
    - Тестировать каждый компонент изолированно (Storybook-like или просто через временный route).

11. **Frontend: страницы Orders**
    - `OrdersListPage` (table + filters + add).
    - `OrderEditorPage` (create / edit).
    - `OrderDetailPage` (view + actions).
    - Колонки `ordersColumns.js`.
    - Хук `useOrderFormState`.
    - i18n-ключи `oms.orders.*`, `menu.orders`.

12. **Frontend: страницы Offers**
    - Зеркально шагу 11.

13. **Frontend: меню и роуты**
    - `client/src/config/menu.js` — добавить пункты.
    - `client/src/App.js` — добавить роуты с `React.lazy`.

14. **UX polish**
    - Loading/empty/error states.
    - Sticky totals sidebar.
    - Status timeline в detail.
    - Action menu (Convert → Order / Invoice).
    - Конвертация Offer→Order — переход на детально нового заказа после успеха (с toast «Заказ создан №ZAM/...»).

15. **Final validation**
    - Полный e2e сценарий: создать Counterparty → создать Offer (draft → send → accept) → convert to Order (draft → confirmed → ship → complete) → convert to Invoice.
    - Проверить, что Documents/Invoices/Warehouse/Products не сломаны.
    - i18n-проверка для всех 4-х языков (`en, pl, ru, ua`).
    - SSE realtime: открыть две вкладки, изменить статус в одной — увидеть обновление в другой.
    - Permissions: пользователь без `order:convert` не видит кнопку «Convert to Invoice».

---

## 10. Acceptance Criteria

Задача считается готовой, когда выполняется ВСЁ нижеперечисленное:

### Backend

- [ ] `GET /api/orders` возвращает пагинированный список, фильтруется по company через JWT (никогда по payload).
- [ ] `GET /api/orders/:id` возвращает Detail DTO с items, sourceOffer, invoices, payments, availableActions, statusMetadata.
- [ ] `POST /api/orders` создаёт draft с автоматически сгенерированным номером (тип `ORDER`), либо принимает ручной номер. Конфликт unique → автоматический retry до 6 раз.
- [ ] `PATCH /api/orders/:id` — отклоняет смену `status` и `number`, обновляет остальные поля только если `status ∈ {draft, new, confirmed}`.
- [ ] `DELETE /api/orders/:id` — только для `draft` без связанных invoices/shipments.
- [ ] `PUT /api/orders/:id/items` — заменяет все позиции, пересчитывает totals на бэке.
- [ ] `POST /api/orders/:id/actions/{confirm,ship,complete,cancel,return}` — state machine с правильными таймштампами.
- [ ] `POST /api/orders/:id/actions/convert-to-invoice` — создаёт Invoice, привязывает к Order, логирует event.
- [ ] `POST /api/offers/:id/actions/convert-to-invoice` — создаёт Invoice из accepted Offer.
- [ ] Все DTO одинаково сериализуются — `OrderListDto` ↔ `OrderDetailDto` имеют согласованные имена полей.
- [ ] Все запросы валидируются Joi (`validateBody`, `validateQuery`).
- [ ] Все запросы проверяют `authorize('order:*')`.
- [ ] Totals совпадают между backend и frontend (одинаковые формулы) — sanity-check: создать заказ с известными числами и сверить.
- [ ] `OrderEvent` записи создаются при создании, обновлении, смене статуса, конвертации.
- [ ] Numbering для `ORDER` использует `documentNumberingService` (тип уже определён в `documentNumberingConfig`).
- [ ] Никаких `companyId` из `req.body` — только из JWT (`req.user.companyId`).

### Frontend

- [ ] Меню содержит `Offers` (Oferty) и `Orders` (Zamówienia) под секцией OMS — над «Invoices».
- [ ] Роуты `/main/oms/orders`, `/main/oms/orders/new`, `/main/oms/orders/:id`, `/main/oms/orders/:id/edit` работают (lazy-loaded).
- [ ] Роуты `/main/oms/offers/*` работают аналогично.
- [ ] `OrdersListPage` использует общий `ListPage` (table, фильтры, AddButton).
- [ ] `OffersListPage` — то же.
- [ ] Detail-страницы открываются как полноценная страница, либо в Modal при `?modal=1`.
- [ ] Editor-страница имеет двухколоночный layout с sticky totals sidebar.
- [ ] Items-table поддерживает drag-resort, inline-edit qty/price/vat/discount, добавление product через popover поиска товаров.
- [ ] Status badge соответствует backend-статусу, цвета консистентны с остальной CRM.
- [ ] Action-menu показывает только доступные действия (по `availableActions` из DTO).
- [ ] Convert Offer→Order успешно создаёт заказ и переходит на детально нового заказа.
- [ ] Convert Order→Invoice / Offer→Invoice — то же.
- [ ] Empty/Loading/Error states реализованы.
- [ ] i18n-ключи добавлены для всех 4 языков (en/pl/ru/ua).
- [ ] Realtime: создание/обновление/смена статуса в одной вкладке отображается во второй (SSE → tag invalidation).
- [ ] UI визуально совпадает по стилю с Counterparty/Documents (тёмная/glass, те же CSS-vars).
- [ ] Permission-guard: пользователь без `order:convert` не видит «Конвертация в инвойс».

### Не сломано

- [ ] Documents module работает (создание, редактирование, конверсия документа).
- [ ] Invoices работают.
- [ ] Counterparties работают (включая таб «Заказы» — теперь он может быть подключён к `useListOrdersQuery({ customerId })`).
- [ ] Products, Warehouse, Tasks, Notes, Chat — без регрессий.

### Качество

- [ ] Нет временных заглушек (`TODO()` без даты и без issue) в новых файлах, кроме отложенных stock-reservation (где уже есть `TODO(order-reservation)`).
- [ ] Старый `orderService.js`/`Order.controller.js` удалены (НЕ оставлены рядом в виде `.old`).
- [ ] Frontend Orders/Offers — единый стиль с Counterparty/Documents (тот же `ListPage`, тот же `FilterToolbar`).
- [ ] Все backend-запросы строго через companyId (никаких bypass).
- [ ] Все totals совпадают на backend и frontend (одинаковые формулы, одинаковая точность округления).
- [ ] План этого документа выполнен полностью, либо отклонения от плана описаны в PR-комментариях с обоснованием.

---

## Appendix A: ссылки на ключевые файлы

Backend:
- [server/src/services/oms/offerService.js](server/src/services/oms/offerService.js)
- [server/src/services/oms/orderService.js](server/src/services/oms/orderService.js) ← переписать
- [server/src/controllers/oms/Offer.controller.js](server/src/controllers/oms/Offer.controller.js)
- [server/src/controllers/oms/Order.controller.js](server/src/controllers/oms/Order.controller.js) ← переписать
- [server/src/routes/oms/offerRouter.js](server/src/routes/oms/offerRouter.js)
- [server/src/routes/oms/orderRouter.js](server/src/routes/oms/orderRouter.js) ← переписать
- [server/src/routes/rootRouter.js](server/src/routes/rootRouter.js) ← добавить `/orders`
- [server/src/schemas/offerSchema.js](server/src/schemas/offerSchema.js)
- [server/src/schemas/orderSchema.js](server/src/schemas/orderSchema.js) ← переписать
- [server/src/models/oms/order.js](server/src/models/oms/order.js)
- [server/src/models/oms/offer.js](server/src/models/oms/offer.js)
- [server/src/services/crm/documentNumberingService.js](server/src/services/crm/documentNumberingService.js)
- [server/src/services/crm/documentNumberingConfig.js](server/src/services/crm/documentNumberingConfig.js)
- [server/src/services/crm/documentConversionConfig.js](server/src/services/crm/documentConversionConfig.js)
- [server/src/services/crm/companyOrderSettingsService.js](server/src/services/crm/companyOrderSettingsService.js)
- [server/src/services/crm/companyOfferSettingsService.js](server/src/services/crm/companyOfferSettingsService.js)
- [server/src/services/oms/invoiceService.js](server/src/services/oms/invoiceService.js)

Frontend (эталон стиля):
- [client/src/pages/CRM/Counterparty/CounterpartiesPage/index.js](client/src/pages/CRM/Counterparty/CounterpartiesPage/index.js)
- [client/src/pages/CRM/Counterparty/CounterpartyDetailPage/index.js](client/src/pages/CRM/Counterparty/CounterpartyDetailPage/index.js)
- [client/src/pages/documents/DocumentsListPage.jsx](client/src/pages/documents/DocumentsListPage.jsx)
- [client/src/pages/documents/DocumentDetailsPage.jsx](client/src/pages/documents/DocumentDetailsPage.jsx)
- [client/src/components/documents/](client/src/components/documents/)
- [client/src/components/data/ListPage/index.js](client/src/components/data/ListPage/index.js)
- [client/src/components/data/DataTable/index.js](client/src/components/data/DataTable/index.js)
- [client/src/store/rtk/crmApi.js](client/src/store/rtk/crmApi.js)
- [client/src/store/rtk/documentsApi.js](client/src/store/rtk/documentsApi.js)
- [client/src/store/rtk/realtime.js](client/src/store/rtk/realtime.js)
- [client/src/config/menu.js](client/src/config/menu.js)
- [client/src/App.js](client/src/App.js)
