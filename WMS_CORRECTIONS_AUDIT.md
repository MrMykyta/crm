# WMS K1 — Корректировки и сторно складских документов (аудит)

> Статус (на 2026-06-05): **WMS Corrections v1 = COMPLETE**. K1.1–K1.8 закрыты, transactional flow + auto-WZK по `order.returned` + UI + correction-aware reports все работают; смотри `WMS_PLAN_REALIZATION.md §19.1 / §19.4`.
> Документ остаётся как историческая база решений (audit-only) — отражает оригинальную дату 2026-06-03.
> Главное правило, утверждённое заказчиком: **проведённый документ не редактируем**. Корректировка создаёт новый документ и обратные `stock_moves`.

---

## 0. TL;DR

- **В коде нет ничего про korekty/storno складских документов.** Состояния `receipt/shipment/transfer/adjustment/cycle_count` не имеют `corrected` / `cancelled-with-reverse` / `parent_id` / `corrects_id` — это пробел в схеме и в API.
- **Прецедент только один — `INVOICE_CORRECTION`** (`documentNumberingConfig.js:12`, паттерн `FVK/{YYYY}/{MM}/{SEQ:4}`). Для складских документов аналога **нет**.
- **Costing-движок (G1.1–G1.3) частично реверсируется**, но не симметрично. `consumeFifoLayers` создаёт `StockMoveCostAllocation`-строки, по которым можно вычислить, какие layers и в каком количестве нужно вернуть; `createIncomingLayer` хранит источник через `sourceMoveId` (для MM target — `sourceAllocationId`), что даёт честный reverse для PZ/PW при условии, что layer ещё не consumed. Готовой функции `reverseLayer` / `reverseAllocations` нет.
- **Inventory cycle count уже косвенно генерирует корректировки** через автогенерацию RW/PW (`inventoryCountService.reconcileCycleCount` → `adjustmentService.create`). Это значит, что «корекция остатка после инвентаризации» уже использует обычные RW/PW — отдельный документный тип не нужен.
- **Сторно-вэй для shipment частично есть** (`shipment.status = 'cancelled'` уже в ENUM), но без сопутствующих reverse `stock_moves` и без сторно cost-allocations — то есть «cancelled» помечает документ, но не возвращает остаток. Это либо дефект, либо «legacy» статус из изначального скэффолдинга — в любом случае требует ревизии.
- **Рекомендация (MVP)**: **корекция = новый документ** одного из новых типов (`PZ_KOREKTA / WZ_KOREKTA / MM_KOREKTA / RW_KOREKTA / PW_KOREKTA`), линкованный на оригинал через `parent_document_id`, проведение которого порождает **обратные** `stock_moves` (с `qty` равной модулю дельты и противоположной семантикой направлений) и реверс соответствующих FIFO-allocations / layers. Оригинал получает финальный статус **`corrected`** (immutable, но с явной отметкой и ссылкой на корекцию). Никакой правки полей оригинала.

---

## 1. Текущее состояние (что есть в схеме сейчас)

### 1.1. State machines документов (фактически в моделях)
| Документ | Файл | ENUM статусов | Кто двигает |
|---|---|---|---|
| PZ (receipt) | `server/src/models/wms/receipt.js` | `draft → received → putaway` | `receiptService.receiveLine` ставит `received`, putaway-флоу планировался отдельно. |
| WZ (shipment) | `server/src/models/wms/shipment.js` | `packing → shipped → cancelled` | `shipmentService.shipItem` ставит `shipped` когда все линии закрыты. `cancelled` есть в ENUM, но в коде **никто** в него не пишет → «мёртвый» статус. |
| MM (transfer_order) | `server/src/models/wms/transferorder.js` | `draft → in_transit → received` | `transferService.executeLine` обновляет `movedQty`, но финального проставления статуса в коде нет (`received` приходится либо ставить вручную, либо доделать). |
| RW/PW (adjustment) | `server/src/models/wms/adjustment.js` | `draft → posted` (+ `documentType ENUM('RW','PW')`, `postedAt`) | `adjustmentService.post`. Уже идемпотентен по `refItemId`. |
| Cycle count | `server/src/models/wms/cyclecount.js` | `planned → counting → reconciled` | `inventoryCountService.reconcileCycleCount` → авто-создание RW/PW (см. ниже). |

### 1.2. Что отсутствует во всех документах
- **`parent_document_id` / `corrects_id`** — back-link от корекции к оригиналу.
- **`corrected_by_id`** / поле «эта запись отменена корекцией X» — forward-link.
- Финальный иммутабельный статус **`corrected`** (или `reversed`/`stornowany`) в ENUM статуса.
- Поля для аудита: `correctionReason`, `correctedAt`, `correctedBy`.
- Запрет правки `posted`/`received`/`shipped`/`reconciled` строк на уровне сервиса — формально нет (в `receiptService.receiveLine` есть idempotency-guard, но это не запрет правок, а защита от двойной проводки).

### 1.3. Что уже идёт «корректировкой через обычный документ»
- **Inventory reconcile.** `inventoryCountService.reconcileCycleCount` создаёт обычные RW (при недостаче) и PW (при излишке) через `adjustmentService.create(... documentType: 'PW' / 'RW' ...)`. Логически это и есть «корекция остатка после инвентаризации» — отдельный документ «inwentaryzacja-korekta» не нужен; нужна только привязка авто-RW/PW к исходному cycle count (это уже есть через `reconcileCycleCount → adjustment` поток, но без явной FK).
- **Order returned.** `orderService` имеет статус `returned` и переходы `paid/shipped/completed → returned` (строки 60–62), но **никакого автоматического WZ-storno нет**. Возврат фиксируется только на уровне статуса заказа; склад не реверсируется. Это самый явный недостающий кусок: возврат заказа клиента должен порождать WZ-корекцию (или PW-возврат) — сейчас не порождает.

