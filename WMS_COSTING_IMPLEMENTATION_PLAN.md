# WMS Costing Implementation Plan — FIFO first, AVCO-ready

> Scope: implementation plan only.
> Do not change business logic in this step.
> Do not create migrations in this step.
> Source: `WMS_COSTING_AUDIT.md`.

---

## 1. Objective

Implement WMS inventory costing with FIFO as the first supported method, while keeping schema and service contracts ready for AVCO later.

Target outcomes:
- Incoming PZ/PW creates cost layers.
- Outgoing WZ/RW consumes FIFO layers.
- MM transfers layer value between warehouses/locations without changing company total stock value.
- `stock_moves` contains immutable cost snapshot.
- `stock_move_cost_allocations` preserves exact FIFO allocation details when one outgoing move consumes multiple layers.

Non-goals for this implementation batch:
- AVCO runtime implementation.
- Korekty/storno.
- Server-side PDF.
- Manual WZ UI changes unless required for testing.

---

## 2. Migration Plan

### 2.1. `receipt_items`

Add fields:

```sql
unit_cost DECIMAL(14,4) NULL
total_cost DECIMAL(14,4) NULL
currency VARCHAR(3) NULL
```

Model mapping:
- `unitCost` -> `unit_cost`
- `totalCost` -> `total_cost`
- `currency` -> `currency`

Rules:
- Keep nullable for existing rows.
- New PZ creation should validate `unitCost >= 0` when costing is enabled.
- `totalCost` should be backend-calculated as `qtyExpected * unitCost` or actual received qty strategy if partial costing is introduced.
- Currency should default to payload currency, product/variant currency, supplier currency, or `PLN`.

Indexes:
- No dedicated index required for these fields.

### 2.2. `adjustment_items`

Add fields:

```sql
unit_cost DECIMAL(14,4) NULL
total_cost DECIMAL(14,4) NULL
currency VARCHAR(3) NULL
```

Model mapping:
- `unitCost` -> `unit_cost`
- `totalCost` -> `total_cost`
- `currency` -> `currency`

Rules:
- Required for PW posting in V1, unless fallback to product/variant cost is explicitly allowed.
- Not user-provided for RW. RW cost is derived from FIFO layers.
- `totalCost` for PW should be backend-calculated as `abs(qtyDelta) * unitCost`.

### 2.3. `stock_moves`

Add fields:

```sql
unit_cost DECIMAL(14,4) NULL
total_cost DECIMAL(14,4) NULL
currency VARCHAR(3) NULL
cost_method VARCHAR(16) NULL
```

Model mapping:
- `unitCost` -> `unit_cost`
- `totalCost` -> `total_cost`
- `currency` -> `currency`
- `costMethod` -> `cost_method`

Rules:
- Incoming PZ/PW: store input cost.
- Outgoing WZ/RW: store actual consumed FIFO weighted cost.
- MM: outgoing and incoming transfer moves should carry the same transferred value snapshot.
- `costMethod` should be `FIFO` for this implementation.

Indexes:
- Existing document/ref indexes remain primary lookup path.
- No dedicated cost index required for V1.

### 2.4. `company_warehouse_document_settings`

Add field:

```sql
inventory_cost_method VARCHAR(16) NOT NULL DEFAULT 'FIFO'
```

Rules:
- Allowed values for V1 schema: `FIFO`, `AVCO`.
- Runtime implementation should only execute FIFO initially.
- If setting is `AVCO` before AVCO is implemented, service should either reject posting with clear error or fall back to FIFO only if product decision explicitly allows it. Recommended: reject with `COST_METHOD_NOT_IMPLEMENTED`.

Model mapping:
- `inventoryCostMethod` -> `inventory_cost_method`

### 2.5. `cost_layers`

Create table:

