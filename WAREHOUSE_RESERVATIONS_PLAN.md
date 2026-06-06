# Warehouse Reservations — Аудит архитектуры и план подключения к Orders

> Статус: **только анализ**. Код не менялся, миграции/модели не создавались.
> Дата аудита: 2026-05-29.
> Цель: безопасно подключить резервации склада к Orders, не сломав текущий Warehouse / PIM / Documents / Invoices функционал.

---

## 0. TL;DR

- Таблицы под склад **уже существуют**: `inventory_items`, `reservations`, `stock_moves`, `warehouses`, `locations`, `lots`, `serials`, `receipts`, `shipments`, `transfer_orders`, `adjustments`, и т.д.
- Таблица `reservations` **уже спроектирована под Orders**: содержит `order_id`, `order_item_id`, `warehouse_id`, `product_id`, `variant_id`, `qty`, `status ENUM('active','fulfilled','cancelled')` и `UNIQUE(order_id, order_item_id)`.
- **НО рабочей логики склада нет.** `inventoryService.js` (`reserve` / `releaseReservation` / `applyMove` / `getOnHand`) обращается к **несуществующим полям** и не совпадает со схемой БД → при вызове падает либо тихо ничего не делает. Это сгенерированный «скелет», который никогда не работал.
- В `orderService` и `invoiceService` **уже зарезервированы точки расширения** (`shouldReserveProducts(...)` + `TODO(order-reservation)`, `shouldCreateWarehouseDocument(...)` + `TODO(invoice-stock-update)`).
- Документная нумерация **уже поддерживает PZ/WZ/MM/RW/PW** и ORDER.
- У `Product` есть собственные поля `stock_quantity` / `reserved_quantity` / `ordered_quantity` / `track_inventory` — **второе, параллельное представление остатков**, которое сейчас редактируется только вручную (CRUD), ничем не пересчитывается.
- `Order` / `OrderItem` **не содержат `warehouse_id`**. У `Warehouse` нет флага «по умолчанию».
- Cron-задач пересчёта остатков **нет**.

**Вывод:** фундамент (таблицы + точки расширения) есть, но «движок» остатков и резерваций отсутствует/сломан. Это и хорошо (не нужно ломать рабочую логику — её нет), и требует осторожности (есть параллельные представления остатков, которые легко рассинхронизировать).

---

## 1. Что уже есть

### 1.1. Модели и таблицы (WMS)
Полный набор моделей в `server/src/models/wms/`:
`warehouse`, `location`, `lot`, `serial`, `inventoryitem`, `reservation`, `stockmove`, `receipt(+item)`, `transferorder(+item)`, `pickwave`, `picktask`, `shipment(+item)`, `parcel`, `adjustment(+item)`, `cyclecount`, `countitem`.

Все имеют миграции в `server/src/migrations/2025082310*` (создано одной пачкой).

#### `reservations` (`server/src/migrations/20250823102940-create-reservation.js`)
| Поле | Тип | Заметки |
|---|---|---|
| `company_id` | UUID NOT NULL | FK → companies (cascade) |
| `order_id` | UUID NOT NULL | FK → orders (cascade) |
| `order_item_id` | UUID NOT NULL | (FK не объявлен явно) |
| `warehouse_id` | UUID **NOT NULL** | FK → warehouses |
| `product_id` | UUID NOT NULL | |
| `variant_id` | UUID nullable | |
| `qty` | DECIMAL(14,4) | default 0 |
| `status` | ENUM('active','fulfilled','cancelled') | default 'active' |

**Ключевая деталь:** `UNIQUE(order_id, order_item_id)` → не больше одной резервации на строку заказа. Это бесплатная защита от double-reserve на уровне строки.

#### `inventory_items` (`...102933-create-inventory-item.js`)
- `qty_on_hand` DECIMAL(14,4) default 0, `qty_reserved` DECIMAL(14,4) default 0.
- Гранулярность: `warehouse_id` + `location_id` + `product_id` + `variant_id` + `lot_id` + `serial_id`.
- `UNIQUE(location_id, product_id, variant_id, lot_id, serial_id)` — обратите внимание: company/warehouse в ключ не входят (location уже привязан к складу), а nullable-поля (`variant/lot/serial`) в PostgreSQL считаются различными при NULL → возможны дубли строк с NULL-вариантом (подводный камень для upsert).