### 1.4. Статус `shipment.cancelled` — мёртвый код
Существует в ENUM, но `grep -rn "Shipment.*cancel\|status.*cancelled"` в `services/wms`/`services/oms` показывает: запись в это значение делается только для `Reservation` (не `Shipment`) и для `Invoice`. То есть **никто реально не помечает shipment cancelled** — это «legacy» из изначального скэффолдинга. Без реверса `stock_moves` и cost-allocations этот статус сам по себе бесполезен (если выставить — то stock уже выехал, и его никто не вернул). Документ либо нужно перевести на новую модель корекций, либо явно зарезервировать `cancelled` под «cancelled before shipping» (до проводки), что согласуется с переходом `packing → cancelled` (без выхода на `shipped`).

### 1.5. Costing-снимки на `stock_moves`
После G1.3 каждый `stock_move` имеет `unit_cost`/`total_cost`/`currency`/`cost_method`. Реверс должен сохранять эти снимки на парном reverse-move, чтобы COGS-отчёты симметрично «отнимали» сторнованную стоимость. Без этого корекция WZ оставит COGS на отчёте, но без компенсации.

---

## 2. Польские требования (UoR + практика)

- **«Korekta» vs «storno».** В польском бухучёте оба термина в ходу, и инструменты их различают:
  - **Storno** — полный (или с противоположным знаком) реверс документа. Обычно используется для технической отмены сразу после проводки или для отзыва ошибочной операции.
  - **Korekta** — содержательная коррекция конкретных строк (изменение количества, цены, единиц, контрагента). Может быть и положительной, и отрицательной по знаку. Используется при возврате, при ошибке в qty/cost после факта.
- **Документная пара.** Стандарт ERP в PL (Comarch, Subiekt, enova): корекция/сторно — это **отдельный документ** с собственным номером в собственной серии (`PZK/...`, `WZK/...`, `MMK/...`), связанный с оригиналом FK-ссылкой (наша терминология `parent_document_id`). После проводки корекции **оригинал не редактируется**, только помечается «skorygowany / stornowany».
- **JPK_MAG** ожидает реверсивные движения как **новые строки `stock_move`** с обратным знаком и собственным `refType/refId`, ссылающиеся на оригинал. То есть на уровне ledger корекция = пара движений в ту же дату (или дату проведения корекции) с противоположным `from/to` и тем же `qty`, плюс ссылка на исходный документ — это совпадает с предложенным дизайном.
- **Печатные формы корекции** содержат табличку «было / стало» (как `FVK` для фактур). Это значит, что коректирующий документ должен помнить **исходное** значение (snapshot) и **новое** значение строки.

---

## 3. Костинг / FIFO — что реверсируется и какой ценой

### 3.1. Что нам уже даёт схема
- `cost_layers.source_move_id` — на `INSERT` слой указывает на свой PZ/PW `stock_move` (для MM target — на `inMove`). Через unique-индексы (`cost_layers_source_allocation_uniq`, `cost_layers_source_or_opening_chk`) данные нормализованы.
- `stock_move_cost_allocations.stock_move_id` + `.cost_layer_id` + `qty` + `unit_cost` — точный детальный лог: «WZ/RW/MM-out №X потребил `qty` штук из layer L по цене C». Уникальный `(stock_move_id, cost_layer_id)` — нет дублей.
- `cost_layer.qty_remaining` — текущий «свободный» остаток слоя.

