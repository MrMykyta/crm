# WMS — Полный план реализации модуля (польский рынок)

> Статус: **план / архитектура**. Код не пишем, миграции/модели не создаём.
> Дата: 2026-05-29.
> Связанные документы: [`WAREHOUSE_RESERVATIONS_PLAN.md`](./WAREHOUSE_RESERVATIONS_PLAN.md) (резервации — часть этого модуля).
> Контекст: продукт ориентирован на польский рынок (валюта PLN по умолчанию, документы PZ/WZ/MM/RW/PW, номенклатура уже на польском).

---

## 0. TL;DR и принципы

- **Данные почти все есть.** В `server/src/models/wms/` уже лежат: `warehouse`, `location` (с зонами), `inventoryitem`, `stockmove`, `reservation`, `lot`, `serial`, `receipt(+item)`, `shipment(+item)`, `transferorder(+item)`, `pickwave`, `picktask`, `parcel`, `adjustment(+item)`, `cyclecount`, `countitem`. Это WMS-grade модель.
- **Движка нет.** `inventoryService.applyMove/reserve/release` обращаются к несуществующим полям → нерабочий сгенерированный скелет. Все сервисы документов (`receipt/shipment/transfer/adjustment/pick`) зовут этот сломанный движок. По сути остатки **никогда не двигались**.
- **Себестоимости нет нигде.** `lots` без цены, `receipt_items` без цены, у `Product` одна `cost`. Значит FIFO/LIFO/AVCO невозможны без слоя себестоимости (cost layers).
- **Нумерация** PZ/WZ/MM/RW/PW уже сконфигурирована (`documentNumberingConfig.js`, `warehouseDocumentSettingsConfig.js`), но реально подключена только к PZ (receipt) и MM (transfer).
- **Связки с OMS нет.** `Order`/`OrderItem` без `warehouse_id`; у `Warehouse` нет флага «по умолчанию» и адреса (нужен для WZ/JPK).

**Принципы реализации:**
1. **Один источник истины об остатках** — журнал движений `stock_moves` (ledger). `inventory_items.qty_on_hand` — это материализованная сумма ledger, а не независимая правда.
2. **Документ → проводка (posting) → движения.** Любое изменение остатка происходит только через проведённый складской документ (PZ/WZ/MM/RW/PW/инвентаризация). Никаких «ручных» правок `qty_on_hand` мимо документа.
3. **Идемпотентность и блокировки.** Проводка под `SELECT ... FOR UPDATE`, защита уникальными ключами, повторная проводка ничего не делает.
4. **Польская семантика документов** — типы, корректировки, инвентаризация, нумерация по периодам, экспорт под JPK_MAG.
5. **Поэтапность** — сначала починить движок, потом документы, потом оценку (FIFO/AVCO), потом «тяжёлое» (JPK, серийники в проде).

---

## 1. Текущее состояние (что переиспользуем / что чиним)

### 1.1. Модели и их state-машины (уже в БД)
| Модель | Таблица | Статусы / ключевые поля | Роль в польском WMS |
|---|---|---|---|
| `warehouse` | `warehouses` | `code`, `name`, `is_active` | склад. **Нет адреса и флага default** |
| `location` | `locations` | `warehouse_id`, `type ENUM(inbound,pick,bulk,buffer,staging,outbound)` | зоны/ячейки — WMS-grade |
| `inventory_item` | `inventory_items` | `qty_on_hand`, `qty_reserved`; UNIQUE(location,product,variant,lot,serial) | остаток по ячейке |
| `stock_move` | `stock_moves` | `type ENUM(receipt,putaway,pick,pack,ship,adjustment,transfer)`, `ref_type/ref_id` | журнал движений (ledger) |
| `reservation` | `reservations` | `order_id`,`order_item_id`,`qty`,`status ENUM(active,fulfilled,cancelled)`; UNIQUE(order,item) | резерв под заказ |
| `lot` | `lots` | `lot_number`,`mfg_date`,`exp_date` | партии. **Без цены** |
| `serial` | `serials` | `serial_number` | серийники |
| `receipt(+item)` | `receipts` | `status ENUM(draft,received,putaway)`, `inbound_location_id`; item: `qty_expected/qty_received` | **PZ** (приём) |
| `shipment(+item)` | `shipments` | `status ENUM(packing,shipped,cancelled)`, `order_id` | **WZ** (выдача) |
| `transfer_order(+item)` | `transfer_orders` | `status ENUM(draft,in_transit,received)`, `from/to_warehouse_id`; item: `moved_qty` | **MM** (перемещение) |
| `pick_wave/pick_task` | — | wave `ENUM(planned,picking,completed,cancelled)`; task `ENUM(new,done,cancelled)`, `order_id` | пикинг |
| `parcel` | `parcels` | `shipment_id`,`tracking_number` | посылки/доставка |
| `adjustment(+item)` | `adjustments` | item: `qty_delta` (signed) | **RW/PW** / корректировки |
| `cycle_count/count_item` | — | count `ENUM(planned,counting,reconciled)`; item: `qty_counted` | **инвентаризация** |

### 1.2. Что сломано / отсутствует (чинить)
1. `server/src/services/wms/inventoryService.js` — `applyMove/reserve/releaseReservation/getOnHand` на несуществующих полях (`inv.qty`, `reservedQty`, `StockMove.reason/status` без обязательного `type`, `Reservation.inventoryItemId/orderRef/status:'reserved'`). **Полностью переписать.**
2. Все доменные сервисы (`receiptService`, `shipmentService`, `transferService`, `pickService`, `adjustmentService`) зовут этот битый движок → не работают.
3. Нет слоя себестоимости (cost layers).
4. Нет нумерации WZ/RW/PW (только PZ, MM).
5. `Warehouse` без адреса/default; `Order` без склада.
6. Нет recalc/сверки и нет защиты от отрицательных остатков.
7. `Reservation.associate()` пуст; многие модели без ассоциаций.

---

## 2. Требования польского рынка

### 2.1. Складские документы (dokumenty magazynowe)
| Код | Польское название | Смысл | Влияние на остаток |
|---|---|---|---|
| **PZ** | Przyjęcie zewnętrzne | приём от поставщика | `+ on_hand`, создаёт cost-layer |
| **WZ** | Wydanie zewnętrzne | выдача клиенту | `− on_hand`, списывает себестоимость (FIFO/…) |
| **MM** | Przesunięcie międzymagazynowe | межскладское перемещение (часто пара **MM−** / **MM+**) | перенос между складами/локациями |
| **RW** | Rozchód wewnętrzny | внутренний расход (на производство, списание в затраты) | `− on_hand` |
| **PW** | Przyjęcie wewnętrzne | внутренний приём (из производства, излишек) | `+ on_hand` |
| **PZ/WZ korekta** | korekta dokumentu | корректировка ранее проведённого документа | сторно/доп. движение |
| **IN / AI** | Inwentaryzacja / Arkusz spisu z natury | инвентаризация (по закону периодически) | корректировки `± on_hand` через RW/PW или спец-документ |
| **ZW** | Zwrot wewnętrzny | внутренний возврат | `+ on_hand` |