#### `stock_moves` (`...102946-create-stock-move.js`)
- Журнал движений (ledger). `type ENUM('receipt','putaway','pick','pack','ship','adjustment','transfer') NOT NULL`.
- `warehouse_id`, `from_location_id`, `to_location_id`, `product/variant/lot/serial`, `qty`, `ref_type STRING(32)`, `ref_id`.
- Индекс `(ref_type, ref_id)` — задумано как привязка движения к документу-источнику.

### 1.2. Существующие warehouse-документы
- **Приход (PZ):** `receiptService.create` генерирует номер PZ (`assertDocumentTypeEnabled` + `generateNextDocumentNumber`), `receiptService.receiveLine` пытается оприходовать через `Inventory.applyMove` (см. ниже — сломано).
- **Перемещение (MM):** `transferService` / `transferOrderService` — генерация номера MM, движения через `applyMove`.
- **Выдача (WZ):** `shipmentService.create` — **БЕЗ нумерации и без типа документа** (просто `status:'open'`). `shipmentService.shipItem` зовёт `applyMove` (сломано). То есть WZ как полноценный документ списания сейчас не реализован.

### 1.3. Документная инфраструктура (CRM)
- `documentNumberingConfig.js` и `warehouseDocumentSettingsConfig.js` уже знают типы **PZ, WZ, MM, RW, PW** (+ ORDER).
- `companyWarehouseDocumentSettingsService` (`shouldCreateWarehouseDocument`, `getCompanyWarehouseDocumentSettingsForUsage`) + миграция `20260424170000-create-company-warehouse-document-settings` — настройка «нужно ли автосоздавать складской документ и каким типом нумеровать».
- `documents/templateRegistry/docTypes/wz.json` — шаблон печати WZ существует.

### 1.4. Уже готовые «точки расширения» (важно!)
- `server/src/services/oms/orderService.js:1114` — внутри `createOrder`:
  ```js
  if (shouldReserveProducts(orderSettings)) {
    // TODO(order-reservation): reserve stock for order items when reservation flow is implemented.
  }
  ```
- `server/src/services/crm/companyOrderSettingsService.js:378` — `shouldReserveProducts()` завязан на настройку `orderProductReservationMode === 'enabled'`.
- `server/src/services/oms/invoiceService.js:82` — внутри `issue`:
  ```js
  if (shouldCreateWarehouseDocument(invoiceSettings)) {
    // TODO(invoice-stock-update): create warehouse issue document from invoice ...
  }
  ```

### 1.5. Stock-поля на уровне Product (PIM)
`server/src/models/pim/product.js`: `stock_quantity`, `reserved_quantity`, `ordered_quantity`, `track_inventory`.
- Управляются только через `productService` CRUD (есть в `productSchema.js`, в колонках списка и на ProductDetailPage).
- **Никем не пересчитываются** — это ручной кэш, не вычисляемое значение.
- Поля `available_quantity` нет (доступное = `stock_quantity - reserved_quantity` нигде не считается).

### 1.6. Orders (OMS)
- Статусы: `draft → new → confirmed → paid → shipped → completed`, плюс `cancelled` / `returned`. Переходы строго заданы (`STATUS_TRANSITIONS`).
- `confirmedAt` / `shippedAt` / `completedAt` / `cancelledAt` проставляются в `changeOrderStatus`.
- `EDITABLE_STATUSES = {draft, new, confirmed}` → **строки заказа можно менять даже в статусе `confirmed`** (важно для логики освобождения резерва).
- `deleteOrder` разрешён только для `draft` и блокируется при наличии invoices/payments/shipments.
- `withTx` (`server/src/utils/tx.js`) умеет принимать внешнюю транзакцию → логику резерва можно встроить в транзакцию заказа.

---

## 2. Чего не хватает

1. **Рабочего движка остатков.** `inventoryService.js` обращается к полям, которых нет в схеме:
   - читает `inv.qty`, `inv.reservedQty` (в БД — `qty_on_hand`, `qty_reserved`) → получает `undefined`, арифметика даёт `NaN`;
   - `reserve()` создаёт `Reservation` с `inventoryItemId`, `orderRef`, `status:'reserved'` — таких полей нет, `status` не входит в ENUM, а обязательные `order_id`/`order_item_id` не передаются → **NOT NULL / ENUM violation**;
   - `releaseReservation()` ставит `status:'released'` (нет в ENUM);
   - `applyMove()` создаёт `StockMove` с `reason`/`status` (нет таких колонок) и **без обязательного `type`** → падение.
   - Эти функции вызываются из `receiptService`, `shipmentService`, `transferService`, `pickService`, `adjustmentService`, `inventory.controller` → **весь слой мутации остатков нерабочий.**