Это означает, что для **любого** outgoing-движения можно построить **полностью симметричный реверс**: пройти его allocations, на каждый `(layer, qty)` прибавить qty обратно в `qty_remaining`, удалить (или закрыть «reversed_at`-флагом) allocation-строки, и переписать `stock_moves.unit_cost/total_cost` на сторнирующем движении в зеркале к оригинальному.

### 3.2. Симметрия по типам
| Оригинал | Что произошло на проводке | Что должна сделать корекция/сторно |
|---|---|---|
| **PZ (incoming)** | + `qty_on_hand`, **создан** layer `L` (`qtyIn=Q`, `qtyRemaining=Q`, `unit_cost=C`) | Уменьшить `qty_on_hand` на дельту, в layer `L` уменьшить `qtyIn` и `qtyRemaining`. **Если** `qtyRemaining < δ` (часть уже consumed) — это коллизия с downstream WZ/RW: см. §3.4. |
| **PW (incoming)** | + `qty_on_hand`, создан layer `L` | Аналогично PZ. |
| **WZ (outgoing)** | − `qty_on_hand`, на `move` повешены allocations `A[i] = (layer L_i, qty q_i, cost c_i)` | Прибавить `qty_on_hand` обратно (на ту же локацию), для каждой allocation `q_i` инкрементить `qty_remaining` исходного `L_i`, **удалить** (или пометить reversed) allocation-строки. Reverse-`stock_move` получает зеркало `total_cost`. |
| **RW (outgoing)** | то же, что WZ | то же, что WZ. |
| **MM (transfer)** | две `stock_moves` (out/in), source layers consumed, на target созданы **новые** layers `L'_i` через `transferFifoLayers` (один target layer на каждую consumed allocation, по `unitCost` источника) | Полное сторно: на target — **уничтожить** layers `L'_i` (или уменьшить их `qtyIn`/`qtyRemaining` до 0); на source — восстановить `qty_remaining` исходных layers через allocation reverse. **Коллизия**: если на target какой-то `L'_i` уже частично consumed downstream WZ/RW, сторно невозможно без рекурсивного отката (см. §3.4). |

### 3.3. Минимальное API costing-сервиса, которое нужно достроить
- `reverseConsumption(stockMoveId, tx)` — для WZ/RW: загрузить allocations этого move, на каждую — `layer.qty_remaining += qty`, удалить (или пометить) allocation. Идемпотентно (повторный вызов = no-op, если allocations отсутствуют).
- `reverseIncomingLayer(stockMoveId, deltaQty, tx)` — для PZ/PW: на layer уменьшить `qtyIn` на дельту и `qtyRemaining` на min(дельта, текущий qtyRemaining). Если **бы** `δ > qtyRemaining` — отказать `LAYER_PARTIALLY_CONSUMED` (см. §3.4).
- `reverseTransfer(inMoveId, tx)` — комбинированно: на target — `reverseIncomingLayer` для каждого target layer (если они не consumed); на source — `reverseConsumption` outMove.
- `applyReverseCostingForMove(reverseMove, originalMove, tx)` — диспетчер, аналог `applyCostingForMove`, но для реверс-направления.

### 3.4. Главная развилка: что делать если layer уже частично consumed
Сценарий: PZ 10@20 → WZ 7 (consumed 7 из layer). Делаем PZK с дельтой −5 (хотим уменьшить PZ до 5).
- Layer.qtyRemaining = 3, но δ = 5. Не можем «вычесть 5 из qtyIn=10», потому что 7 уже ушло — мы бы получили `qtyIn=5 < consumed=7`, что ломает инвариант `qtyIn >= qtyIn - qtyRemaining`.

**Возможные политики MVP**:
- **A. Hard-reject.** Отказать на корекции PZ, если по слою есть downstream consumption (вернуть `LAYER_PARTIALLY_CONSUMED` с деталями: какие WZ/RW/MM зашли в этот слой). Пользователь сначала корректирует downstream WZ/RW, потом возвращается к PZ. Максимально честно и аудиторски корректно.
- **B. Cascade-reverse.** Автоматически реверсировать downstream consumption. Очень рискованно: один PZK может вызвать корекцию сотен WZ, в т.ч. уже отправленных клиенту. **НЕ рекомендую для MVP**.
- **C. Allowed-with-negative-leftover (compensating layer).** Создать «negative layer» (qtyIn<0, qtyRemaining<0) при PZK, так что суммарный остаток уменьшается, но downstream allocations остаются нетронутыми. Это путь некоторых ERP, но он ломает инвариант «layer >= 0» и усложняет stock-value отчёты. **НЕ для MVP**.

**Рекомендация**: MVP = **A (hard-reject)**. Сервис должен возвращать список «блокирующих» downstream-движений, чтобы пользователь мог их сторнировать первыми. На UI — модалка «эту PZ нельзя откорректировать на −5: на 7 единиц уже выписан WZ #...».

### 3.5. WZ/RW: гораздо проще
Outgoing-корекции не имеют каскада: реверс allocations возвращает `qty_remaining` в исходный layer, и всё. Никаких downstream-конфликтов нет (allocations — лист дерева). MVP: реверс работает всегда.

### 3.6. MM: средняя сложность
Сторно MM ломает target layers. Если target layer уже частично consumed downstream — та же политика A: hard-reject с указанием downstream-зависимостей на target-warehouse.

---

## 4. Корекции по типам — рецепты

### 4.1. PZ correction (`PZ_KOREKTA`, шаблон `PZK/{YYYY}/{MM}/{SEQ:4}`)
**Когда нужно:**
- Поставщик прислал меньше / больше, чем оформлено в PZ.
- Найдена ошибка в `unitCost` после проводки.
- Возврат поставщику (часть товара возвращается).

**Что делает проводка PZK:**
1. Валидация: загрузить оригинал, status должен быть `received` или `putaway`. Проверить, что на каждый затронутый layer есть достаточно `qty_remaining` для отрицательной дельты (политика A).
2. На каждую строку корекции с `qtyDelta` (может быть и + и −):
   - Создать **reverse `stock_move`** с `type='receipt'`, `qty = |qtyDelta|`, **swap'нутые** `fromLocationId/toLocationId` (если δ<0 → списание с локации, куда был приход; если δ>0 — приход в неё же), `refType='PZ_KOREKTA'`, `refId=correctionId`, `refItemId=correctionItemId`.
   - Обновить layer: `qtyIn += qtyDelta`, `qtyRemaining += qtyDelta`. При δ<0 проверить `qtyRemaining >= 0` (политика A).
3. Если изменился `unitCost` (а не qty): пересчитать `totalCost` на исходном `stock_move` нельзя (immutable). Решение — выпустить **компенсирующий layer**: новый «нулевой qty / cost δ» layer, который суммирует value. **Альтернатива (рекомендую для MVP)**: запретить корекцию `unitCost` отдельно от qty; для смены цены делать `qtyDelta = 0`, новый PZ с правильной ценой (это эквивалент сторно-PZ + новый PZ). Иначе слишком много геморроя с FIFO.
4. Оригинал → status `corrected`, проставить `correctedBy = correctionId`.

**Сколько `stock_moves` создаёт PZK на одну строку:** **одна** запись (компенсация). Сам корекция-документ хранится в `receipts` (новая запись) с `documentType='PZ_KOREKTA'` или в отдельной таблице — см. §7.

### 4.2. WZ correction (`WZ_KOREKTA`, `WZK/{YYYY}/{MM}/{SEQ:4}`)
**Когда нужно:**
- Возврат от клиента.
- Ошибочно отгружено больше/меньше.
- Возврат на склад из пути доставки.

**Что делает проводка WZK:**
1. Валидация: status оригинала `shipped`.
2. На каждую строку с `qtyDelta` (− = меньше выдано, тогда возврат на склад):
   - Если δ<0 (возврат на склад): создать reverse `stock_move` `type='ship'`, `qty=|δ|`, `toLocationId = (исходный fromLocationId)`, `refType='WZ_KOREKTA'`. Реверсировать allocations оригинала: для каждой `(layer, qty)` из исходных allocations этого move-line — увеличить `qty_remaining` пропорционально (если |δ| < сумма allocations, реверсировать пропорционально или строго FIFO-обратно — рекомендую **строго в обратном порядке**: последний consumed allocation реверсируется первым).
   - Если δ>0 (доотгрузка): просто как обычная WZ — новая FIFO-consumption. Это уже **штатный WZ**, не корекция; в UI стоит так и сказать «увеличение отгрузки = новый WZ, не корекция».
3. Оригинал → `corrected`, `correctedBy = correctionId`.

**Связь с Order returned**: order.status='returned' должен автоматически порождать WZK с δ=−full_qty по всем линиям. Это и есть тот недостающий кусок, который выявлен в §1.3.

### 4.3. MM correction (`MM_KOREKTA`, `MMK/{YYYY}/{MM}/{SEQ:4}`)
**Когда нужно:**
- Ошибка адресации (не туда переместили).
- Корекция qty (часть товара вернулась/потерялась в пути).

**Что делает проводка MMK:**
1. Валидация: оригинал `received` (или `in_transit` — для in-transit можно отменить без полной MMK; это «отзыв в пути»).
2. На каждую строку:
   - Создать **пару reverse stock_moves**: «выход с target-локации» (`type='transfer'`, `fromLocationId=исходный toLocationId`) + «вход на source-локацию» (`type='transfer'`, `toLocationId=исходный fromLocationId`). Тот же `qty`, `refType='MM_KOREKTA'`.
   - На target-warehouse: `reverseIncomingLayer` для каждого target layer (рекомендуется удаление layer, если не consumed; hard-reject если consumed — §3.4).
   - На source-warehouse: `reverseConsumption` outMove оригинала.
3. Оригинал → `corrected`.

### 4.4. RW correction (`RW_KOREKTA`, `RWK/{YYYY}/{MM}/{SEQ:4}`)
**Когда нужно:**
- Возврат «из производства» обратно на склад.
- Ошибочно списано (не на ту локацию или не та qty).

**Что делает:** идентично WZK по механике (RW = outgoing). Возврат на ту же локацию, allocations реверсируются.

### 4.5. PW correction (`PW_KOREKTA`, `PWK/{YYYY}/{MM}/{SEQ:4}`)
**Когда нужно:**
- Изначальный «излишек» оказался меньше/больше.
- Ошибка в `unitCost` PW.

**Что делает:** идентично PZK (PW = incoming). С теми же правилами reaktуальной коллизии qty/cost.

### 4.6. Корекция инвентаризационных RW/PW
**Особенность:** обычная RW/PW, авто-созданная `inventoryCountService.reconcileCycleCount` — никак не отличается от ручной RW/PW по схеме. Значит, её корекция — это **обычный RWK/PWK**. Если нужно «откорректировать инвентаризацию целиком» (после reconcile найдена ошибка в подсчёте) — это серия RWK/PWK по всем авто-созданным линиям, и в идеале — групповая операция «storno inwentaryzacji» на уровне cycle count (создать массив корекций одним батчем).

**Что добавить (но не обязательно для MVP)**: на `adjustment.cycle_count_id` или `adjustment.source_cycle_count_id` — FK на cycle count, чтобы из инвентаризации можно было одной кнопкой увидеть все авто-RW/PW и предложить их сторнировать.

### 4.7. Сводная матрица
| Тип оригинала | Тип корекции | Stock_moves на 1 строку | Сложность costing |
|---|---|---|---|
| PZ | PZK | 1 reverse-receipt | средняя (потенциальный block на consumed layer) |
| WZ | WZK | 1 reverse-ship | низкая (реверс allocations) |
| MM | MMK | 2 reverse-transfer | высокая (consumed target layers могут блокировать) |
| RW | RWK | 1 reverse-adjustment | низкая |
| PW | PWK | 1 reverse-adjustment | средняя (как PZ) |
| Inventory RW/PW | RWK/PWK | 1 reverse-adjustment | низкая/средняя |

---

## 5. Нумерация корекций

### 5.1. Принципы
- Каждый тип корекции — **отдельная серия** в `documentNumberingConfig.js`, не пересекающаяся с оригиналами.
- Шаблон по умолчанию по образцу `INVOICE_CORRECTION` (`FVK/{YYYY}/{MM}/{SEQ:4}`) → `PZK/{YYYY}/{MM}/{SEQ:4}` и т.д. Польская практика.
- Reset-policy = `monthly` (как у большинства), может настраиваться компанией.
- Видимость в `companyWarehouseDocumentSettings.warehouseDocumentTypes` — отдельные toggles per type (включить/выключить PZK, WZK, …).

### 5.2. Новые типы для добавления (миграция — позже, не в этом аудите)
```
PZ_KOREKTA   default PZK/{YYYY}/{MM}/{SEQ:4}
WZ_KOREKTA   default WZK/{YYYY}/{MM}/{SEQ:4}
MM_KOREKTA   default MMK/{YYYY}/{MM}/{SEQ:4}
RW_KOREKTA   default RWK/{YYYY}/{MM}/{SEQ:4}
PW_KOREKTA   default PWK/{YYYY}/{MM}/{SEQ:4}
```
Аббревиатуры `PZK/WZK/MMK/RWK/PWK` — польская норма (буква `K` = «korekta»). Также встречается `KOR-PZ-...` — оставить настраиваемым через `numberPattern`.

### 5.3. Идемпотентность и заморозка номера
- Номер выдаётся на проводке (`assertDocumentTypeEnabled` + `generateNextDocumentNumber` в той же транзакции, что и reverse stock_moves) — повторение → unique-constraint на `(company, type, number)` ловит дубликат.
- Сейчас в коде черновики корекций не нумеруются (так же, как и обычные документы — номер ставится при `received`/`shipped`/`posted`). Сохранить эту инвариант для корекций.

---

## 6. UI / UX

### 6.1. Status badges
Добавить в i18n (`statuses.*`) во все 4 локали:
- `corrected` — PL: `Skorygowany`, EN: `Corrected`, RU: `Скорректирован`, UA: `Скоригований`.
- `correction` — PL: `Korekta`, EN: `Correction`, RU: `Корректировка`, UA: `Корекція`.
- (опционально) `stornowany` — PL: `Stornowany`, EN: `Reversed`.

В `WarehouseDocumentDetailPage` (рендеринг badge — `statusLabel(base.status, t)`) нужно поддержать новые значения.

### 6.2. Action buttons на детали документа
| Контекст | Кнопка | Условие отображения |
|---|---|---|
| `received` PZ / `shipped` WZ / `received` MM / `posted` RW or PW | **«Wystaw korektę»** (PL) / **«Issue correction»** (EN) | оригинал ещё не имеет `correctedBy` |
| `corrected` любой | вместо кнопки — **ссылка** «Skorygowany dokumentem [PZK/...]» на дочернюю корекцию | всегда |
| корекция (PZK/WZK/...) | **ссылка** на оригинал «Korekta dokumentu [PZ/...]» | всегда |
| черновик корекции `draft` | стандартные «Edit / Post / Delete», как у обычных документов | в draft |

### 6.3. Source ↔ correction связи в DTO
- В детали-DTO оригинала добавить `correctedBy: { id, number, type, postedAt }` (или `null`).
- В детали-DTO корекции добавить `parentDocument: { id, number, type, status }`.
- В list-DTO документов — флаг `hasCorrection: boolean` (для значка в списке).

### 6.4. Mixed UI на странице корекции
- Шапка: ссылка на оригинал + тип корекции (`PZ_KOREKTA`) + статус.
- Таблица строк: дельты («было / стало / Δ») — для PZK/WZK/MMK/RWK/PWK.
- Для PZK/PWK с изменением `unitCost`: отдельный блок «cost change», но MVP может его не показывать (см. §4.1 — рекомендую запретить изменение unitCost через корекцию).

### 6.5. Print views
- Печать корекции PZK/WZK/MMK/RWK/PWK по аналогии с invoice-correction: «Korekta dokumentu [PZ-номер]», таблица «было/стало/Δ». В `documents/templateRegistry/docTypes/` уже есть `wz.json` — добавить `wzk.json`, `pzk.json`, и т.д. (отложить на implementation-фазу).

---

## 7. Что потребует миграций (НЕ создаём сейчас — только эскиз)

### 7.1. Расширения ENUM статусов
Новый финальный статус `corrected` (immutable, "был исправлен корекцией") для каждого документа, где он осмыслен:
- `receipts.status` ENUM(`draft`, `received`, `putaway`, **`corrected`**).
- `shipments.status` ENUM(`packing`, `shipped`, `cancelled`, **`corrected`**).
- `transfer_orders.status` ENUM(`draft`, `in_transit`, `received`, **`corrected`**).
- `adjustments.status` ENUM(`draft`, `posted`, **`corrected`**).
- `cycle_counts.status` — не трогаем (инвентаризация корректируется через RWK/PWK дочерним документам, см. §4.6).

### 7.2. Линковочные поля (`parent_document_id` + `corrected_by_id`)
На каждом из `receipts`, `shipments`, `transfer_orders`, `adjustments`:
- `parent_document_id UUID NULL` — FK на ту же таблицу, on delete RESTRICT (нельзя удалить оригинал, на который ссылается корекция).
- `corrected_by_id UUID NULL` — FK на ту же таблицу, on delete SET NULL (если корекцию удалили — оригинал снова «активен»; но при `corrected` status это технически невозможно — RESTRICT тоже допустимо).

Альтернативный вариант: одна общая таблица `wms_document_corrections (parent_id, parent_type, child_id, child_type, ...)`. Менее удобно, но даёт полиморфизм. **MVP — рекомендую прямые FK** в каждой таблице (проще запросы, проще FK constraints).

### 7.3. Признак «корекция оригинала» на `stock_moves`
- `stock_moves.refType` уже хранит источник. Для корекций — будут значения `PZ_KOREKTA / WZ_KOREKTA / ...` (новые типы).
- **Не обязательно** добавлять отдельную колонку `reverses_move_id`, но иногда полезно для аудита: «эта строка ledger реверсирует строку X». Это уменьшает джойн через документ. Опционально.

### 7.4. `stock_move_cost_allocations` — режим «reversed»
Два пути:
- **A. Полное удаление** allocations при реверсе. Простой, но теряет аудит (после удаления нельзя сказать «когда-то allocation существовал»).
- **B. Soft-mark** через `reversed_at TIMESTAMP NULL` + `reversed_by_stock_move_id UUID NULL`. Сохраняет историю.
**Рекомендация**: **B**. Маленькая миграция, но честный аудит-журнал. (Альтернатива — отдельная таблица `stock_move_cost_allocation_reversals`, но это over-engineering для MVP.)

### 7.5. Поля для печати «было/стало»
- На items корекции (например `receipt_items` для PZK): нужно знать **исходное** значение строки оригинала. Можно либо денормализовать (`original_qty`, `original_unit_cost`), либо считать на лету через join (требует FK `correction_of_item_id`). **Минимум для MVP — денормализация** (`original_qty`, `original_qty_expected`).

### 7.6. Сводка миграций (будущее)
1. ENUM-extension `corrected` на 4 таблицах.
2. `parent_document_id` + `corrected_by_id` FK на тех же 4.
3. `stock_move_cost_allocations.reversed_at` + `reversed_by_stock_move_id` (опция B).
4. (Опционально) `stock_moves.reverses_move_id` для прямого аудита.
5. Денормализованные `original_*` на items корекций.
6. Добавление 5 типов в `document_numbering_settings` (создаются лениво через `getOrCreateSettingRow` при первой проводке — миграция не нужна, только seed/config).

---

## 8. Риски / edge-кейсы

1. **Каскад reverse PZ → consumed downstream WZ.** Решено политикой A (hard-reject) — но это переносит UX-боль на пользователя. Альтернативы (B/C) тяжёлые.
2. **Корекция корекции (PZK на PZK)?** Польская практика **допускает**, и FVK тоже может корректироваться. Чтобы не плодить рекурсию, для MVP: **разрешить только PZK для оригинального PZ**. Корекция корекции — будущая работа.
3. **Изменение `unitCost` без изменения qty.** Опасно: ломает уже выписанные WZ (их COGS уже посчитан по старой цене). MVP: не разрешать через корекцию (см. §4.1). Если очень нужно — техника «full storno PZ + новый PZ».
4. **MM correction когда target consumed.** Hard-reject (политика A на обе стороны).
5. **Order returned без корекции WZ.** Сейчас (1.3) order.returned не реверсирует WZ. После K1 — должен авто-порождать WZK на полные qty всех линий заказа. Это критический пробел.
6. **Идемпотентность повторной проводки корекции.** Уже есть guard по `refItemId` в `adjustment.post` — придётся аналогично оформить в корекционных сервисах (по `correctionId + correctionItemId`).
7. **Удаление корекции до проводки.** `draft` корекция — обычное удаление (как любой draft). После проводки — `RESTRICT` на FK от оригинала.
8. **`shipment.status = 'cancelled'` legacy.** Нужно либо явно использовать (для документов, отменённых до `shipped`), либо удалить из ENUM в миграции (но это break). Рекомендую оставить и зарезервировать под «`packing → cancelled` (до проводки)», а сторно после `shipped` — это `WZK` с δ=−qty.
9. **Inventory cycle count «storno».** Если бухгалтер хочет полностью отменить инвентаризацию — нужно сторнировать все авто-RW/PW. Это можно вынести в `inventoryCountService.reverseReconcile(cycleCountId)` (вспомогательная пакетная команда), создающая корекционные RWK/PWK по всем линиям.
10. **JPK_MAG порядок строк.** Корекционные `stock_moves` должны попасть в JPK той даты, когда они проведены (это уже даёт `createdAt`), но в файле должны ссылаться на оригинал — отдельное поле `refType/refId` уже это делает. Проверить в JPK-экспорте (когда он будет реализован).
11. **i18n.** На каждый новый статус и тип корекции — ключи в `statuses.*` и `documentTypes.*` в 4 локалях (см. §6.1).

---

## 9. Рекомендуемая MVP-архитектура

**Цель MVP**: дать бухгалтеру возможность выписать WZK (возврат от клиента / ошибочная отгрузка) и PZK (возврат поставщику / пересорт по qty). MM/RW/PW корекции — следующая итерация (схема и инфраструктура одинаковая, добавляются по очереди).

> **Решения раздела 10 зафиксированы (2026-06-03):** hard-reject `LAYER_PARTIALLY_CONSUMED` (#1); только qty, без `unitCost` (#2); `shipment.cancelled` только для `packing` (#3); `order.returned → auto-WZK` обязательно (#4); allocations реверсируются **soft-mark** (#5); корекция корекции запрещена (#6); печатные шаблоны откладываем (#7); UI — `WmsDocumentCreatePage` с `mode='correction'` (#8).

### 9.1. Минимальный объём (Phase K1-MVP)
1. **Миграции**:
   - ENUM `corrected` на `receipts` и `shipments`.
   - `parent_document_id` + `corrected_by_id` FK на `receipts` и `shipments`.
   - `original_qty` денормализация на `receipt_items` и `shipment_items` (когда они часть корекции).
   - `stock_move_cost_allocations.reversed_at` + `reversed_by_stock_move_id`.
   - Новые типы `PZ_KOREKTA`, `WZ_KOREKTA` в `documentNumberingConfig.js` (config-only, без миграции).
2. **Backend**:
   - `costingService.reverseConsumption(stockMoveId, tx)` и `costingService.reverseIncomingLayer(stockMoveId, deltaQty, tx)`.
   - `receiptService.createCorrection(parentId, payload, tx)` + `receiptService.postCorrection(id, tx)`.
   - `shipmentService.createCorrection(parentId, payload, tx)` + `shipmentService.postCorrection(id, tx)`.
   - При `order.status → 'returned'` → авто-генерация `shipmentService.createCorrection` на full δ.
3. **Frontend**:
   - На WMS detail (PZ/WZ): кнопка «Wystaw korektę» при `received`/`shipped`.
   - В детали — секция «Korekty» со списком корекций и ссылками.
   - Page для draft-корекции (могут переиспользовать существующий `WmsDocumentCreatePage` с новым `mode='correction'`).
   - i18n keys в 4 локалях.
4. **Smoke**:
   - `smokeCorrectionsPzWz.js`: создать PZ 10@20, выписать WZ 3, выписать WZK −3 (возврат), проверить: layer.qtyRemaining вернулся в 10, allocations отмечены `reversed_at`, reverse `stock_move` имеет нужный `total_cost=60`. Затем PZK −2 (поставщик прислал меньше): layer.qtyIn=8, qtyRemaining=8.
   - `smokeCorrectionsBlocking.js`: PZ 10, WZ 7, попытка PZK −5 → 409 `LAYER_PARTIALLY_CONSUMED`.

### 9.2. v2 (Phase K2)
- MM/RW/PW корекции (механика одинаковая, добавить типы и сервисы).
- Inventory cycle count `reverseReconcile`.
- Корекция корекции (PZK от PZK).
- Изменение `unitCost` через корекцию (с обязательным каскадным пересчётом COGS, если разрешать).

### 9.3. Phase 6 (JPK)
- Экспорт корекций в JPK_MAG: убедиться, что reverse `stock_moves` в файле имеют ссылку на оригинал и противоположный знак qty.

---

## 10. Зафиксированные решения MVP (2026-06-03)

| # | Вопрос | Решение | Уточнение |
|---|---|---|---|
| 1 | Политика consumed-layer (§3.4) | **Hard-reject `LAYER_PARTIALLY_CONSUMED`** | Сервис PZK/PWK на проводке загружает downstream-зависимости (WZ/RW/MM, потребившие этот layer); если они есть и δ<0 покрывает уже потреблённую часть — отказать 409, в `details` вернуть список блокирующих движений. Пользователь сначала корректирует downstream. |
| 2 | Корекция `unitCost` | **Запрещено в MVP.** Через PZK/PWK меняется только **qty** | Если в payload корекции `unitCost ≠ unitCost оригинала` (или указано отдельно от qty-delta) — 400 `COST_CORRECTION_NOT_SUPPORTED`. Корекция себестоимости — отдельный механизм в v2 (storno-PZ + новый PZ или специализированная фича пересчёта COGS). |
| 3 | `shipment.cancelled` legacy | **Оставляем** под `packing → cancelled` (до проводки). Сторно `shipped` — **только** через WZK | В ENUM не трогаем. На уровне сервиса добавить: при `status='shipped'` запрет перехода в `cancelled` (только в `corrected`); из `packing` разрешён `cancelled` без stock-движений. |
| 4 | `order.returned → WZK` | **Обязательно в MVP** | Переход в `returned` авто-генерирует WZK с δ = −full_qty по всем линиям заказа (через `shipmentService.createCorrection` + автопроводка). Идемпотентность: повторный переход не плодит новые WZK (guard по `parent_shipment_id`). |
| 5 | Реверс allocations | **Soft-mark**: `reversed_at TIMESTAMP NULL` + `reversed_by_stock_move_id UUID NULL` на `stock_move_cost_allocations`. Удаление **не делаем** | Полный аудит остаётся. `getConsumedLayers` etc. фильтруют по `reversed_at IS NULL` для активных allocations. Партиальный unique-index на `(stock_move_id, cost_layer_id) WHERE reversed_at IS NULL` (вместо текущего безусловного), чтобы можно было создать новую активную allocation на тот же `(move, layer)` если сторно-цикл повторился (опционально, обсуждаемо). |
| 6 | Корекция корекции | **Запрещено в MVP** | Тип корекции (`PZ_KOREKTA/WZ_KOREKTA/...`) не может быть родителем для новой корекции. Проверка на уровне сервиса: при `createCorrection(parentId, ...)` отказать 409 `PARENT_IS_CORRECTION`, если `parent.documentType ∈ {PZ_KOREKTA, WZ_KOREKTA, ...}`. v2: разрешить с рекурсивной симметрией. |
| 7 | Печатные шаблоны | **Откладываем**: сначала backend + UI без печати | В Phase K1-MVP не делаем `pzk.json`/`wzk.json`. Сервис печатной формы пусть возвращает заглушку или 501 для корекций. Шаблоны добавим вместе с JPK_MAG (Phase 6). |
| 8 | UI корекций | **Переиспользуем `WmsDocumentCreatePage`** с режимом `mode='correction'` | Один и тот же page-компонент рендерит draft-корекцию, читает `parentDocumentId` из query/route, грузит оригинал для отображения «было/стало», и при submit вызывает `createCorrection`. Отдельные `PzCorrectionCreatePage`/`WzCorrectionCreatePage` **не делаем**. |

### 10.1. Зачем эти решения сходятся в одну MVP-форму
- **#1 + #2** делают корекцию однородной операцией «только qty, никаких каскадов» — простая для accountant'а, безопасная для FIFO.
- **#3 + #4** закрывают единственный реально критичный gap текущего кода: order.returned был «обещанием без следствия», теперь это автоматический WZK, а штатный `shipment.cancelled` чётко зарезервирован за «до-проводочной отменой».
- **#5** даёт честный аудит (`stock_move_cost_allocations` никогда не теряются), необходимый для JPK_MAG в Phase 6.
- **#6 + #7 + #8** минимизируют объём Phase K1-MVP — никакой рекурсии корекций, никаких новых пейджей и templates.

### 10.2. Дополнительные guard'ы, вытекающие из решений
- **Валидация PZK/PWK payload (по #2)**: `unitCost` в строках корекции либо отсутствует, либо строго равен `originalLineSnapshot.unitCost`. Иначе 400.
- **Валидация перехода `shipment` (по #3)**: API/сервис `shipmentService.cancel(id)` доступен только при `status='packing'`. После `shipped` — только `shipmentService.createCorrection(...)`.
- **Идемпотентность order→WZK (по #4)**: order.changeStatus при `returned` ищет существующий `Shipment` с `parent_shipment_id = order.shipmentId AND documentType='WZ_KOREKTA'`; если есть — no-op, иначе создаёт.
- **Тип-валидация (по #6)**: `createCorrection` отказывает на родителе типа `*_KOREKTA`.

---

> Этот документ — только аудит и зафиксированный план. Никаких изменений в коде или схеме на текущем шаге не сделано. Решения раздела 10 закрыты. Следующий шаг — стартовать **Phase K1-MVP** по §9.1 (миграции → costing reverse-API → receipt/shipment correction services → order.returned hook → UI режим `correction` на `WmsDocumentCreatePage` → smoke `smokeCorrectionsPzWz.js` + `smokeCorrectionsBlocking.js`).

---

## 11. K1.7 Final verification (2026-06-05)

### 11.1. Backend correction flow

| Проверка | Статус | Evidence |
|---|---:|---|
| PZ → PZK | ✅ passed | `smokeWmsCorrectionsPzkWzk.js`: part of `27/27 checks passed` |
| WZ → WZK | ✅ passed | `smokeWmsCorrectionsPzkWzk.js`: part of `27/27 checks passed` |
| Order returned → auto WZK | ✅ passed | `smokeOrderReturnedAutoWzk.js`: `18/18 checks passed` |
| `LAYER_PARTIALLY_CONSUMED` guard | ✅ passed | Covered by `smokeWmsCorrectionsPzkWzk.js` |
| `DOCUMENT_ALREADY_CORRECTED` guard | ✅ passed | Covered by `smokeWmsCorrectionsPzkWzk.js` |
| `CORRECTION_OF_CORRECTION_NOT_ALLOWED` guard | ✅ passed | Covered by `smokeWmsCorrectionsPzkWzk.js` |

### 11.2. Frontend correction flow

| Проверка | Статус | Evidence |
|---|---:|---|
| PZ detail shows `Create correction` | ✅ static/build verified | `WarehouseDocumentDetailPage` condition: receipt, non-correction, no `correctedById`, status not `corrected` |
| WZ detail shows `Create correction` | ✅ static/build verified | `WarehouseDocumentDetailPage` condition: shipment, non-correction, no `correctedById`, status `shipped` |
| Corrected original shows correction link | ✅ static/build verified | Detail relation block reads `correctedById`/`correctedBy` |
| Correction shows original link | ✅ static/build verified | Detail relation block reads `parentDocumentId`/`parentDocument` |
| `/main/wms/documents?view=pzk` | ✅ passed | `smokeWarehouseDocumentsList.js`: system view/filter covered |
| `/main/wms/documents?view=wzk` | ✅ passed | `smokeWarehouseDocumentsList.js`: system view/filter covered |

Runtime note: browser-level click/type verification was limited by the in-app browser input sandbox during K1.6. The same flow was verified through real HTTP API calls and frontend build/static route checks.

### 11.3. Reports after PZK/WZK

Existing requested smoke results:

| Smoke | Result |
|---|---:|
| `smokeInventoryLedgerReport.js` | ✅ `20/20 checks passed` |
| `smokeStockValuationReport.js` | ✅ `12/12 checks passed` |
| `smokeStockTurnoverReport.js` | ✅ `15/15 checks passed` |
| `smokeStockAsOfReport.js` | ✅ `15/15 checks passed` |

Important gap: the existing report smokes above validate base PZ/WZ/PW/RW/MM scenarios, but they do not fully validate PZK/WZK correction moves. A correction-specific rollback check found:

| Проверка | Статус | Finding |
|---|---:|---|
| Inventory ledger includes WZK/PZK movements | ❌ gap | Ledger returned `PZ,WZ,PZ`; correction rows were missing |
| Stock valuation correct after WZK/PZK | ✅ passed | Valuation from `cost_layers.qty_remaining × unit_cost` returned expected remaining qty/value |
| Stock turnover includes correction moves | ❌ gap | Turnover returned base `PZ,WZ`; correction document types/moves were missing |
| Stock as-of correct after correction date | ❌ gap | As-of result did not reflect correction moves after their posting date |

### 11.4. Workspace Views

| Проверка | Статус | Evidence |
|---|---:|---|
| PZK/WZK system views exist | ✅ passed | `smokeWorkspaceViewsApi.js`: all system views loaded without duplicates |
| Personal views still work | ✅ passed | `smokeWorkspaceViewsApi.js`: personal view create/pin/hide flow passed |

### 11.5. Recommendation

**Transactional WMS corrections MVP is complete**: backend services, idempotency guards, FIFO reverse behavior, order-return auto WZK, UI actions, document links, and workspace views are operational.

**WMS Corrections v1 is not complete yet** under the full K1.7 acceptance criteria, because reports are not fully correction-aware. The next step should be:

**K1.8 — correction-aware WMS reports**
- Include `PZ_KOREKTA` and `WZ_KOREKTA` in inventory ledger with correct running qty/value balance.
- Include correction moves in stock turnover and documentType grouping.
- Include correction moves in stock as-of reconstruction by posting date.
- Extend report smokes with PZK/WZK scenarios so this gap cannot regress.
