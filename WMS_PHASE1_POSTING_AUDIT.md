# WMS Phase 1 Posting Audit (T1.2)

Дата аудита: 2026-05-29  
Формат: только аудит, без изменений бизнес-кода и без миграций.

## 1) Receipt

Проверено:
- `server/src/models/wms/receipt.js`
- `server/src/services/wms/receiptService.js`
- `server/src/controllers/wms/receipt.controller.js`
- `server/src/routes/wms/receipt.router.js`
- `server/src/routes/wms/receipt.commands.router.js`

### Какие статусы существуют
В модели `Receipt.status`:
- `draft`
- `received`
- `putaway`

`create` по умолчанию ставит `draft`, `receiveLine` переводит в `received`, когда все строки полностью приняты.

### Создаётся ли движение склада при create
Нет. В `receiptService.create(...)` создаются `Receipt` и `ReceiptItem`, но `Inventory.applyMove(...)` не вызывается.

Движение создаётся только в `receiptService.receiveLine(...)`:
- `type: 'receipt'`
- `refType: 'PZ'`
- `refId: receiptId`

### Есть ли confirm/post endpoint
Отдельного confirm/post endpoint нет.
Есть:
- `POST /api/receipts` и `POST /api/wms/receipts` (create)
- `POST /api/receipts/item/:itemId/receive` и `POST /api/wms/receipts/item/:itemId/receive` (line-level receive)

### Есть ли confirmedAt/postedAt
Нет. В модели `Receipt` полей `confirmedAt`/`postedAt` нет.

### Есть ли защита от повторной проводки
Полноценного posted-guard нет.

Что есть:
- `receiveLine` обновляет `qtyReceived` и статус документа.

Чего нет:
- флага/даты «документ проведён»;
- явной блокировки повторного `receiveLine` для уже полностью закрытых строк;
- проверки `qtyReceived + qty <= qtyExpected` до проводки.

Итог: от повторной проводки защита неполная.

---

## 2) Transfer

Проверено:
- `server/src/models/wms/transferorder.js`
- `server/src/models/wms/transferitem.js`
- `server/src/services/wms/transferService.js`
- `server/src/services/wms/transferOrderService.js`
- `server/src/controllers/wms/transfer.controller.js`
- `server/src/routes/wms/transfer.router.js`
- `server/src/routes/wms/transfer.commands.router.js`
- `server/src/controllers/wms/transferOrder.controller.js`
- `server/src/routes/wms/transferOrder.router.js`

### Какие статусы существуют
В модели `TransferOrder.status`:
- `draft`
- `in_transit`
- `received`

На практике command-flow (`transferService.executeLine`) статусы почти не использует: двигает остатки и увеличивает `movedQty`.

### Есть ли execute/post
Да, есть execute-level endpoint:
- `POST /api/transfers/item/:itemId/execute`
- `POST /api/wms/transfers/item/:itemId/execute`

Отдельного «post document» endpoint нет.

### Есть ли защита от повторного execute
Полноценной защиты нет.

Что есть:
- проверка доступного остатка в `Inventory.applyMove` (нельзя списать больше available);
- проверка, что в source location достаточно on-hand.

Чего нет:
- проверки `movedQty + qty <= planned qty`;
- общего `already executed/posted` guard на документ или строку.

### Какие stock_moves создаются сейчас
`transferService.executeLine(...)` создаёт **2 движения** на один execute:
1. Исходящее:
   - `type: 'transfer'`
   - `warehouseId: fromWarehouseId`
   - `fromLocationId` заполнен
   - `toLocationId` пуст
   - `refType: 'MM'`, `refId: transferId`
2. Входящее:
   - `type: 'transfer'`
   - `warehouseId: toWarehouseId`
   - `toLocationId` заполнен
   - `fromLocationId` пуст
   - `refType: 'MM'`, `refId: transferId`

---

## 3) Warehouse documents (PZ/WZ/MM)