2. **`reservationService.js`** — это generic CRUD, без какого-либо влияния на остатки.
3. **Нет связи Order → reservation.** Ни `createOrder`, ни `changeOrderStatus(confirmed)` не создают резерваций (только TODO).
4. **Нет связи Invoice/Shipment → списание.** WZ как документ списания не реализован.
5. **Нет понятия `available` (доступно к продаже)** ни на уровне продукта, ни на уровне склада.
6. **Нет default-склада.** `Order` без `warehouse_id`, `Warehouse` без флага «по умолчанию» → непонятно, на каком складе резервировать.
7. **Нет защиты от отрицательных остатков** (проверка в `applyMove` есть, но на несуществующих полях → не срабатывает).
8. **Нет cron/recalc** для пересчёта/сверки `qty_reserved` ↔ сумма активных резерваций.
9. **`Reservation.associate()` пуст** — нет ассоциаций с Order/OrderItem/Product (нельзя удобно делать eager load).
10. **Две несинхронизированные модели остатков** (`Product.*_quantity` vs `inventory_items.*`) — это источник будущих рассинхронов.

---

## 3. Где логически должны храниться reservations

### Вариант A — отдельная таблица `reservations` (она уже есть)
**Плюсы:**
- Таблица уже спроектирована под Orders (`order_id`, `order_item_id`).
- `UNIQUE(order_id, order_item_id)` бесплатно защищает от double-reserve на строку.
- Явная сущность: легко показывать «что зарезервировано под этот заказ», легко освобождать по `order_id`.
- Резервация — это намерение, а не движение склада; отделение от ledger корректно семантически.

**Минусы:**
- Нужен «счётчик доступного»: сам по себе ряд резервации не уменьшает остаток. Нужно либо инкрементить `qty_reserved`/`Product.reserved_quantity`, либо считать `available` агрегатом «на лету».
- `warehouse_id NOT NULL` требует решить вопрос выбора склада.
- Риск рассинхрона между таблицей резерваций и кэш-счётчиком.

### Вариант B — отдельные `stock_moves` (резерв как тип движения)
**Плюсы:**
- Единый журнал всех изменений, полная история.

**Минусы:**
- Резервация — не физическое движение товара; смешивать «намерение» и «движение» семантически грязно.
- В ENUM `stock_moves.type` нет типа `reserve` → нужна миграция ENUM (рискованно в PostgreSQL).
- Тяжело получить «текущий объём резерва на строку» — нужна агрегация со знаком.
- Нет уникального ключа на строку заказа → выше риск double-reserve.

### Вариант C — отдельные warehouse documents (резерв как документ, напр. «RZ»)
**Плюсы:**
- Вписывается в существующую документную нумерацию (PZ/WZ/MM/RW/PW).
- Хорошо для печатных/юридических документов и аудита.

**Минусы:**
- Тяжеловесно: документ + позиции + статусы + нумерация ради «мягкого» резерва.
- Резерв часто меняется при редактировании заказа → постоянное перевыпускание документов — это шум.
- Для MVP избыточно.

### Рекомендация
**Вариант A** (использовать существующую `reservations`). Это минимальное изменение, максимально совместимое с уже заложенной схемой. `stock_moves` оставить для фактических движений (приход/списание), а warehouse-документы — для фактической выдачи (WZ) в v2.

---

## 4. Когда создавать reservation

**Триггер: `Order` переходит в `confirmed`** (`changeOrderStatus(... 'confirmed')`).

Обоснование:
- `draft`/`new` — корзина/черновик, резервировать рано (создаст ложный дефицит).
- `confirmed` — заказ подтверждён, склад обязан «придержать» товар. Есть `confirmedAt`.

> Важно: текущая «заглушка» `shouldReserveProducts` стоит в `createOrder`, а не в `changeOrderStatus`. Для корректной семантики основную точку резерва логичнее поставить в `changeOrderStatus` при переходе `* → confirmed`. (Опционально: если компания создаёт заказы сразу в `confirmed` — обработать и этот путь.)