> Семантика проводки PZ/WZ/MM/RW/PW едина: **документ в статусе «проведён» (zatwierdzony/posted) порождает строки `stock_moves`**; до проводки — только черновик, остаток не двигается.

### 2.2. Учёт стоимости запасов (UoR)
- **Ustawa o rachunkowości, art. 34 ust. 4** разрешает методы рознахода: **FIFO**, **LIFO**, **średnia ważona (AVCO)**, **szczegółowa identyfikacja**.
- **LIFO** легален по UoR, но **запрещён МСФО (IAS 2, с 2005)** → для компаний на IFRS недоступен; на практике нишевый.
- Метод выбирается на уровне компании (и не меняется произвольно) — настройка `inventory_cost_method`.
- Доминируют **FIFO** и **AVCO** → их делаем первыми, LIFO/szczegółowa — позже.

### 2.3. Прочие требования рынка
- **Numeracja** документов: последовательная по типу и по периоду (год/месяц) — уже есть `documentNumberingService` (PZ/WZ/MM/RW/PW). Нужны корректировки и сторно-номера.
- **Adres magazynu** на печатной форме WZ (обязательный реквизит) → добавить адрес складу.
- **JPK_MAG** — SAF-T для склада (PZ/WZ/RW/MM + stan), который налоговая может запросить. Нужен экспорт.
- **Inwentaryzacja** — оформление расхождений документами (нiедобор/излишек).
- **Korekty** — нельзя «молча» править проведённый документ; только сторно/корректировка с историей.
- Печать документов уже частично есть: `documents/templateRegistry/docTypes/wz.json`.

---

## 3. Целевая доменная модель и инварианты

### 3.1. Три величины остатка (на каждый ключ склад+локация+продукт+вариант+партия+серийник)
- **on_hand** — физически на складе (`inventory_items.qty_on_hand`).
- **reserved** — придержано под заказы (`inventory_items.qty_reserved`, агрегат активных `reservations`).
- **available = on_hand − reserved** — доступно к продаже/резерву (вычисляемое, не хранится отдельно).

### 3.2. Инварианты (бизнес-правила, проверять в транзакции)
1. `on_hand >= 0` (если политика «hard»; политика — настройка компании).
2. `reserved >= 0` и `reserved <= on_hand` (или допускаем over-reserve как backorder — настройка).
3. Сумма `stock_moves` по ключу == `on_hand` (ledger — источник истины; `qty_on_hand` — материализация).
4. Себестоимость списания = сумма стоимостей закрытых cost-layer по выбранному методу.
5. Проведённый документ неизменяем; изменение только через корректировку.

### 3.3. Уровни гранулярности (важная развилка)
- **Резервации** — уровень склад+продукт+вариант (без локации/партии) — как уже в схеме.
- **Остатки/движения** — уровень склад+локация+продукт+вариант+партия+серийник.
- На связке OMS→WMS резерв «материализуется» в конкретную локацию/партию только при пикинге/выдаче (WZ).

---

## 4. Складские документы — единая модель

### 4.1. Жизненный цикл (state machine), общий для PZ/WZ/MM/RW/PW
```
draft  →  posted (zatwierdzony)  →  corrected (skorygowany)
  │            │
  └─ deleted   └─ (нельзя удалить; только korekta/storno)
```
- `draft` — редактируется свободно, остаток не двигается.
- `posted` — проводка: создаются `stock_moves`, обновляются `inventory_items`, присваивается номер, документ замораживается.
- `corrected` — выпущена корректировка (сторно прежних движений + новые).

### 4.2. Маппинг документов на существующие модели
| Документ | Модель-носитель | Тип `stock_move` | Нумерация |
|---|---|---|---|
| PZ | `receipt(+item)` | `receipt` (+`putaway`) | `PZ` (уже есть) |
| WZ | `shipment(+item)` | `ship` (+`pick`) | **`WZ` (добавить вызов numbering)** |
| MM | `transfer_order(+item)` | `transfer` | `MM` (уже есть) |
| RW | `adjustment(+item)` с `qty_delta<0` или новый тип | `adjustment` | **`RW` (добавить)** |
| PW | `adjustment(+item)` с `qty_delta>0` | `adjustment` | **`PW` (добавить)** |
| Inwentaryzacja | `cycle_count/count_item` → авто-RW/PW | `adjustment` | спец/RW/PW |

> Рекомендация: не плодить новые таблицы под RW/PW — переиспользовать `adjustment` с явным `reason/docType` и знаком `qty_delta`. Тип документа (RW vs PW) определяется знаком и настройкой нумерации.

### 4.3. Проводка (posting) — единый сервис
Один `postingService.post(document, tx)`:
1. Валидация (склад активен, позиции корректны, доступность для исходящих).
2. Блокировка затрагиваемых `inventory_items` (`FOR UPDATE`).
3. Создание `stock_moves` с `ref_type` (= тип документа) и `ref_id` (= id документа).
4. Обновление `inventory_items.qty_on_hand` (и `qty_reserved` при выдаче зарезервированного).
5. Для приходов — создание cost-layer; для расходов — закрытие cost-layer по методу (FIFO/AVCO).
6. Присвоение номера (`generateNextDocumentNumber`), смена статуса на `posted`.
7. SSE-событие инвалидации.

---

## 5. Stock Engine (движок остатков) — переписать

Заменить битый `inventoryService.js` на корректный модуль (или новый `stockService`/`postingService`), работающий с **реальными** полями:

- `applyMove({ type, warehouseId, fromLocationId, toLocationId, productId, variantId, lotId, serialId, qty, refType, refId }, tx)`:
  - для `from` локации: `FOR UPDATE`, проверка `available >= qty` (политика дефицита), `qty_on_hand -= qty`;
  - для `to` локации: `findOrCreate` строки `inventory_items`, `qty_on_hand += qty`;
  - запись `StockMove.create({ type, warehouse_id, from/to, product/variant/lot/serial, qty, ref_type, ref_id })` (**c обязательным `type`**, без `reason/status`).
- `getOnHand` / `getAvailable` — агрегаты по правильным полям (`qty_on_hand`, `qty_reserved`).
- Обработка NULL-вариантов/партий (уникальный ключ `inventory_items` считает NULL различными — нормализовать к фиксированному «no-lot» поведению, чтобы не плодить дубли).
- **Защита от отрицательных остатков** — здесь, под блокировкой; политика `hard/soft` из настроек компании.