Проверено:
- `server/src/services/crm/warehouseDocumentSettingsConfig.js`
- `server/src/services/crm/companyWarehouseDocumentSettingsService.js`
- `server/src/services/crm/documentNumberingConfig.js`
- `server/src/services/crm/documentNumberingService.js`
- `server/src/services/wms/receiptService.js`
- `server/src/services/wms/transferService.js`
- `server/src/services/wms/transferOrderService.js`
- `server/src/services/wms/shipmentService.js`

### Как работают numbering settings для PZ/WZ/MM
Типы настроек warehouse-document есть централизованно:
- `pz` -> numbering source/type `PZ`
- `wz` -> `WZ`
- `mm` -> `MM`

Default pattern:
- `PZ/{YYYY}/{MM}/{SEQ:4}` (UI/Fallback эквивалент)
- `WZ/{YYYY}/{MM}/{SEQ:4}`
- `MM/{YYYY}/{MM}/{SEQ:4}`

Есть enable/disable типа и валидация default типа в `companyWarehouseDocumentSettingsService`.

### Создаются ли номера автоматически
Да, но не для всех потоков одинаково:
- Receipt (`PZ`): авто-номер есть (`receiptService.create`, через `generateNextDocumentNumber`).
- Transfer (`MM`): авто-номер есть (`transferService.create` и `transferOrderService.create`).
- Shipment (`WZ`): в текущем `shipmentService.create` numbering не подключён.

### Есть ли already-posted guard
Системного posted-guard для PZ/MM/WZ сейчас нет.

Также в `documentNumberingService` уникальность/история для warehouse типов реализована только для:
- `PZ` -> таблица `receipts`
- `MM` -> таблица `transfer_orders`

Для `WZ` в текущей реализации `isNumberUsed/collectHistoricalNumbers` нет ветки на `shipments`, то есть WZ в текущем shipment flow не доведён до аналогичной полноты.

---

## 4) Inventory API

Проверено:
- `server/src/controllers/wms/inventory.controller.js`
- `server/src/routes/wms/inventory.router.js`
- `server/src/routes/wms/inventory.commands.router.js`
- `server/src/services/wms/inventoryService.js`
- дополнительно: `server/src/routes/wms/inventoryItem.router.js`

### Есть ли уже endpoint под “Stany”
Есть endpoint:
- `GET /api/wms/inventory/onhand`

Он возвращает агрегатный on-hand (сумма), а не полноценный список позиций по складу/локациям.

### Есть ли list inventory
Есть CRUD list по `inventory_items`:
- `GET /api/inventory-items`

Но это другой уровень (сырые строки таблицы остатков), не специализированный endpoint “Stany” с доменной агрегацией/представлением.

### Можно ли расширить существующий endpoint вместо нового
Да. Самый совместимый путь:
- расширять `GET /api/wms/inventory/onhand` (например, режим list/группировка/детализация),
- а не вводить новый namespace.

Это минимизирует diff и сохраняет текущую архитектуру WMS commands.

---

## Рекомендация по posting-модели (T1.2)

### Выбор: **Вариант B — draft + отдельный post**

Обоснование по текущей архитектуре:
1. Текущие сервисы уже разделяют create документа и movement-операции (receiveLine/executeLine).
2. Системного posted-guard сейчас нет, а в auto-post режиме это повышает риск повторных проводок.
3. Для Transfer уже есть execute-semantics, логично довести её до явного жизненного цикла draft -> posted.
4. Для Receipt line-level receive уже фактически является частичной проводкой; добавление явного post/close шага даст контроль идемпотентности.
5. Numbering и статусы по PZ/MM/WZ сейчас неоднородны; draft+post позволяет унифицировать поведение без ломки create flow.

Итого для Phase 1 безопаснее и архитектурно чище: оставлять create как подготовку документа, а проводку выносить в отдельное действие с явной защитой от повторного выполнения.