Резерв создаётся **по каждой строке** заказа, у которой есть `product_id` и `track_inventory = true` (кастомные строки без продукта — пропускаем).

---

## 5. Когда освобождать reservation

| Событие | Действие |
|---|---|
| **Order cancelled** | все резервации заказа → `cancelled`, откатить счётчик reserved |
| **Order returned** | резервации → `cancelled`/`fulfilled` по политике; вернуть товар отдельной приходной логикой (v2) |
| **Order items changed** (в статусе `confirmed`) | пересчитать резервации построчно: удалённые строки → release; изменённое кол-во → скорректировать `qty`; новые строки → reserve |
| **Order deleted** | сейчас удаление разрешено только для `draft` (резерва ещё нет) → каскад `ON DELETE CASCADE` по `order_id` подчистит ряды; счётчик при этом надо откатить **до** удаления |

> Подводный камень редактирования: `saveOrderItemsInternal` делает `OrderItem.destroy` + `bulkCreate` (полная замена строк) → `order_item_id` у новых строк другие. Значит «diff по `order_item_id`» работать не будет — нужно либо полностью пересоздавать резервации заказа в той же транзакции, либо менять стратегию пересоздания строк. Это ключевой момент интеграции.

---

## 6. Когда превращать reservation в фактическое списание

Кандидаты на «момент списания» (decrement `qty_on_hand` / `Product.stock_quantity` + `reservation.status = 'fulfilled'`):

| Триггер | Плюсы | Минусы | Подходит текущей архитектуре? |
|---|---|---|---|
| **Invoice created** | один клик «счёт» | счёт может быть проформой/авансом; счёт не выбирает склад/локацию; есть риск списать без отгрузки | средне |
| **Warehouse WZ created** | семантически верно (WZ = выдача), есть нумерация и шаблон | WZ как рабочий документ сейчас **не реализован** | идеально для **v2** |
| **Order → shipped / completed** | просто, не требует WMS-документов и выбора локации | нет «бумажного» документа выдачи | идеально для **MVP** |

### Рекомендация
- **MVP:** списание на переходе **`Order → shipped` (или `completed`)**. Это требует только: `reservation.status → 'fulfilled'`, уменьшение reserved-счётчика и уменьшение остатка. Без выбора локации/лота.
- **v2:** перенести списание на **создание WZ** (полноценный `stock_moves` type `ship`/`pick` с локацией/лотом), а Invoice/Order лишь триггерят создание WZ через уже существующий `shouldCreateWarehouseDocument`.

---

## 7. Как избежать проблем

### Double reserve
- `UNIQUE(order_id, order_item_id)` уже есть → одна строка резерва на строку заказа.
- На confirm — операция идемпотентная: «есть резерв по строке? → update qty, иначе create». Использовать `findOrCreate`/`upsert` в транзакции.
- Защита от повторного confirm: резервировать только при переходе из не-`confirmed` (валидатор переходов это уже гарантирует).

### Double issue (двойное списание)
- Списывать только из `reservation.status = 'active'`; после списания → `'fulfilled'`. Повторный вызов не находит `active` → ничего не делает.
- Запрет перехода `shipped → shipped`/идемпотентность по статусу заказа (уже частично есть в `STATUS_TRANSITIONS`).

### Race conditions
- Все операции — внутри одной транзакции заказа (`withTx` принимает внешнюю tx).
- При проверке доступности и инкременте счётчика — **`SELECT ... FOR UPDATE`** на строку остатка (`lock: t.LOCK.UPDATE`). Паттерн уже задумывался в `inventoryService.reserve` — переиспользовать его, но на правильных полях.
- Полагаться на уникальные ограничения как на финальный барьер (ловить `SequelizeUniqueConstraintError` и ретраить — как уже сделано для номеров заказов).

### Отрицательные остатки
- Перед резервом/списанием проверять `available = qty_on_hand - qty_reserved >= need` под блокировкой.
- Политика дефицита — настройкой компании: `hard` (запретить confirm) либо `soft` (разрешить, пометить backorder через `ordered_quantity`).
- На уровне БД (v2) — `CHECK (qty_on_hand >= 0)` / `CHECK (qty_reserved >= 0)`.

---

## 8. Какие migrations потенциально понадобятся (НЕ создавать сейчас)

> Список на будущее, как ориентир. Сейчас ничего не создаём.