После починки движка автоматически «оживают» PZ-приход и MM-перемещение, которые его вызывают (проверить тестами, чтобы не сломать их семантику).

---

## 6. Резервации

Полностью описаны в [`WAREHOUSE_RESERVATIONS_PLAN.md`](./WAREHOUSE_RESERVATIONS_PLAN.md). Кратко в контексте WMS:
- Создание на `Order → confirmed`, освобождение на `cancelled/returned/edit/delete`.
- В MVP — product-level (`Product.reserved_quantity`), в WMS-версии — через `reservations` + `inventory_items.qty_reserved`.
- **«Материализация» резерва в выдачу:** при создании/проводке **WZ** резерв `active → fulfilled`, `qty_reserved -= qty`, `qty_on_hand -= qty` (или через пикинг pick_task → ship).

---

## 7. Wycena zapasów (FIFO / LIFO / AVCO) — слой себестоимости

### 7.1. Что нужно добавить (пререкизиты, миграции — позже)
- **Cost-layer** при каждом приходе: цена за единицу из строки PZ. Кандидаты хранения:
  - расширить `lots` (добавить `unit_cost`, `qty_remaining`, `received_at`), либо
  - отдельная таблица `cost_layers` (`product`,`variant`,`warehouse`,`unit_cost`,`qty_in`,`qty_remaining`,`source_move_id`,`received_at`).
- Цена прихода на строке PZ: добавить `unit_cost` в `receipt_items` (сейчас только количества).
- Стоимость списания на `stock_moves`: добавить `unit_cost`/`total_cost` (для COGS и отчётов стоимости).
- Настройка `inventory_cost_method ENUM(fifo, lifo, avco, specific)` на уровне компании (и/или продукта).

### 7.2. Алгоритмы
- **FIFO/LIFO**: при расходе закрывать cost-layer в порядке прихода (FIFO — старейшие, LIFO — новейшие), уменьшая `qty_remaining`; себестоимость = Σ(qty×unit_cost закрытых слоёв).
- **AVCO (средневзвешенная)**: поддерживать «скользящую среднюю» себестоимость на ключе; при приходе пересчёт, при расходе списание по текущей средней.
- **Szczegółowa identyfikacja**: по конкретной партии/серийнику (нужен `lot_id`/`serial_id` на движении).

### 7.3. Приоритет
1. **FIFO** (де-факто стандарт PL).
2. **AVCO** (массово у малого бизнеса).
3. LIFO (legal по UoR, но IFRS-banned — опционально).
4. Szczegółowa (вместе с полноценными партиями/серийниками).

> Это слой **денег**, отдельный от резерваций (штук). Включать после рабочего движка и партий.

---

## 8. Партии (lot) и серийники (serial)

- **Партии** — для FEFO (First Expired First Out) и szczegółowa identyfikacja; `lots.exp_date` уже есть. При выдаче — приоритет ближайшего срока годности (настройка `lot_strategy: fefo/fifo/manual`).
- **Серийники** — для дорогих/гарантийных товаров; `Product.isSerialized` уже есть в PIM. Движение строго по 1 шт на серийник.
- Включается флагами на продукте (`isLotTracked`, `isSerialized` — уже в PIM-схеме).

---

## 9. Inwentaryzacja (инвентаризация)

Переиспользовать `cycle_count/count_item`:
1. `planned` → создать лист подсчёта по локациям/складу (snapshot ожидаемых `qty_on_hand`).
2. `counting` → ввод фактических `qty_counted`.
3. `reconciled` → расчёт расхождений (`qty_counted − qty_on_hand`) и **авто-генерация корректировок**: излишек → PW, недостача → RW (через `adjustment` + проводка).
- Печатная форма «Arkusz spisu z natury», заморозка движений на время инвентаризации (опц.).

---

## 10. Интеграции

| С чем | Что делать | Где |
|---|---|---|
| **OMS Orders** | `confirmed` → reserve; `shipped/completed` → WZ-проводка/списание; решить вопрос склада (default-склад/выбор) | `orderService.changeOrderStatus`, hook `shouldReserveProducts` |
| **OMS Invoices** | опц.: счёт триггерит WZ через `shouldCreateWarehouseDocument` (`TODO(invoice-stock-update)`) | `invoiceService.issue` |
| **PIM Products** | `Product.stock/reserved/ordered` сделать **производными** от `inventory_items` (recalc/триггер), а не ручными | `productService` |
| **Documents (печать)** | формы PZ/WZ/RW/PW/MM + Arkusz spisu; WZ-шаблон уже есть | `documents/templateRegistry` |
| **Numbering** | подключить WZ/RW/PW (PZ/MM уже) + номера корректировок | `documentNumberingService`, `companyWarehouseDocumentSettingsService` |
| **Realtime (SSE)** | теги инвалидации `InventoryItem/StockMove/Reservation/Receipt/Shipment/...` | `client/src/store/rtk/realtime.js` |

---

## 11. Backend — что чинить / что добавлять (по файлам)

**Починить (переписать под реальную схему):**
- `server/src/services/wms/inventoryService.js` → корректный `applyMove/getOnHand/getAvailable`.
- `server/src/services/wms/shipmentService.js` → WZ-нумерация + проводка + связь с резервом.
- `server/src/services/wms/receiptService.js` → cost-layer при приёме (после слоя себестоимости).
- `server/src/services/wms/transferService.js`, `pickService.js`, `adjustmentService.js` → через единый posting.
- `server/src/services/wms/reservationService.js` → реальная логика резерва (сейчас голый CRUD).

**Добавить (новое, без миграций сейчас — только дизайн):**
- `postingService` (единая проводка документов).
- `costingService` (FIFO/LIFO/AVCO).
- `stockQueryService` (остатки/доступность/стоимость, «стан на дату»).
- `inventoryCountService` (инвентаризация → корректировки).
- `jpkMagService` (экспорт JPK_MAG) — поздняя фаза.

**Роуты/контроллеры:** уже смонтированы под `/api/wms/*` (`routes/wms/index.js`); привести команды (`*.commands.router.js`) к реальной логике; добавить эндпоинты «available», «stock value», «stock as of date».

**Не сломать:** PZ-приём и MM-перемещение зависят от движка — чинить с тестами.

---

## 12. Frontend

- **Меню/доступ:** `client/src/config/menu.js`, route-guards в `App.js`, permissions.
- **Страницы WMS:**
  - Stany magazynowe (остатки: on_hand / reserved / available / value) — список + фильтр по складу/локации/партии.
  - Dokumenty: PZ, WZ, MM, RW, PW — список/детали/проводка/печать/корректировка.
  - Inwentaryzacja — лист подсчёта, ввод, расхождения, проводка.
  - Локации/зоны и склады (CRUD + адрес + default).