```sql
id UUID PRIMARY KEY
company_id UUID NOT NULL
warehouse_id UUID NOT NULL
location_id UUID NULL
product_id UUID NOT NULL
variant_id UUID NULL
source_move_id UUID NOT NULL
source_ref_type VARCHAR(32) NOT NULL
source_ref_id UUID NOT NULL
source_ref_item_id UUID NULL
qty_in DECIMAL(14,4) NOT NULL
qty_remaining DECIMAL(14,4) NOT NULL
unit_cost DECIMAL(14,4) NOT NULL
total_cost DECIMAL(14,4) NOT NULL
currency VARCHAR(3) NOT NULL DEFAULT 'PLN'
received_at TIMESTAMP NOT NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Foreign keys:
- `company_id` -> companies.
- `warehouse_id` -> warehouses.
- `location_id` -> locations, nullable.
- `product_id` -> products.
- `variant_id` -> product_variants, nullable.
- `source_move_id` -> stock_moves.

Indexes:

```sql
(company_id, warehouse_id, product_id, variant_id, qty_remaining)
(company_id, warehouse_id, location_id, product_id, variant_id, qty_remaining)
(company_id, product_id, variant_id, received_at)
(source_move_id)
(source_ref_type, source_ref_id, source_ref_item_id)
```

Recommended constraints:
- `qty_in >= 0`
- `qty_remaining >= 0`
- `qty_remaining <= qty_in`
- `unit_cost >= 0`
- `total_cost >= 0`
- unique `source_move_id` for incoming layer moves, if one incoming move creates one layer.

Notes:
- `location_id` was not in the original minimal list, but should be included because current WMS movements are location-based and MM needs location-level value movement.

### 2.6. `stock_move_cost_allocations`

Create table:

```sql
id UUID PRIMARY KEY
company_id UUID NOT NULL
stock_move_id UUID NOT NULL
cost_layer_id UUID NOT NULL
qty DECIMAL(14,4) NOT NULL
unit_cost DECIMAL(14,4) NOT NULL
total_cost DECIMAL(14,4) NOT NULL
currency VARCHAR(3) NOT NULL DEFAULT 'PLN'
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Foreign keys:
- `company_id` -> companies.
- `stock_move_id` -> stock_moves.
- `cost_layer_id` -> cost_layers.

Indexes:

```sql
(stock_move_id)
(cost_layer_id)
(company_id, stock_move_id)
(company_id, cost_layer_id)
```

Recommended constraints:
- `qty > 0`
- `unit_cost >= 0`
- `total_cost >= 0`
- unique `(stock_move_id, cost_layer_id)` if allocation per layer per move is aggregated.

Purpose:
- Preserve exact FIFO breakdown when one WZ/RW/MM outgoing move consumes multiple cost layers.
- Keep `stock_moves.total_cost` as summary while retaining audit detail.

---

## 3. Model Plan

### 3.1. New model: `CostLayer`

File:
- `server/src/models/wms/costlayer.js`

Model name:
- `CostLayer`

Table:
- `cost_layers`

Fields:
- `id`
- `companyId`
- `warehouseId`
- `locationId`
- `productId`
- `variantId`
- `sourceMoveId`
- `sourceRefType`
- `sourceRefId`
- `sourceRefItemId`
- `qtyIn`
- `qtyRemaining`
- `unitCost`
- `totalCost`
- `currency`
- `receivedAt`
- timestamps

Associations:
- belongsTo `Company` as `company`.
- belongsTo `Warehouse` as `warehouse`.
- belongsTo `Location` as `location`.
- belongsTo `Product` as `product`.
- belongsTo `ProductVariant` as `variant`.
- belongsTo `StockMove` as `sourceMove`.
- hasMany `StockMoveCostAllocation` as `allocations`.

### 3.2. New model: `StockMoveCostAllocation`

File:
- `server/src/models/wms/stockmovecostallocation.js`

Model name:
- `StockMoveCostAllocation`

Table:
- `stock_move_cost_allocations`

Fields:
- `id`
- `companyId`
- `stockMoveId`
- `costLayerId`
- `qty`
- `unitCost`
- `totalCost`
- `currency`
- timestamps

Associations:
- belongsTo `Company` as `company`.
- belongsTo `StockMove` as `stockMove`.
- belongsTo `CostLayer` as `costLayer`.

### 3.3. Extend `ReceiptItem`

File:
- `server/src/models/wms/receiptitem.js`

Add fields:
- `unitCost`
- `totalCost`
- `currency`

### 3.4. Extend `AdjustmentItem`

File:
- `server/src/models/wms/adjustmentitem.js`

Add fields:
- `unitCost`
- `totalCost`
- `currency`

### 3.5. Extend `StockMove`

File:
- `server/src/models/wms/stockmove.js`

Add fields:
- `unitCost`
- `totalCost`
- `currency`
- `costMethod`