1. **`Reservation`: расширение статуса** — при необходимости добавить `'released'`/`'partially_fulfilled'` в ENUM (сейчас только `active/fulfilled/cancelled`; для MVP хватает существующих, `cancelled` ≈ released).
2. **`Reservation`: индексы/FK** — индекс по `(company_id, product_id, variant_id, status)` для быстрого подсчёта активного резерва; явный FK на `order_items`.
3. **Company settings** — поле «склад по умолчанию для резерва» (или флаг `is_default` в `warehouses`), т.к. `reservations.warehouse_id` NOT NULL, а заказы безскладовые.
4. **`order_items.warehouseId`** (v2) — если резерв пойдёт по конкретному складу/строке.
5. **CHECK-констрейнты** на неотрицательность `qty_on_hand`/`qty_reserved` (v2).
6. **(если выберут учёт на уровне продукта)** — ничего: `Product.reserved_quantity`/`ordered_quantity` уже есть.

---

## 9. Какие backend services/routes будут затронуты

**Точно затрагиваются:**
- `server/src/services/oms/orderService.js` — `changeOrderStatus` (confirm/cancel/shipped/completed/returned), `saveOrderItemsInternal` (пересоздание строк → пересоздание резерва), `deleteOrder`.
- `server/src/services/crm/companyOrderSettingsService.js` — уже есть `shouldReserveProducts`; возможно добавить политику дефицита и default-склад.
- **Новый/починенный** «движок резерва»: либо переписать `server/src/services/wms/inventoryService.js` под реальную схему, либо вынести отдельный `reservationEngine` (предпочтительно, чтобы не тянуть сломанный код).

**Затрагиваются при v2 (списание/WZ):**
- `server/src/services/oms/invoiceService.js` (`issue` → `TODO(invoice-stock-update)`).
- `server/src/services/wms/shipmentService.js` (добавить WZ-нумерацию + рабочий `applyMove`).
- `server/src/services/wms/inventoryService.js`, `stockMoveService.js`.

**Роуты (уже смонтированы, починка контроллеров):**
- `server/src/routes/wms/reservation.router.js`, `inventory.commands.router.js`, `shipment.commands.router.js`.
- Read-only эндпоинт «доступно к продаже» для фронта (можно расширить product/inventory API).

**Не трогать без необходимости:** `receiptService` (PZ-приход) — он использует тот же сломанный `applyMove`; чинить «движок» нужно так, чтобы заодно не сломать приход (а скорее — починить и приход).

---

## 10. Какие frontend изменения понадобятся

- **Order detail** (`client/src/pages/oms/Orders/OrderDetailPage`): блок «Резервации» (что/сколько/склад/статус), бейдж «зарезервировано» на строках, индикатор дефицита.
- **Order editor** (`client/src/pages/oms/Orders/OrderEditorPage`): показ доступного остатка по строке, предупреждение при превышении доступного, поведение при редактировании подтверждённого заказа.
- **Product detail** (`client/src/pages/PIM/Product/ProductDetailPage`): уже показывает `stockQuantity`; добавить `reserved` и **`available = stock − reserved`** (вычислять в DTO на сервере, не вручную).
- **Warehouse documents**: список/детали резерваций (если решат показывать); в v2 — экран WZ.
- **i18n:** ключи во все 4 локали `client/src/i18n/locales/{en,pl,ru,ua}.json`.
- **RTK Query:** теги инвалидации для `Reservation`/`InventoryItem`, маппинг SSE-событий в `client/src/store/rtk/realtime.js`.

---

## 11. Риски для существующего функционала

| Модуль | Риск | Митигация |
|---|---|---|
| **Products** | `stock_quantity`/`reserved_quantity` сейчас редактируются вручную; автоведение резерва начнёт их перетирать → конфликт «ручное vs авто» | Чётко определить источник истины. На время MVP: авто-инкремент только `reserved_quantity`, `stock_quantity` оставить ручным; либо заблокировать ручное редактирование reserved. |
| **Warehouse** | Починка `applyMove` затронет PZ-приход/MM-перемещение (они зовут тот же сломанный код) | Чинить «движок» с тестами на приход/перемещение; не ломать `receiptService.receiveLine`. |
| **Documents** | Нумерация PZ/WZ/MM/RW/PW общая; ошибочное автосоздание WZ «сожжёт» номера | В MVP не трогать нумерацию; WZ — только v2 под флагом `shouldCreateWarehouseDocument`. |
| **Invoices** | Если списывать по счёту — проформы/авансы спишут товар без отгрузки | В MVP списание НЕ вешать на счёт; оставить TODO. |
| **Offers** | Оффер → заказ: при `createOrderFromOffer` заказ создаётся в `new` → резерв не должен срабатывать раньше confirm | Резерв только на confirm, не на создание. |
| **Orders** | `saveOrderItemsInternal` пересоздаёт строки (destroy+create) → старые резервации «повиснут»; редактирование в `confirmed` рассинхронит резерв | Пересоздавать резервации заказа в той же транзакции, что и строки; покрыть тестами. |
| **Общий** | Два представления остатков (`Product.*` vs `inventory_items.*`) рассинхронятся | MVP вести ОДНО представление (product-level), не включать оба сразу. |