- **OMS:** Order detail/editor — блок резерва, available по строке, индикатор дефицита (см. reservations plan).
- **PIM:** Product detail — `stock/reserved/available` (available считать в DTO).
- **RTK Query:** слайсы `wmsApi`/`inventoryApi`, теги и SSE-инвалидация.
- **i18n:** ключи во все 4 локали `client/src/i18n/locales/{en,pl,ru,ua}.json`.

---

## 13. Потенциальные миграции (НЕ создавать сейчас — ориентир)

1. `warehouses`: `address_*` (для WZ/JPK), `is_default`/`is_default_for_reservation`.
2. `receipt_items`: `unit_cost`, `currency`.
3. `stock_moves`: `unit_cost`, `total_cost`, опц. `posted_at`, `document_no`.
4. Cost-layers: расширить `lots` (`unit_cost`,`qty_remaining`,`received_at`) **или** новая таблица `cost_layers`.
5. Company settings: `inventory_cost_method`, `negative_stock_policy(hard/soft)`, `lot_strategy(fefo/fifo/manual)`.
6. `adjustments`: `doc_type(RW/PW)`, `reason`, `status`, `posted_at`, `number`; индексация.
7. Документные статусы: привести `receipt/shipment/transfer` к единому `draft/posted/corrected` (+ `corrected_by_id`).
8. CHECK-констрейнты неотрицательности `qty_on_hand`/`qty_reserved`.
9. `order_items.warehouse_id` (если резерв/выдача по конкретному складу/строке).

---

## 14. JPK_MAG / экспорт в бухгалтерию (поздняя фаза)

- **JPK_MAG** — структура SAF-T для склада: секции PZ, WZ, RW, MM + стан. Генерируется из проведённых документов и `stock_moves`.
- Предпосылка: корректные документы со статусами и нумерацией + себестоимость на движениях.
- Также: отчёт «stan magazynowy na dzień» (остаток на дату) и «obroty» (обороты) за период — строятся из ledger.

---

## 15. Дорожная карта (фазы)

| Фаза | Цель | Состав | Зависит от |
|---|---|---|---|
| **0. Fix engine** | оживить остатки | переписать `inventoryService` (`applyMove/getOnHand`), защита от минуса, тесты на PZ/MM | — |
| **1. Core stock** | остатки + документы PZ/WZ/MM | единый `postingService`, нумерация WZ, статусы `draft/posted`, страницы «Stany» + документы | Фаза 0 |
| **2. OMS link** | заказы двигают склад | reserve на confirm, WZ на shipped/completed, available в OMS/PIM | Фаза 1 + reservations plan |
| **3. RW/PW + Inwentaryzacja** | внутренние движения и инвентаризация | adjustment→RW/PW, нумерация RW/PW, cycle_count→корректировки | Фаза 1 |
| **4. Wycena** | FIFO/AVCO | cost-layers, `unit_cost` на PZ/движениях, `inventory_cost_method`, отчёт стоимости | Фаза 1 |
| **5. Партии/серийники** | FEFO, szczegółowa | lot/serial в выдаче, стратегии | Фаза 4 |
| **6. Compliance** | JPK_MAG, корректировки, «стан на дату», адрес на WZ | экспорт, korekty/storno, отчёты | Фазы 1–4 |

**Минимально полезный результат (после фаз 0–2):** реальные остатки, рабочие PZ/WZ/MM, резерв под заказы, доступность в заказах и продуктах. Это уже «настоящий» WMS для торговой компании.

---

## 16. Риски

| Риск | Митигация |
|---|---|
| Два представления остатков (`Product.*` vs `inventory_items.*`) рассинхронятся | один источник истины (ledger); `Product.*` — производные |
| Починка движка сломает PZ/MM | тесты на приём/перемещение до и после |
| Нумерация: ошибочная проводка «сожжёт» номера | номер присваивать только при `post`, в транзакции; корректировки отдельной серией |
| Отрицательные остатки/гонки | `FOR UPDATE` + проверка available + уникальные ключи + политика |
| Изменение проведённого документа | запрет; только korekta/storno с историей |
| NULL-варианты/партии → дубли строк остатка | нормализация ключа `inventory_items` |
| Себестоимость без партий некорректна | FIFO/AVCO только после cost-layers |
| Скоуп взрывается | строго по фазам; JPK/серийники — в конец |

---

## 17. Зафиксированные решения MVP (2026-05-29)

| # | Вопрос | Решение MVP | Отложено |
|---|---|---|---|
| 1 | Склад в заказе | **Один default-склад на компанию.** `warehouses.is_default` (или company setting `defaultWarehouseId`). В заказе склад не выбираем. | Мультисклад по строкам — v2 |
| 2 | Момент списания | `confirmed`→reserve; `cancelled/returned`→release; **`shipped`→создать/провести WZ + списание**; `completed` повторно не списывает. Списание на **WZ (склад)**, не на счёт. | — |
| 3 | Источник истины | **`inventory_items` + `stock_moves`.** `Product.stock_quantity/reserved_quantity` — производный кэш, синхронизируется после posting/recalc. | — |
| 4 | Метод оценки | **FIFO + AVCO**, default **FIFO** (V1). | LIFO — v3 (IFRS-ban, низкий спрос) |
| 5 | Партии/серийники | `lot_id`/`serial_id` **nullable на движениях**, без обязательности. UI/автоподбор партий — нет. | FEFO/serial tracking — v2/v3 |
| 6 | JPK_MAG | **Не сейчас.** Фаза 6, после стабильных PZ/WZ/MM/RW/PW + себестоимости. | Фаза 6 |
| 7 | Политика дефицита | **Hard по умолчанию** — нельзя резервировать/списывать больше `available`. | Soft/backorder — v2 |

### 17.1. Как решения сходятся в одну модель (MVP)
- **Источник истины об остатке (`on_hand`)** = `inventory_items` (агрегат `stock_moves`).
- **Источник истины о резерве (`reserved`)** = таблица `reservations` (по строке заказа, склад = default). `inventory_items.qty_reserved` **в MVP не трогаем** (резерв на уровне локации — это v2; в MVP локацию при резерве не выбираем).
- **`available`(product, variant, warehouse)** = `Σ inventory_items.qty_on_hand − Σ reservations.qty(active)` по этому складу/продукту/варианту. Это значение проверяется в hard-режиме при резерве и при списании.
- **`Product.*` кэш:** после каждой проводки/резерва пересчитывать `stock_quantity = Σ on_hand` и `reserved_quantity = Σ active reservations` по продукту (по всем складам). Плюс отдельная recalc-команда для сверки.