Associations:
- hasMany `StockMoveCostAllocation` as `costAllocations`.
- hasOne `CostLayer` as `costLayer` for incoming layer source move, optional.

### 3.6. Extend `CompanyWarehouseDocumentSetting`

File:
- `server/src/models/crm/companywarehousedocumentsetting.js`

Add field:
- `inventoryCostMethod`

Service/schema extension:
- `server/src/services/crm/companyWarehouseDocumentSettingsService.js`
- `server/src/schemas/companyWarehouseDocumentSettingsSchema.js`

Expose in DTO:

```js
{
  defaultWarehouseId,
  warehouseDefaultDocumentType,
  warehouseDocumentTypes,
  inventoryCostMethod: 'FIFO'
}
```

---

## 4. `costingService` Contract

File:
- `server/src/services/wms/costingService.js`

### 4.1. Helpers

Required helpers:
- `round4(value)` for quantities.
- `roundMoney(value)` or `round4` for cost fields; choose consistent accounting precision.
- `assertCurrency(value)` returns 3-letter uppercase code, default `PLN`.
- `getInventoryCostMethod(companyId, tx)` returns `FIFO` initially.
- `assertFifo(companyId, tx)` rejects non-FIFO until AVCO is implemented.

### 4.2. `createIncomingLayer(move, costInput, tx)`

Signature:

```js
async function createIncomingLayer(move, costInput = {}, tx)
```

Inputs:
- `move`: persisted `StockMove` instance for incoming PZ/PW.
- `costInput`:
  - `unitCost`
  - `totalCost` optional
  - `currency` optional
  - `receivedAt` optional

Behavior:
1. Validate move belongs to incoming cost-bearing type:
   - `type='receipt'`, `refType='PZ'`
   - `type='adjustment'`, `refType='PW'`
2. Validate `move.qty > 0`.
3. Resolve `unitCost`:
   - explicit `costInput.unitCost`, or
   - fallback provided by caller from `ReceiptItem` / `AdjustmentItem` / Product cost.
4. Compute `totalCost = move.qty * unitCost` if not provided.
5. Update `StockMove`:
   - `unitCost`
   - `totalCost`
   - `currency`
   - `costMethod='FIFO'`
6. Create `CostLayer`:
   - `qtyIn = move.qty`
   - `qtyRemaining = move.qty`
   - move product/warehouse/location/ref metadata.
7. Return `{ move, layer }`.

Idempotency:
- If a layer already exists for `sourceMoveId = move.id`, return existing layer and do not create duplicate.

### 4.3. `consumeFifoLayers(move, tx)`

Signature:

```js
async function consumeFifoLayers(move, tx)
```

Inputs:
- `move`: persisted outgoing `StockMove` instance for WZ/RW or outgoing MM leg.

Eligible moves:
- `type='ship'`, `refType='WZ'`
- `type='adjustment'`, `refType='RW'`
- outgoing `type='transfer'`, `refType='MM'`, with `fromLocationId` present.

Behavior:
1. Validate `move.qty > 0`.
2. Find FIFO layers with:
   - same `companyId`
   - same `warehouseId`
   - same `productId`
   - same `variantId` or null
   - `qtyRemaining > 0`
   - optionally same `locationId = move.fromLocationId` for strict location-level costing.
3. Lock layers `FOR UPDATE`.
4. Sort by `receivedAt ASC`, `createdAt ASC`, `id ASC`.
5. Consume until `move.qty` is covered.
6. For each consumed layer:
   - decrement `qtyRemaining`.
   - create or update `StockMoveCostAllocation` for `(move.id, layer.id)`.
7. Compute:
   - `totalCost = sum(allocation.totalCost)`
   - `unitCost = totalCost / move.qty`
8. Update `StockMove` with `unitCost`, `totalCost`, `currency`, `costMethod='FIFO'`.
9. Return `{ move, allocations, totalCost, unitCost }`.

Failure:
- If available cost layers do not cover quantity, throw `AppError(409, 'INSUFFICIENT_COST_LAYER')`.
- This should happen only if legacy stock exists without layers or data is inconsistent.

Idempotency:
- If allocations already exist for move, return existing allocations and do not consume layers again.

### 4.4. `transferFifoLayers(outMove, inMove, tx)`

Signature:

```js
async function transferFifoLayers(outMove, inMove, tx)
```

Inputs:
- `outMove`: outgoing MM stock move from source warehouse/location.
- `inMove`: incoming MM stock move to target warehouse/location.

Behavior:
1. Call `consumeFifoLayers(outMove, tx)`.
2. For each allocation from source layers, create a new `CostLayer` in target warehouse/location:
   - `companyId = inMove.companyId`
   - `warehouseId = inMove.warehouseId`
   - `locationId = inMove.toLocationId`
   - `productId = inMove.productId`
   - `variantId = inMove.variantId`
   - `sourceMoveId = inMove.id`
   - `sourceRefType = inMove.refType`
   - `sourceRefId = inMove.refId`
   - `sourceRefItemId = inMove.refItemId`
   - `qtyIn = allocation.qty`
   - `qtyRemaining = allocation.qty`
   - `unitCost = allocation.unitCost`
   - `totalCost = allocation.totalCost`
   - `currency = allocation.currency`
   - `receivedAt = inMove.createdAt || now`
3. Update `inMove`:
   - same summary `totalCost` as `outMove`
   - `unitCost = totalCost / inMove.qty`
   - `currency`
   - `costMethod='FIFO'`
4. Return `{ outMove, inMove, sourceAllocations, targetLayers }`.

Idempotency:
- If target layers already exist for `sourceMoveId = inMove.id`, return them and do not create duplicates.

### 4.5. `applyCostingForMove(move, payload, tx)`

Signature:

```js
async function applyCostingForMove(move, payload = {}, tx)
```

Behavior by move:

| Move | Behavior |
|---|---|
| PZ receipt | `createIncomingLayer(move, payload.costInput, tx)` |
| PW adjustment | `createIncomingLayer(move, payload.costInput, tx)` |
| WZ ship | `consumeFifoLayers(move, tx)` |
| RW adjustment | `consumeFifoLayers(move, tx)` |
| MM transfer outgoing | consume only if paired transfer flow can pass both moves; otherwise defer to `transferFifoLayers` in transfer service |
| MM transfer incoming | create target layers through `transferFifoLayers`, not standalone incoming costing |
| Other moves | no-op |

Recommended integration pattern:
- For PZ/PW/WZ/RW, call from `inventoryService.applyMove` immediately after `StockMove.create`.
- For MM, call `transferFifoLayers(outMove, inMove, tx)` from `transferService.executeLine`, because both out/in moves are needed.

Return:

```js
{
  move,
  layer: CostLayer | null,
  allocations: [],
  skipped: boolean,
  reason: string | null
}
```

---

## 5. Integration Points

### 5.1. `inventoryService.applyMove`

File:
- `server/src/services/wms/inventoryService.js`

Current behavior:
- Mutates `inventory_items.qty_on_hand`.
- Creates `StockMove`.
- Recalculates product stock cache.

Planned change:
- After `StockMove.create`, call `costingService.applyCostingForMove(move, payload, t)` for non-MM moves.
- Pass cost data through `payload.costInput`.
- Return the updated move with cost fields, or reload after costing.

Example payload addition:

```js
await Inventory.applyMove({
  companyId,
  type: 'receipt',
  ...,
  costInput: {
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    currency: item.currency || 'PLN',
  },
}, { transaction: t });
```

Important:
- Do not calculate FIFO before quantity mutation succeeds.
- Keep all cost layer changes in the same transaction as stock movement.

### 5.2. `receiptService.receiveLine`

File:
- `server/src/services/wms/receiptService.js`

Planned change:
- Load `ReceiptItem.unitCost`, `totalCost`, `currency`.
- Validate cost before receiving:
  - `unitCost >= 0`.
  - currency exists.
- Pass `costInput` into `Inventory.applyMove` for PZ receipt move.
- For partial receipt:
  - use same `unitCost`.
  - `totalCost` for move should be `receivedQty * unitCost`, not full line total.

Open decision:
- If existing PZ rows have no unit cost, either reject receive or fallback to product/variant cost. Recommended for implementation smoke: require unit cost for new rows, fallback only for legacy with explicit warning/error code.

### 5.3. `adjustmentService.post`

File:
- `server/src/services/wms/adjustmentService.js`