---

## 12. Рекомендуемая архитектура

### MVP (минимум кода, максимум совместимости)
1. **Хранение:** существующая таблица `reservations` (Вариант A). По одной строке на `order_item`.
2. **Склад:** ввести «склад по умолчанию» (настройка компании или `warehouses.is_default`), т.к. `warehouse_id NOT NULL`. Если склад один — брать его.
3. **Счётчик доступного:** вести на уровне **`Product.reserved_quantity`** (product-level, без локаций/лотов). `available = stock_quantity − reserved_quantity` отдавать в DTO.
4. **Создание:** на `Order → confirmed`, по строкам с `product_id` и `track_inventory`, в транзакции заказа, под `FOR UPDATE`, с проверкой доступного (политика дефицита — настройка).
5. **Освобождение:** на `cancelled` / `returned` / редактировании строк / удалении — пересоздание/закрытие резерва в той же транзакции.
6. **Списание:** на `Order → shipped`/`completed`: `reservation → 'fulfilled'`, `reserved_quantity -=`, `stock_quantity -=`.
7. **Движок:** новый изолированный `reservationEngine` (НЕ опираться на сломанный `inventoryService`); `inventory_items`/`stock_moves` пока не трогаем.
8. **Флаг:** всё под `orderProductReservationMode === 'enabled'` (уже есть) → можно включать по компаниям, безопасный rollout.

### v2 (полноценный WMS)
1. Резерв и остатки переезжают на **`inventory_items` (`qty_on_hand`/`qty_reserved`)** с гранулярностью склад+локация+лот+серийник.
2. **Починить `inventoryService` под реальную схему** (`qty_on_hand`/`qty_reserved`, корректный `StockMove.type`, `ref_type/ref_id`).
3. Списание = создание **WZ** → `stock_moves` type `ship`/`pick`; Invoice/Order лишь триггерят WZ через `shouldCreateWarehouseDocument`.
4. `order_items.warehouse_id`, выбор склада/локации в UI заказа.
5. `Product.stock_quantity`/`reserved_quantity` становятся **производными** (агрегат из `inventory_items`), обновляются движком или периодическим recalc-job.
6. CHECK-констрейнты на неотрицательность; cron-сверка `qty_reserved` ↔ Σ активных резерваций.

---

## Итоговое summary

- **Фундамент есть, движка нет.** Таблицы `reservations`/`inventory_items`/`stock_moves` существуют и продуманы под Orders, но `inventoryService` — нерабочий сгенерированный скелет (поля не совпадают со схемой), а `reservationService` — голый CRUD.
- **Точки расширения уже заложены** в `orderService` (`shouldReserveProducts` + TODO) и `invoiceService` (`shouldCreateWarehouseDocument` + TODO) — встраиваться есть куда, без хирургии.
- **Главные развилки:** (1) на каком складе резервировать (нет default-склада, заказы безскладовые); (2) какое из двух представлений остатков вести (`Product.*` vs `inventory_items.*`) — в MVP только одно; (3) пересоздание строк заказа ломает привязку резерва по `order_item_id`.
- **Рекомендованный MVP-путь:** резерв в существующей `reservations`, склад по умолчанию, счётчик на `Product.reserved_quantity`, создание на `confirmed`, освобождение на `cancelled/returned/edit/delete`, списание на `shipped/completed`, всё под существующим флагом `orderProductReservationMode`. `inventory_items`/`stock_moves`/WZ — отложить в v2.

> Реализация в этом документе намеренно не приводится. Следующий шаг — согласовать развилки (склад по умолчанию, источник истины остатков, момент списания), затем планировать код.
