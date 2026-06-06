# WMS Phase 0 Audit

> Статус: **только аудит + план**. Код не меняли, миграции не создавали.
> Дата: 2026-05-29. Связано: [`WMS_PLAN_REALIZATION.md`](./WMS_PLAN_REALIZATION.md) (Фаза 0), [`WAREHOUSE_RESERVATIONS_PLAN.md`](./WAREHOUSE_RESERVATIONS_PLAN.md).
> Цель Фазы 0: оживить движок остатков (`applyMove`/`getOnHand`) без миграций.

---

## 1. Краткий вывод

**Что сломано:** `server/src/services/wms/inventoryService.js` — весь движок (`getOnHand`, `reserve`, `releaseReservation`, `applyMove`) обращается к полям, которых нет в моделях/БД. Это сгенерированный «скелет», который никогда не исполнялся успешно:
- читает `inv.qty` / `inv.reservedQty` — в схеме `qty_on_hand` / `qty_reserved` → `undefined`, арифметика даёт `NaN`;
- пишет `StockMove` с `reason` и `status:'done'` и **без обязательного `type`** → `NOT NULL`/unknown-column;
- пишет `Reservation` с `inventoryItemId`, `orderRef`, `status:'reserved'` и без обязательных `order_id`/`order_item_id` → `NOT NULL`/ENUM-violation.

**Кто зависит от сломанного движка (все упадут при вызове):**
| Сервис | Метод | Документ | В скоупе Phase 0? |
|---|---|---|---|
| `receiptService` | `receiveLine` → `applyMove` | PZ (приём) | **Да** (T0.2) |
| `transferService` | `executeLine` → `applyMove` ×2 | MM (перемещение) | **Да** (T0.3) |
| `shipmentService` | `shipItem` → `applyMove` | WZ (выдача) | Частично (Phase 1/2) |
| `pickService` | `completeTask` → `applyMove` | пикинг | Нет (Phase 2+) |
| `adjustmentService` | `create` → `applyMove` | RW/PW | Нет (Phase 3) |
| `inventory.controller` | `reserve`/`releaseReservation` | резерв | Контракт здесь, реализация Phase 2 |

**Можно ли чинить без миграций?** — **Да.** Реальная схема БД (миграции) совпадает с моделями; неправ только код `inventoryService`. Чтобы движок заработал, миграции не нужны. Поля для себестоимости (`unit_cost`) и `warehouses.is_default`/адрес — это Фазы 1/4 и потребуют миграций позже, но к Фазе 0 не относятся.

> Дополнительно: `pickService` сломан глубже остальных (см. §4) — он делает `include: { model: Reservation }`, но у `Reservation` **нет ассоциаций** (`associate()` пуст в `server/src/models/wms/reservation.js`), → запрос бросит «Reservation is not associated…». Это вне Phase 0, но зафиксировано.

---

## 2. Реальная схема моделей

Источник: модели `server/src/models/wms/*` + миграции `server/src/migrations/20250823102933/102940/102946` (совпадают).