Planned change:
- For PW:
  - load `AdjustmentItem.unitCost`, `totalCost`, `currency`.
  - validate `unitCost >= 0`.
  - pass `costInput` into `Inventory.applyMove`.
  - costing service creates incoming layer.
- For RW:
  - do not accept manual output cost.
  - call `Inventory.applyMove` normally.
  - costing service consumes FIFO layers and updates move cost.

### 5.4. `shipmentService.shipItem`

File:
- `server/src/services/wms/shipmentService.js`

Planned change:
- No user cost input.
- `Inventory.applyMove` creates WZ ship move.
- Costing service consumes FIFO layers for the created move.
- Returned move/history should include `unitCost`, `totalCost`, `currency`, and allocations when requested.

Potential DTO/history enhancement:
- WZ detail history can show total cost later, but UI change is not required for first backend smoke.

### 5.5. `transferService.executeLine`

File:
- `server/src/services/wms/transferService.js`

Current behavior:
- Calls `Inventory.applyMove` twice:
  - outgoing source move,
  - incoming target move.

Planned change:
- Capture both returned `StockMove` instances:
  - `outMove`
  - `inMove`
- Prevent standalone MM costing in `inventoryService.applyMove`, or mark it as deferred for transfer moves.
- After both moves are created, call:

```js
await costingService.transferFifoLayers(outMove, inMove, t);
```

Important:
- If the incoming move fails after outgoing move, transaction rollback must restore quantity and cost layers.
- `transferFifoLayers` must be idempotent by `sourceMoveId = inMove.id` and allocations by `stockMoveId = outMove.id`.

---

## 6. API / Schema Contract Changes

### 6.1. PZ create payload

Add per item:

```js
{
  productId,
  variantId,
  qtyExpected,
  unitCost,
  currency
}
```

Backend computes:

```js
totalCost = qtyExpected * unitCost
```

### 6.2. PW adjustment create payload

Add per item for PW:

```js
{
  productId,
  variantId,
  locationId,
  qtyDelta,
  unitCost,
  currency
}
```

Backend computes:

```js
totalCost = abs(qtyDelta) * unitCost
```

### 6.3. RW adjustment create payload

No cost input required.

Backend ignores or rejects `unitCost` for RW. Recommended: reject to avoid user thinking they can override accounting cost.

### 6.4. Company settings payload

Add:

```js
{
  inventoryCostMethod: 'FIFO'
}
```

Allowed:
- `FIFO`
- `AVCO`

Runtime:
- `FIFO` accepted.
- `AVCO` accepted as setting only if implementation chooses to allow future config; posting under AVCO should fail until AVCO service exists. Safer option: allow only `FIFO` in API until AVCO implementation.

---

## 7. Smoke Plan

Create future script:
- `server/scripts/smokeWmsCostingFifo.js`

All test data should run in rollback transaction or use unique smoke prefix and cleanup.

### 7.1. PZ 10 × 20 PLN

Steps:
1. Create company/warehouse/location/product.
2. Create PZ with one item:
   - qtyExpected `10`
   - unitCost `20`
   - currency `PLN`
3. Receive line qty `10`.

Assert:
- onHand = `10`.
- one PZ stock move exists.
- stock move `unitCost=20`, `totalCost=200`, `costMethod=FIFO`.
- one cost layer exists:
  - `qtyIn=10`
  - `qtyRemaining=10`
  - `unitCost=20`
  - `totalCost=200`
  - `currency=PLN`.

### 7.2. WZ 3 => cost 60

Steps:
1. Create WZ or order-driven WZ for qty `3`.
2. Ship qty `3` from the stocked location.

Assert:
- onHand = `7`.
- WZ ship stock move exists.
- WZ move `totalCost=60`, `unitCost=20`, `costMethod=FIFO`.
- original cost layer `qtyRemaining=7`.
- allocation row exists for WZ move:
  - qty `3`
  - unitCost `20`
  - totalCost `60`.

### 7.3. RW 2 => FIFO cost

Steps:
1. Create RW draft for qty `-2`.
2. Post RW.

Assert:
- onHand decreases by `2`.
- RW adjustment stock move `totalCost=40`, `unitCost=20`.
- original layer `qtyRemaining=5`.
- allocation row exists for RW move.

### 7.4. PW 5 × 15

Steps:
1. Create PW draft with qty `+5`, unitCost `15`, currency `PLN`.
2. Post PW.