### 17.2. Пограничные случаи, которые порождают эти решения (нужно учесть в реализации)
1. **`confirmed → completed` напрямую (минуя `shipped`).** Текущие `STATUS_TRANSITIONS` это разрешают. Решение #2 говорит «списание на shipped». Чтобы заказ не «завершился» без списания и с висящим резервом, проводку WZ вешаем на **первый из переходов `shipped`/`completed`** с идемпотентным guard'ом (если уже проведено — пропуск). Это сохраняет правило «`completed` повторно не списывает».
2. **Hard-режим при `confirm`, если товара не хватает.** Резерв атомарный: если хотя бы одна строка не покрывается `available` — **весь переход `confirmed` откатывается** с ошибкой со списком дефицитных позиций (а не частичный резерв). (Поведение «частичный резерв» — это уже soft/v2.)
3. **Редактирование строк подтверждённого заказа.** `saveOrderItemsInternal` делает destroy+create строк → `order_item_id` меняются. Значит на каждое сохранение строк подтверждённого заказа **резервации заказа пересоздаём целиком в той же транзакции** (старые `cancel`/удалить, новые `reserve` с проверкой hard-доступности), а не диффим по `order_item_id`.

---

## 18. Детализация Фаз 0–2 (готово к старту)

> Уровень — задачи и критерии приёмки. Код/миграции по-прежнему не пишем. Миграции в задачах помечены «[migration design]» — это только проектирование схемы.

### Фаза 0 — Починка движка остатков
**Цель:** остатки реально двигаются; нельзя уйти в минус; PZ-приём и MM-перемещение работают.
- **T0.1** Переписать `inventoryService.applyMove` под реальную схему: `StockMove` с обязательным `type` и `ref_type/ref_id` (без `reason/status`); `inventory_items.qty_on_hand` (не `inv.qty`); `findOrCreate` строки назначения.
- **T0.2** `getOnHand`/`getAvailable` — корректные агрегаты по `qty_on_hand` и активным `reservations`.
- **T0.3** Hard-guard: под `FOR UPDATE`, перед уходом проверять `available >= qty`, иначе `AppError(409, 'INSUFFICIENT_STOCK')`.
- **T0.4** Нормализация ключа `inventory_items` для NULL `variant/lot/serial` (PostgreSQL считает NULL различными → иначе дубли строк остатка).
- **T0.5** Поправить вызовы движка в `receiptService.receiveLine` и `transferService` (передавать `type`), убедиться что PZ/MM не сломаны.
- **T0.6** Тесты: приход увеличивает `on_hand`; перемещение переносит; oversell блокируется; `Σ stock_moves == qty_on_hand`.
- **Acceptance:** PZ receive и MM transfer корректно меняют остаток; продажа/уход сверх available падает; ledger сходится.

### Фаза 1 — Core stock + документы PZ/WZ/MM + проводка
**Цель:** единый жизненный цикл документа и проводка; работает WZ; видны остатки.
- **T1.1** Default-склад: `warehouses.is_default` [migration design] + `resolveDefaultWarehouse(companyId)` (fallback — единственный активный склад).
- **T1.2** Адрес склада на `warehouses` [migration design] — реквизит для печатной формы WZ.
- **T1.3** Единый `postingService.post(document, tx)`: валидация → `FOR UPDATE` → `stock_moves` → обновление `inventory_items` → нумерация → статус `posted`. Статусы документов привести к `draft/posted` (+ задел `corrected`).
- **T1.4** WZ: `shipmentService` — нумерация `'WZ'` (`assertDocumentTypeEnabled`+`generateNextDocumentNumber`), проводка `ship`-движений, уменьшение `on_hand`. (Сейчас shipment без нумерации.)
- **T1.5** `stock_moves`: добавить `unit_cost`/`total_cost` [migration design] **уже сейчас**, чтобы не мигрировать дважды (значения подключим в Фазе 4).
- **T1.6** API + UI «Stany magazynowe»: `on_hand` / `reserved` / `available` по складу/локации; список документов PZ/WZ/MM с проводкой и печатью (WZ-шаблон уже есть).
- **T1.7** SSE-теги инвалидации: `InventoryItem`, `StockMove`, `Receipt`, `Shipment`, `TransferOrder`.
- **Acceptance:** из UI можно создать и провести PZ/WZ/MM; остаток меняется; WZ получает номер; на экране виден `available`.

### Фаза 2 — Связка с OMS (резерв + списание на shipped)
**Цель:** заказы двигают склад по решениям #2/#7.
- **T2.1** Движок резерва: на `Order → confirmed` создать `reservations` (1 строка/позиция, `warehouse_id = defaultWarehouse`), hard-проверка `available`; при дефиците — атомарный откат всего confirm (пограничный случай 2).
- **T2.2** Release: `cancelled`/`returned` → резервации `cancelled`; правка строк подтверждённого заказа → полное пересоздание резерва в транзакции (пограничный случай 3).
- **T2.3** Списание на `shipped` (или первого из `shipped`/`completed`): создать/провести WZ из заказа, резервации `active → fulfilled`, уменьшить `on_hand`; идемпотентный guard от повторного списания (пограничный случай 1).
- **T2.4** Синхронизация кэша `Product.*` после proводки/резерва (`stock_quantity = Σ on_hand`, `reserved_quantity = Σ active reservations`) + recalc-команда для сверки.
- **T2.5** Frontend: блок резерва и `available` по строкам в Order detail/editor, индикатор дефицита; в Product detail — `stock/reserved/available`.
- **Acceptance:** confirm резервирует и блокирует oversell; ship списывает ровно один раз; cancel освобождает; продукт показывает корректный `available`.

### После MVP (Фазы 0–2)
- **V1 (Фаза 4, закоммичено):** себестоимость FIFO+AVCO — cost-layers, `unit_cost` на PZ/движениях, `inventory_cost_method` (default FIFO), отчёт стоимости запасов.
- **Фаза 3:** RW/PW (через `adjustment`, знаковый `qty_delta`) + нумерация RW/PW + инвентаризация (`cycle_count` → авто-корректировки).
- **V2:** мультисклад/выбор склада в заказе, резерв на уровне локации (`inventory_items.qty_reserved`), soft/backorder, FEFO по партиям.
- **V3:** LIFO, серийники в UI, szczegółowa identyfikacja.
- **Фаза 6:** JPK_MAG, корректировки/сторно, «стан на дату».

---


## 19. Актуальный статус реализации и новый порядок работ (после T1.2c)

> Этот раздел фиксирует фактическое состояние после первых задач реализации. Он дополняет исходный план и нужен как рабочая дорожная карта для Codex/Claude.

### 19.1. Уже реализовано