| Model | Table | Real fields (attr → column) | Notes |
|---|---|---|---|
| `InventoryItem` | `inventory_items` | `id`, `companyId→company_id`, `warehouseId→warehouse_id`, `locationId→location_id`, `productId→product_id`, `variantId→variant_id?`, `lotId→lot_id?`, `serialId→serial_id?`, `qtyOnHand→qty_on_hand` (DECIMAL(14,4), NOT NULL, def 0), `qtyReserved→qty_reserved` (DECIMAL(14,4), NOT NULL, def 0) | Ассоциации: `belongsTo Location as 'location'`, `belongsTo Warehouse as 'warehouse'`. **UNIQUE(location_id, product_id, variant_id, lot_id, serial_id)** (см. §«NULL» ниже). **Нет** полей `qty`, `reservedQty`. |
| `StockMove` | `stock_moves` | `id`, `companyId`, `type ENUM` **NOT NULL**, `warehouseId`, `fromLocationId→from_location_id?`, `toLocationId→to_location_id?`, `productId`, `variantId?`, `lotId?`, `serialId?`, `qty DECIMAL(14,4) NOT NULL`, `refType→ref_type STRING(32)?`, `refId→ref_id UUID?` | Нет ассоциаций. **Нет** `reason`, **нет** `status`. Индекс `(ref_type, ref_id)`. |
| `Reservation` | `reservations` | `id`, `companyId`, `orderId→order_id` **NOT NULL**, `orderItemId→order_item_id` **NOT NULL**, `warehouseId→warehouse_id` **NOT NULL**, `productId` **NOT NULL**, `variantId?`, `qty DECIMAL(14,4) def 0`, `status ENUM('active','fulfilled','cancelled') def 'active'` | `associate()` пуст. **UNIQUE(order_id, order_item_id)**. **Нет** `inventoryItemId`, `orderRef`, `locationId`, `lotId`, `pickToLocationId`. Статусов `'reserved'/'released'/'picked'` **нет**. |
| `Warehouse` | `warehouses` | `id`, `companyId`, `code`, `name`, `isActive→is_active` | **Нет** `is_default`, **нет** адреса (нужны в Фазе 1). |

**Разрешённый enum `StockMove.type`:** `receipt`, `putaway`, `pick`, `pack`, `ship`, `adjustment`, `transfer`. (Любое значение вне списка → ошибка.)

---

## 3. Ошибки текущего inventoryService

Файл: `server/src/services/wms/inventoryService.js`.

| Function | Line | Wrong field / wrong logic | Correct field / expected logic |
|---|---|---|---|
| `getOnHand` | L13 | `r.qty - r.reservedQty` → `NaN` (полей нет) | `r.qtyOnHand` и (резерв из `reservations`, не из строки) |
| `getOnHand` | L8 | сигнатура `(companyId, {...})` | сохранить `companyId` (мультитенант), привести к новому контракту §5 |
| `reserve` | L23 | `inv.qty - inv.reservedQty` → `NaN` | `qtyOnHand` − reserved |
| `reserve` | L26 | `inv.update({ reservedQty: ... })` | поля `qtyReserved` (в MVP резерв вообще в таблице `reservations`, не в `inventory_items`) |
| `reserve` | L27 | `Reservation.create({ inventoryItemId, orderRef, status:'reserved' })` без `order_id/order_item_id` | колонок `inventoryItemId/orderRef` нет; `status` ∉ enum; `order_id`,`order_item_id`,`warehouse_id`,`product_id` обязательны |
| `releaseReservation` | L41 | `r.inventoryItemId` (нет колонки) | освобождать по `order_id`/`reservation.id`; reserved пересчитывать из `reservations` |
| `releaseReservation` | L42 | `inv.reservedQty` | `qtyReserved` |
| `releaseReservation` | L43 | `status:'released'` | допустимо только `'cancelled'` |
| `applyMove` | L54, L63 | `defaults:{ qty:0, reservedQty:0 }` | `{ qtyOnHand:0, qtyReserved:0 }` |
| `applyMove` | L57 | `from.qty - from.reservedQty < qty` → `NaN < qty` (false) → **защиты нет** | `from.qtyOnHand - reserved < qty` под `FOR UPDATE` |
| `applyMove` | L58, L66 | `update({ qty: ... })` | `qtyOnHand` |
| `applyMove` | L68 | `StockMove.create({ ..., reason, status:'done' })` без `type` | `type` обязателен; `reason/status` колонок нет; использовать `refType/refId` |

---

## 4. Все вызовы inventoryService