Assert:
- onHand increases by `5`.
- PW stock move `unitCost=15`, `totalCost=75`.
- new cost layer exists with `qtyIn=5`, `qtyRemaining=5`, `unitCost=15`.

### 7.5. Allocation rows for multiple layers

Setup:
1. Existing layer A: qty `5`, unitCost `20`.
2. Existing layer B: qty `5`, unitCost `15`.
3. Ship WZ qty `7`.

Assert:
- WZ consumes:
  - 5 from layer A = 100
  - 2 from layer B = 30
- WZ move `totalCost=130`.
- WZ move `unitCost=18.5714` or rounded according to selected precision.
- two `stock_move_cost_allocations` rows exist.
- layer A `qtyRemaining=0`.
- layer B `qtyRemaining=3`.

### 7.6. MM transfer keeps company value

Setup:
- Source warehouse has layer qty `3`, unitCost `15`, total value `45`.

Steps:
1. Create MM from warehouse A/location A to warehouse B/location B for qty `3`.
2. Execute line.

Assert:
- Warehouse A onHand decreases by `3`.
- Warehouse B onHand increases by `3`.
- Source layer qtyRemaining decreases by `3`.
- Target layer created with qtyRemaining `3`, unitCost `15`, totalCost `45`.
- Outgoing transfer move totalCost `45`.
- Incoming transfer move totalCost `45`.
- Company total stock value unchanged.

### 7.7. Idempotency smoke

For each posted/received/executed line:
- Repeat receive/post/ship/execute.
- Assert no duplicate cost layers.
- Assert no duplicate allocation rows.
- Assert layer `qtyRemaining` does not change on repeat.
- Assert stock move cost stays stable.

---

## 8. Implementation Order

Recommended order:

1. Create migrations and models:
   - cost fields on existing tables.
   - `CostLayer`.
   - `StockMoveCostAllocation`.
   - `inventoryCostMethod` setting.
2. Extend model exports/associations.
3. Extend company warehouse settings DTO/schema/service for `inventoryCostMethod`.
4. Implement `costingService` with FIFO only.
5. Extend `inventoryService.applyMove` to apply costing for PZ/PW/WZ/RW.
6. Extend `transferService.executeLine` to call `transferFifoLayers` with out/in moves.
7. Extend PZ/PW create schemas/services to persist cost input.
8. Add smoke script and run regression:
   - `smokeWmsCostingFifo.js`
   - `smokeInventoryService.js`
   - `smokeShipmentWz.js`
   - `smokeOrdersReservationsWzApi.js`
   - `smokeAdjustmentsRwPw.js`
   - `smokeWmsCreateFormsApi.js`

---

## 9. Risks / Open Decisions

### 9.1. Legacy stock without cost layers

Problem:
- Existing inventory may have `onHand > 0` but no cost layers.

Options:
1. Create opening balance layers via migration/script with `Product.cost` fallback.
2. Block WZ/RW until layers exist.
3. Allow zero-cost fallback for legacy only.

Recommendation:
- Add a separate opening-balance script or smoke helper later.
- Do not silently use zero cost for production stock.

### 9.2. Location-level costing

Current stock movements are location-based.

Recommendation:
- Include `location_id` in `cost_layers`.
- FIFO consumption should prefer same `fromLocationId` for strict consistency.
- If product is moved internally, MM should move layer quantity to target location.

### 9.3. Multiple currencies

V1 recommendation:
- Require one currency per incoming line/layer.
- Do not mix currencies in one stock valuation report without conversion.
- Default to `PLN` if missing.

### 9.4. AVCO config before implementation

Recommendation:
- Add schema support for `AVCO`, but keep runtime posting guarded until AVCO service is implemented.
- Alternatively expose only FIFO in UI until AVCO is ready.

---

## 10. Acceptance for G1 Implementation

G1 is complete when:
- PZ 10 × 20 PLN creates one FIFO layer and costed receipt move.
- WZ 3 consumes FIFO and stores cost 60 on stock move.
- RW 2 consumes FIFO and stores derived cost.
- PW 5 × 15 creates a new layer.
- MM transfers layer value without changing company stock value.
- A move consuming multiple layers creates multiple allocation rows.
- Repeated idempotent operations do not duplicate layers/allocations or alter costs.
- Existing quantity-only WMS smoke scripts still pass.