| Блок | Статус | Комментарий |
|---|---:|---|
| `inventoryService.applyMove` | ✅ готово | Реальная мутация `inventory_items.qty_on_hand` + `stock_moves`, hard-guard от минуса |
| `getOnHand/getReserved/getAvailable` | ✅ готово | `reserved` считается из `reservations.status='active'`; `inventory_items.qty_reserved` в MVP не используется |
| PZ receipt applyMove | ✅ готово | Приём увеличивает остаток через `type='receipt'`, `refType='PZ'` |
| MM transfer applyMove | ✅ готово | Перемещение работает через `type='transfer'`, `refType='MM'` |
| Default warehouse resolver | ✅ готово | `company_warehouse_document_settings.default_warehouse_id` + fallback на первый active/MАIN |
| Idempotency PZ/MM | ✅ готово | Защита от повторного `receiveLine/executeLine`, лимиты `qtyReceived <= qtyExpected`, `movedQty <= qty` |
| Backend Stany API | ✅ готово | `GET /api/wms/inventory/stock-balances` |
| Frontend Stany page | ✅ готово | `/main/wms/stock-balances`, tabela: onHand/reserved/available |
| `stock_moves.ref_item_id` | ✅ готово | Line-level idempotency для PZ/MM; guard больше не конфликтует на одинаковых строках товара |
| PZ/MM backend list/detail | ✅ готово | PZ и MM имеют backend endpoints списка и карточки документа со строками |
| StockMove history | ✅ готово | История движений по документу, строке документа (`refItemId`) и товару |
| WZ backend | ✅ готово | `shipmentService` использует новый `inventoryService`, `type='ship'`, `refType='WZ'`, `refItemId` |
| WZ numbering | ✅ готово | `shipments.number` + нумерация `WZ` через `documentNumberingService` |
| WZ backend list/detail/history | ✅ готово | Endpoints `/api/wms/shipments`, detail, document history, item history |
| Orders → reservations → WZ | ✅ готово | `confirmed` резервирует, `cancelled/returned` освобождает, `shipped/completed` создаёт/проводит WZ и fulfilled reservations |
| Orders/WMS API smoke | ✅ готово | API-level сценарий через auth, warehouses, locations, PZ, orders, reservations, WZ, stock-balances |
| Warehouse/location API create fix | ✅ готово | `warehouseService.create` и `locationService.create` генерируют UUID на backend; POST больше не падает на `id=NULL` |
| RW/PW backend | ✅ готово | `adjustmentService` работает как `draft -> posted`, `type='adjustment'`, `refType='RW'/'PW'`, `refItemId` |
| RW/PW numbering | ✅ готово | `adjustments.number`, `document_type`, `status`, `posted_at`; нумерация `RW`/`PW` через `documentNumberingService` |
| RW/PW service smoke | ✅ готово | `smokeAdjustmentsRwPw.js` прошёл `13/13`, включая PW +10, RW -3, idempotent repeat post, history, rollback |
| Product stock cache | ✅ готово | `Product.stock_quantity` и `Product.reserved_quantity` синхронизируются из WMS после `applyMove`, reserve/release/fulfill; есть recalc-сервис и smoke |
| Frontend create forms PZ/RW/PW/MM | ✅ готово | `/main/wms/receipts/new`, `/main/wms/adjustments/new`, `/main/wms/transfers/new`; create + receive/post/execute actions; build passed |
| E4 create forms API verification | ✅ готово | `smokeWmsCreateFormsApi.js` подтвердил PZ create+receive, MM create+execute, RW/PW create+post; routes `/new` возвращают 200; frontend/backend build passed |
| Frontend inwentaryzacja UI | ✅ готово | `/main/wms/cycle-counts`, create/detail/counting view, add counted items, reconcile, difference summary, ссылки на созданные RW/PW; build passed |
| F2 inventory count API/UI verification | ✅ готово | API smoke через auth/company подтвердил create arkusz, add counted items, reconcile, RW/PW generation, stock-balances, adjustment detail links; routes/build passed |
| WMS print views | ✅ готово | HTML/print views для PZ/WZ/MM/RW/PW и arkusz inwentaryzacji; backend print DTO endpoints, frontend print routes/buttons, shared `WarehousePrintDocument`; build passed |
| Company Settings → Warehouse/WMS module | ✅ готово | `/main/company-settings/warehouse`: Overview, Magazyny, Lokalizacje, Ustawienia; create/update warehouses/locations; default warehouse setter; resolver проверен. (Старый путь `/main/company-settings/modules/warehouse` оставлен как compatibility redirect.) |
| G1.1 FIFO costing schema/models | ✅ готово | `receipt_items/adjustment_items/stock_moves` cost fields, `inventory_cost_method`, `cost_layers`, `stock_move_cost_allocations`, associations |
| G1.2 FIFO costingService | ✅ готово | `createIncomingLayer`, `consumeFifoLayers`, `transferFifoLayers`, `applyCostingForMove`; FIFO only, AVCO guard |
| G1.2b MM split target layers | ✅ готово | MM target side creates one layer per source FIFO allocation через `source_allocation_id` |
| G1.2d Opening balance service/gate | ✅ готово | `costingOpeningBalanceService`, `costingInitializedAt`, OPENING layers, outgoing guard `COSTING_NOT_INITIALIZED` |
| G1.3 FIFO costing wiring | ✅ готово | PZ/PW create layers, WZ/RW consume FIFO, MM переносит layers; smoke flows pass |
| G1.4 Opening balance API/UI | ✅ готово | `/api/wms/costing/opening-balance/*`, Company Settings → Warehouse/WMS → Wycena/FIFO, dry-run/initialize, COSTING_NOT_INITIALIZED UX |
| G2 stock valuation backend/UI | ✅ готово | `GET /api/wms/reports/stock-valuation`, FIFO value from `cost_layers.qty_remaining × unit_cost`, frontend `/main/wms/reports/stock-valuation` |
| G2.2 stock turnover backend | ✅ готово | `GET /api/wms/reports/stock-turnover`, period obroty from `stock_moves` + cost fields, groupBy product/warehouse/productWarehouse/documentType, smoke `15/15` |
| G2.2 stock turnover frontend | ✅ готово | `/main/wms/reports/stock-turnover`, WMS → Obroty magazynowe, filters dateFrom/dateTo/warehouse/product/currency/groupBy, totals cards, dynamic table, build passed |
| G2.3 stock as-of-date backend | ✅ готово | `GET /api/wms/reports/stock-as-of`, report `Stan magazynu na dzień` from `stock_moves`, groupBy product/warehouse/productWarehouse, smoke `15/15` |
| G2.3 stock as-of-date frontend | ✅ готово | `/main/wms/reports/stock-as-of`, WMS → Stan na dzień, datetime `asOf`, warehouse/product/currency/groupBy filters, totals/table, build passed |
| G2.4 inventory ledger backend | ✅ готово | `GET /api/wms/reports/inventory-ledger`, Karta magazynowa per product, running qty/value balance, document numbers, MM split rows, smoke `20/20` |
| G2.4 inventory ledger frontend | ✅ готово | `/main/wms/reports/inventory-ledger`, WMS → Karta magazynowa, required product/date filters, totals, running ledger table, document links, build passed |
| K1.1-K1.5 WMS corrections backend | ✅ готово | PZ→PZK, WZ→WZK, Order returned→auto WZK, FIFO reverse allocations, guards `LAYER_PARTIALLY_CONSUMED`, `DOCUMENT_ALREADY_CORRECTED`, `CORRECTION_OF_CORRECTION_NOT_ALLOWED`; smokes `27/27` и `18/18` |
| K1.6 WMS corrections UI | ✅ готово | Detail-page modal actions для full-line PZ/WZ corrections, original↔correction links, `/main/wms/documents?view=pzk|wzk`, RTK mutations, frontend build passed |
| K1.7 WMS corrections verification | ⚠️ частично | Backend/UI/workspace views OK; stock valuation корректен после PZK/WZK; gaps: inventory ledger, stock turnover и stock as-of пока не учитывают correction moves полностью |
| K1.8 correction-aware WMS reports | ✅ готово | `inventoryLedgerReportService` / `stockTurnoverReportService` / `stockAsOfReportService` распознают `PZ_KOREKTA` (outgoing) и `WZ_KOREKTA` (incoming); `documentType` нормализован в `PZK`/`WZK`; ledger резолвит номер из `receipts`/`shipments` через расширенный JOIN; smoke `smokeCorrectionAwareReports.js` `26/26`; регрессии ledger/turnover/asOf/valuation + K1.3/K1.5 + warehouse docs все зелёные. **WMS Corrections v1 = COMPLETE.** |
| Smoke scripts | ✅ готово | `smokeInventoryService`, `smokeWarehouseResolver`, `smokePostingIdempotency`, `smokeStockBalances` |