| Caller file | Function | Current call (упрощённо) | Problem | Required new call shape |
|---|---|---|---|---|
| `receiptService.js` (L80) | `receiveLine` | `applyMove(companyId,{warehouseId,productId,variantId,qty,toLocationId,lotId,reason:'receipt'},t)` | нет `type`; `reason` не колонка | `applyMove({type:'receipt',companyId,warehouseId,toLocationId,productId,variantId,lotId,qty,refType:'PZ',refId:receiptId},{transaction:t})` |
| `transferService.js` (L78, L90) | `executeLine` | две `applyMove` с `reason:'transfer-out'/'transfer-in'`, без `type` | нет `type`; `reason` не колонка | две `applyMove({type:'transfer',...,fromLocationId|toLocationId,refType:'MM',refId:transferId},{transaction:t})` |
| `shipmentService.js` (L24) | `shipItem` | `applyMove(companyId,{warehouseId,productId,variantId,qty,fromLocationId,lotId,reason:'shipment'},t)` | нет `type`; `reason` не колонка | `applyMove({type:'ship',...,fromLocationId,refType:'WZ',refId:shipmentId},{transaction:t})` |
| `pickService.js` (L26) | `completeTask` | `applyMove(...,{fromLocationId:r.locationId,toLocationId:r.pickToLocationId,lotId:r.lotId,reason:'pick'})` | нет `type`; **`r.locationId/pickToLocationId/lotId` у Reservation нет**; `include:{model:Reservation}` без ассоциации → throw; `r.status!=='reserved'`/`'picked'` ∉ enum | вне Phase 0; переписать в Phase 2 на pick→ship с реальными локациями |
| `pickService.js` (L8) | `createWave` | `PickWave.create({status:'open'})`, `PickTask.create({reservationId,status:'open'})` | `'open'` ∉ enum волны (`planned/picking/completed/cancelled`) и задачи (`new/done/cancelled`); `reservationId` нет колонки у PickTask | вне Phase 0 |
| `adjustmentService.js` (L15) | `create` | `applyMove(...,{qty:Math.abs(it.qtyDiff),...,reason:'adjustment'})`, `Adjustment.create({status:'open'})` | нет `type`; **`it.qtyDiff` ≠ модельное `qtyDelta`/`qty_delta`** → при persist дропается; `status:'open'/'done'` требует проверки модели adjustment | вне Phase 0 (Phase 3); `applyMove({type:'adjustment',...,refType:'RW'|'PW',refId:adjustmentId})` |
| `inventory.controller.js` (L20, L31) | `reserve`/`releaseReservation` | `svc.reserve(companyId, req.body)`, `svc.releaseReservation(companyId, req.params.id)` | вызывает сломанные методы | привести к новому контракту §5 (реализация Phase 2) |

> Все вызывающие сервисы обёрнуты в `withTx` и передают `t` в `applyMove`; сам `applyMove` тоже `withTx(fn, t)` → транзакция переиспользуется (не вложенная). Это корректно и сохраняется.

---

## 5. MVP contract нового inventoryService

> Принцип: один объект-аргумент + опции с `transaction`. `companyId` **обязателен везде** (мультитенант) — добавлен к запрошенным сигнатурам. Денежные/себестоимостные поля (`unitCost`) здесь не фигурируют — Фаза 4.

```js
// --- движение остатка (Phase 0) ---
applyMove({
  companyId,                 // required
  type,                      // required, ∈ enum stock_moves.type: receipt|putaway|pick|pack|ship|adjustment|transfer
  warehouseId,               // required
  fromLocationId = null,     // указан → списание (decrement qty_on_hand)
  toLocationId = null,       // указан → приход   (increment qty_on_hand)
  productId,                 // required
  variantId = null,
  lotId = null,
  serialId = null,
  qty,                       // required, > 0
  refType = null,            // 'PZ'|'WZ'|'MM'|'RW'|'PW'|'ORDER'... → stock_moves.ref_type
  refId = null               // id документа-источника → stock_moves.ref_id
}, { transaction })          // обязательно для мутаций; берёт FOR UPDATE на затрагиваемые строки
// → возвращает созданный StockMove (или пару при сквозном перемещении)

// --- чтения остатка (Phase 0) ---
getOnHand({ companyId, warehouseId, productId, variantId = null })     // Σ inventory_items.qty_on_hand
getReserved({ companyId, warehouseId, productId, variantId = null })   // Σ reservations.qty WHERE status='active' (НЕ inventory_items.qty_reserved в MVP)
getAvailable({ companyId, warehouseId, productId, variantId = null })  // = getOnHand − getReserved (hard-режим: не уходить ниже 0)

// --- резерв под заказ (контракт сейчас, реализация Phase 2) ---
reserveOrderItem({
  companyId, orderId, orderItemId, warehouseId, productId, variantId = null, qty
}, { transaction })
// логика: FOR UPDATE по ключу → если available < qty → AppError(409,'INSUFFICIENT_STOCK')
//         → upsert reservations (UNIQUE(order_id,order_item_id)), status='active'

releaseOrderReservations(orderId, { transaction })
// логика: все reservations(order_id, status='active') → status='cancelled'
//         (в MVP inventory_items.qty_reserved не трогаем; reserved считается из таблицы reservations)
```