### 19.2. Важное ограничение текущей реализации

`stock_moves.ref_item_id` уже добавлен, поэтому новые PZ/MM движения имеют line-level guard. Риск ложной идемпотентности для новых документов устранён.

Остаётся только legacy-нюанс: старые `stock_moves` без `ref_item_id` могут попадать в fallback guard по `refType/refId/productId/variantId/lotId/type`. Это допустимо как временная совместимость для исторических данных.

### 19.3. Новый порядок работ до полноценного складского модуля

#### Этап A — укрепить фундамент документов

**A1. Добавить `ref_item_id` в `stock_moves`.** ✅ готово
- UUID nullable.
- Заполняется для PZ/MM.
- Добавлены индексы `ref_item_id` и `(ref_type, ref_id, ref_item_id)`.
- PZ/MM idempotency guard работает по конкретной строке документа.
- Для WZ/RW/PW использовать тот же contract при реализации.

**A2. Привести PZ/MM к стабильному contract.** ✅ готово
- PZ: `receipt -> receipt_items -> stock_moves`.
- MM: `transfer_order -> transfer_items -> stock_moves`.
- Повторная операция по уже проведённой строке не создаёт новые движения.
- Line-level idempotency работает через `stock_moves.ref_item_id`.

**A3. Добавить нормальный backend listing/detail для складских документов.** ✅ готово
- PZ list/detail.
- MM list/detail.
- StockMove history by document.
- StockMove history by document item через `refItemId`.
- StockMove history by product.

#### Этап B — WZ и связь с заказами

**B1. Починить `shipmentService` под новый `inventoryService`.** ✅ готово
- Убрана старая positional-сигнатура `applyMove`.
- Используется `type='ship'`, `refType='WZ'`, `refId=shipmentId`, `refItemId=shipmentItemId`.
- Hard-check available/source location выполняется в `inventoryService`.
- Line-level idempotency guard работает через `refItemId`.

**B2. Добавить WZ-нумерацию.** ✅ готово
- Используется `assertDocumentTypeEnabled({ documentType:'WZ' })`.
- Используется `generateNextDocumentNumber({ documentType:'WZ' })`.
- `shipments.number` добавлен, уникальность `(company_id, number)` для non-null.
- WZ получает номер при создании/проведении backend-документа выдачи.

**B3. Идемпотентное списание заказа.** ✅ готово
- Первый переход `shipped` или `completed` создаёт/проводит WZ.
- Повторный `completed` ничего не списывает.
- Если уже есть WZ/stock_moves по заказу — skip.
- API-level smoke подтвердил цепочку через реальные endpoints.

#### Этап C — резервации заказов

**C1. Реальный `reservationService`.** ✅ готово
- `reserveOrder(orderId)`.
- `releaseOrderReservations(orderId)`.
- `fulfillOrderReservations(orderId)`.
- Hard-mode: если хотя бы одной позиции не хватает — весь confirm откатывается с `409 INSUFFICIENT_STOCK` и `details.deficits[]`.

**C2. Интеграция с `orderService`.** ✅ готово
- `confirmed` → reserve.
- `cancelled/returned` → release.
- `shipped/completed` → WZ + fulfill reservations.
- `completed` после `shipped` не создаёт повторного списания.
- Service-level и API-level smoke подтверждают поведение.

**C3. Product stock cache.** ✅ готово
- Добавлен `productStockCacheService.js`.
- `recalcProductStock(companyId, productId, options)`.
- `recalcProductsStock(companyId, productIds, options)`.
- `recalcAllProductsStock(companyId, options)`.
- `stock_quantity = SUM(inventory_items.qty_on_hand)`.
- `reserved_quantity = SUM(reservations.qty WHERE status='active')`.
- Пересчёт подключён после `inventoryService.applyMove`, `reserveOrder`, `releaseOrderReservations`, `fulfillOrderReservations`.
- Smoke `smokeProductStockCache.js` прошёл `12/12`, включая PZ, confirm, ship, RW/PW и исправление испорченного cache через recalcAll.

#### Этап D — документы PW/RW/RX/PX и корректировки

> Для польского WMS базовые типы: PZ, WZ, MM, RW, PW. Если в UI нужны `RX/PX`, их нужно сначала точно определить в доменной модели: возврат/корректировка/внутренний документ. Не добавлять их как случайные коды без семантики.

**D1. Adjustment foundation.** ✅ готово
- `adjustmentService` починен под реальную схему и новый `inventoryService.applyMove`.
- Положительный `qty_delta` → PW.
- Отрицательный `qty_delta` → RW.
- Нумерация `PW`/`RW` подключена.
- `stock_moves.type='adjustment'`, `refType='RW'/'PW'`, `refItemId=adjustmentItemId`.
- Line-level idempotency работает через `ref_item_id`.

**D2. Backend API для PW/RW.** ✅ готово
- create adjustment draft.
- post adjustment.
- list/detail.
- history по документу.
- idempotency по `ref_item_id`.
- Service-level smoke `smokeAdjustmentsRwPw.js` прошёл `13/13`.