**Заметки по контракту:**
- `applyMove` с обоими `fromLocationId` и `toLocationId` = перемещение внутри склада (одно движение). С одним из них = чистый приход/расход.
- Межскладское MM = два вызова `applyMove` (out из `fromWarehouse`, in в `toWarehouse`) — как уже сделано в `transferService`, но с `type:'transfer'`.
- `getReserved` берёт резерв из таблицы `reservations` (источник истины в MVP), а не из `inventory_items.qty_reserved` (это v2, резерв на уровне локации).
- Возврат остатка продукта в `Product.*` — отдельный шаг синхронизации (Phase 2, не движок).

---

## 6. Транзакции и блокировки

**Что есть сейчас:**
- `withTx` (`server/src/utils/tx.js`) корректно оборачивает `sequelize.transaction` и умеет переиспользовать переданную `t`.
- `inventoryService` **намеренно** использует `lock: t.LOCK.UPDATE` в `reserve`/`releaseReservation`/`applyMove` — то есть **намерение FOR UPDATE заложено**, но на сломанных полях. Паттерн переиспользовать.
- `receiptService/shipmentService/transferService/adjustmentService` оборачивают всё в `withTx` и передают `t` в `applyMove` → блокировки компонуются в одну транзакцию.
- `reservationService` (CRUD) — **без транзакций и без блокировок**.

**Где FOR UPDATE обязателен (новый движок):**
| Операция | Что лочим | Зачем |
|---|---|---|
| списание `fromLocation` (`applyMove` decrement) | строки `inventory_items` по ключу (warehouse+location+product+variant+lot+serial) | прочитать `qty_on_hand`/available и уменьшить атомарно, без гонок |
| перемещение MM (обе ноги) | строки источника и назначения | как выше; назначение через `findOrCreate` под lock |
| `reserveOrderItem` | строки `inventory_items` (warehouse+product+variant) + чтение `Σ reservations(active)` в той же tx | не допустить over-reserve при конкуренции (hard-режим) |
| `releaseOrderReservations` | строки `reservations` заказа | согласованный перевод в `cancelled` |
| проводка WZ (Phase 2) | как `applyMove` decrement + строки `reservations` | списать ровно один раз и закрыть резерв |

**Чтения** (`getOnHand/Reserved/Available`) — без транзакции допустимы для UI, **но** проверка доступности внутри `reserveOrderItem`/`applyMove` обязана идти под той же транзакцией с lock, иначе TOCTOU-гонка.

---

## 7. План правок Phase 0 (мелкие шаги)

> Все шаги — только в `server/src/services/wms/*`. Без миграций, без изменения моделей.