**D3. UI для PW/RW.** ✅ готово
- Список документов `/main/wms/adjustments`.
- Форма создания `/main/wms/adjustments/new`.
- Детали `/main/wms/adjustments/:id`.
- Items/history/summary через общий `WarehouseDocumentDetailPage`.
- Кнопка `Post` показывается только для `draft`.

**D4. Корректировки/возвраты.**
- PZ correction / WZ correction. ✅ Backend + UI готовы для MVP full-line corrections.
- Order returned → auto WZK. ✅ Готово для shipped/completed заказов; paid→returned допускается без WZK.
- Любая корректировка создаёт обратные `stock_moves`, а не редактирует старые движения.
- Отчёты требуют K1.8: ledger/turnover/as-of должны явно учитывать `PZ_KOREKTA` и `WZ_KOREKTA`.

#### Этап E — полноценный UI складского модуля

**E1. Главное меню WMS:**
- Stany magazynowe. ✅
- PZ. ✅
- WZ. ✅
- MM. ✅
- RW/PW. ✅
- Rezerwacje. ✅ через Orders → reservations flow
- Inwentaryzacja. ✅
- Magazyny/Lokalizacje/Ustawienia magazynu — ✅ przeniesione do Company Settings → Modules → Warehouse/WMS.
- Ruchy magazynowe — частично ✅ через history/document/product endpoints; отдельный общий экран движений можно добавить позже.

**E2. Общий document UI pattern.**
- List page. ✅ для PZ/MM/WZ/RW/PW
- Detail page. ✅ для PZ/MM/WZ/RW/PW
- Editor/create page. ✅ для PZ, MM, RW/PW
- Items table. ✅
- History block. ✅
- Totals/status block. ✅
- Actions: create ✅ для PZ/MM/RW/PW; receive ✅ для PZ; execute ✅ для MM; post ✅ для RW/PW draft.
- WZ manual create, print, cancel/correct — позже.

**E3. Print/export.** ✅ готово
- PZ print. ✅ `/main/wms/receipts/:id/print`
- WZ print. ✅ `/main/wms/shipments/:id/print`
- MM print. ✅ `/main/wms/transfers/:id/print`
- RW/PW print. ✅ `/main/wms/adjustments/:id/print`
- Arkusz inwentaryzacji print. ✅ `/main/wms/cycle-counts/:id/print`
- Реализовано как HTML/print view через browser print / print-to-PDF.
- Shared template: `WarehousePrintDocument`.
- PDF service/server-side PDF — позже.

#### Этап F — инвентаризация

**F1. Cycle count backend.** ✅ готово
- Создать arkusz spisu.
- Ввести counted qty.
- Reconcile.
- Автоматически создать RW/PW по расхождениям.
- Smoke `smokeInventoryCount.js` прошёл: PZ +10, count 7 → RW -3, count 12 → PW +5, rollback.

**F2. UI inwentaryzacja.** ✅ готово
- Список arkusze `/main/wms/cycle-counts`.
- Создание arkusz `/main/wms/cycle-counts/new`.
- Detail/counting view `/main/wms/cycle-counts/:id`.
- Добавление counted items.
- Difference summary.
- Кнопка Reconcile.
- Блок созданных RW/PW после reconcile со ссылками на adjustment detail.

#### Этап G — себестоимость и compliance

**G1. FIFO costing operationalization.** ✅ готово
- G1.1 schema/models: cost fields, `cost_layers`, `stock_move_cost_allocations`, `inventory_cost_method`.
- G1.2 service: FIFO incoming/outgoing/MM costing primitives.
- G1.2b: MM target layers keep split FIFO unit costs.
- G1.2d: opening balance service and `costingInitializedAt` guard.
- G1.3: FIFO wired into PZ/PW/WZ/RW/MM runtime flows.
- G1.4: opening balance API/UI in Company Settings → Warehouse/WMS.
- AVCO remains planned, not implemented.

**G2. Reports.** частично ✅
- Stock value. ✅ Backend + frontend готово: `/api/wms/reports/stock-valuation`, `/main/wms/reports/stock-valuation`.
- Obroty magazynowe. ✅ Backend + frontend готово: `/api/wms/reports/stock-turnover`, `/main/wms/reports/stock-turnover`.
- Stock as of date. ✅ Backend + frontend готово: `/api/wms/reports/stock-as-of`, `/main/wms/reports/stock-as-of`.
- Karta magazynowa / Inventory Ledger. ✅ Backend + frontend готово: `/api/wms/reports/inventory-ledger`, `/main/wms/reports/inventory-ledger`.

**G3. JPK_MAG.**
- Только после стабильных PZ/WZ/MM/RW/PW и себестоимости.

### 19.4. Ближайшая следующая задача

**K1.8 — correction-aware WMS reports** ✅ готово (2026-06-05)

Что сделано:
- `inventoryLedgerReportService` — `direction` CASE расширен на `WZ_KOREKTA` (in) и `PZ_KOREKTA` (out); `documentType` нормализован в `PZK`/`WZK`; JOIN к `receipts`/`shipments` расширен на correction ref_types, поэтому `documentNumber` приходит как `PZK/...` и `WZK/...`.
- `stockTurnoverReportService` — то же расширение `direction` и `documentType`. `groupBy=documentType` теперь выдаёт отдельные ведра `PZK`/`WZK`.
- `stockAsOfReportService` — `signed_qty`/`signed_value` CASE учитывают correction moves: `WZ_KOREKTA` увеличивает реконструированный остаток, `PZ_KOREKTA` уменьшает.
- `stockValuationReportService` — без изменений, корректность подтверждена smoke'ом (layer-based: `cost_layers.qty_remaining * unit_cost`).
- Smoke `server/scripts/smokeCorrectionAwareReports.js` — `26/26`. Покрытие: A) WZK, B) PZK, C) `groupBy=documentType` содержит PZK/WZK, D) asOf до и после correction.
- Регрессии: `smokeInventoryLedgerReport.js` 20/20, `smokeStockTurnoverReport.js` 15/15, `smokeStockAsOfReport.js` 15/15, `smokeStockValuationReport.js` 12/12, `smokeWmsCorrectionsPzkWzk.js` 27/27, `smokeOrderReturnedAutoWzk.js` 18/18, `smokeWarehouseDocumentsList.js` 29/29 — все зелёные.

Итог: **WMS Corrections v1 = COMPLETE.** Все четыре основные отчёта corrections-aware, transactional flow + auto-WZK + UI работают, ledger показывает PZK/WZK с running balance, asOf реконструирует остатки по дате с учётом коррекций.

PERF-0 переносится на общий этап после базового функционального закрытия WMS и будет выполняться уже для всей CRM, а не только WMS.