- **T0.1 — `inventoryService` rewrite.** Переписать `applyMove`/`getOnHand` под реальные поля (§2) и контракт (§5): `StockMove` с обязательным `type` + `refType/refId`; `inventory_items.qtyOnHand`; `findOrCreate` назначения под `FOR UPDATE`. Удалить `reason/status` из `StockMove.create`.
- **T0.2 — fix `receiptService.receiveLine`.** Передавать `type:'receipt'`, `refType:'PZ'`, `refId:receiptId`; убрать `reason`. Проверить, что PZ-приём увеличивает `qty_on_hand`.
- **T0.3 — fix `transferService.executeLine`.** Обе `applyMove` с `type:'transfer'`, `refType:'MM'`, `refId:transferId`; убрать `reason:'transfer-out/in'`.
- **T0.4 — add `getReserved`/`getAvailable`.** `getReserved` = Σ `reservations`(active); `getAvailable` = onHand − reserved. (Используются в T0.5 и Phase 2.)
- **T0.5 — hard oversell guard.** В `applyMove` при `fromLocationId`: под lock проверять `available >= qty`, иначе `AppError(409,'INSUFFICIENT_STOCK', {productId, warehouseId})`. Дефолт — hard.
- **T0.6 — tests / manual checks.** Покрыть §8. Включая «PZ→MM→stany сходятся» и «продажа сверх available падает». Прогнать `npm run smoke` в `/server`.

**Вне Phase 0 (зафиксировать, не трогать сейчас):** `shipmentService` (WZ-нумерация+проводка — Phase 1/2), `pickService` (переписать на pick→ship — Phase 2), `adjustmentService` (RW/PW — Phase 3), `inventory.controller.reserve` (реализация резерва — Phase 2).

**Подзадача T0.1a — NULL в UNIQUE-ключе `inventory_items`** (только дизайн, без внедрения):
- Проблема: `UNIQUE(location_id, product_id, variant_id, lot_id, serial_id)`, а `variant/lot/serial` nullable. В PostgreSQL `NULL ≠ NULL` в unique → constraint **не ловит** дубликаты строк с NULL-вариантом; при конкуренции возможны дубли.
- **Важно:** на корректность `qty_on_hand` это не влияет — `getOnHand` делает `SUM` по всем строкам ключа, поэтому суммарный остаток верен даже при фрагментации на дубли. Это вопрос гигиены данных, не корректности тотала.
- MVP-рекомендация: helper `findInventoryItemForUpdate({...})`, который строит `where` с явными `IS NULL` (Sequelize так и делает для `field: null` → `field IS NULL`) и `lock: t.LOCK.UPDATE`; читать/писать через него.
- Полное решение (позже, миграция): partial unique indexes на комбинации NULL/NOT NULL, **либо** generated-колонка `COALESCE(...)` с unique по ней, **либо** sentinel-UUID вместо NULL. В Phase 0 **не внедрять**.

---

## 8. Acceptance checklist

- [ ] **PZ receipt** (`receiptService.receiveLine`) увеличивает `inventory_items.qty_on_hand` на принятое кол-во в `toLocation`.
- [ ] **MM transfer** (`transferService.executeLine`) уменьшает `qty_on_hand` в `fromLocation` и увеличивает в `toLocation` (две `stock_moves` типа `transfer`).
- [ ] **ship / negative move** не даёт уйти ниже `available` → `AppError(409, INSUFFICIENT_STOCK)` (hard-режим).
- [ ] **`stock_moves`** создаются с обязательным `type` ∈ enum и заполненными `ref_type/ref_id`; без `reason/status`.
- [ ] **Нет обращений** к несуществующим полям (`inv.qty`, `reservedQty`, `StockMove.reason/status`, `Reservation.inventoryItemId/orderRef`, `status:'reserved'/'released'/'picked'`).
- [ ] **Ledger сходится:** `Σ stock_moves(+to / −from) по ключу == inventory_items.qty_on_hand`.
- [ ] Все мутирующие операции проходят под одной транзакцией с `FOR UPDATE` на затрагиваемых строках.
- [ ] `npm run smoke` (в `/server`) проходит; PZ/MM ручной прогон — ок.

---

> Реализация (код) намеренно не приводится. Следующий шаг после согласования — выполнить T0.1…T0.6 в `server/src/services/wms/`, начиная с `inventoryService`.
