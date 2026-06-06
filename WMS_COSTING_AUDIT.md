# WMS Costing Audit — FIFO/AVCO cost layers

> Scope: audit only. No code changes, no migrations.
> Date: 2026-06-02.
> Goal: define the minimal data model and algorithms needed for inventory costing in WMS.

---

## 1. Executive Summary

Current WMS tracks quantities correctly through `inventory_items` and `stock_moves`, but it does not track inventory value.

What exists now:
- Product-level commercial pricing exists in PIM: `Product.price`, `Product.cost`, `Product.currency`.
- Variant-level commercial pricing exists: `ProductVariant.price`, `ProductVariant.cost`, `ProductVariant.currency`.
- Supplier purchase price records exist in `ProductSupplier.price` and `ProductSupplier.currency`.
- WMS documents and stock ledger are quantity-only: `ReceiptItem`, `ShipmentItem`, `AdjustmentItem`, `TransferItem`, and `StockMove` have no `unit_cost` / `total_cost`.

Conclusion:
- FIFO/AVCO cannot be implemented safely from current WMS data alone.
- The next implementation should add cost capture at PZ/PW input time and persist costs on `stock_moves`.
- Recommended path: implement FIFO first, keep AVCO-compatible schema, implement AVCO later.

---

## 2. Product / Variant Audit

### Product

File: `server/src/models/pim/product.js`

Relevant fields:
- `currency` — `STRING(3)`, default `PLN`.
- `price` — sale/commercial price, `DECIMAL(14,2)`.
- `oldPrice` — old sale price.
- `cost` — product cost, `DECIMAL(14,2)`.
- `stockQuantity` — cached WMS quantity, `DECIMAL(14,3)`, field `stock_quantity`.
- `reservedQuantity` — cached WMS reservation quantity, `DECIMAL(14,3)`, field `reserved_quantity`.
- `orderedQuantity` — exists, but not WMS costing source.

### ProductVariant

File: `server/src/models/pim/productvariant.js`

Relevant fields:
- `currency` — `STRING(3)`, default `PLN`.
- `price` — variant sale/commercial price.
- `cost` — variant cost.

### ProductSupplier

File: `server/src/models/pim/productsupplier.js`

Relevant fields:
- `supplierId`.
- `currency`, default `PLN`.
- `price`, default `0`.
- `moq`, `leadTimeDays`, `packSize`.

### Current cost storage assessment

`Product.cost` and `ProductVariant.cost` are static catalog costs. They are useful as fallback defaults, but they are not an accounting-grade inventory valuation source because they do not represent received batches/layers.

`ProductSupplier.price` can be used as a suggested purchase price when creating PZ lines, but it should not be used as source of truth after PZ posting. The cost source of truth should become:
- `receipt_items.unit_cost` for PZ acquisition cost.
- `adjustment_items.unit_cost` or payload-derived cost for PW internal receipt.
- `cost_layers` and `stock_moves.unit_cost/total_cost` after posting.

Currency exists at product/variant/supplier level, but WMS documents do not currently persist currency on receipt/adjustment/cost moves.

---

## 3. Receipt / ReceiptItem / PZ Audit

Files:
- `server/src/models/wms/receipt.js`
- `server/src/models/wms/receiptitem.js`
- `server/src/services/wms/receiptService.js`
- `client/src/pages/wms/WmsDocumentCreatePage/index.js`

### Current Receipt fields

`Receipt`:
- `companyId`
- `warehouseId`
- `number`
- `status`: `draft`, `received`, `putaway`
- `inboundLocationId`

No currency, supplier, document date, or total cost fields are currently persisted in the model shown.

### Current ReceiptItem fields

`ReceiptItem`:
- `receiptId`
- `productId`
- `variantId`
- `lotNumber`
- `serialNumber`
- `qtyExpected`
- `qtyReceived`

Missing for costing:
- `unitCost`
- `totalCost`
- `currency`

### Current PZ creation

`receiptService.create(companyId, data)` creates PZ with:
- generated or manual `number` via document numbering (`PZ`),
- `warehouseId` from payload or default warehouse resolver,
- `ReceiptItem.bulkCreate` with only quantity/product fields.

Frontend PZ create form sends product, variant, optional lot, and `qtyExpected`. It does not collect purchase cost.

### Current PZ receive

`receiptService.receiveLine`:
- validates `qty > 0`, `qtyReceived + qty <= qtyExpected`, idempotency by `refItemId`.
- calls `Inventory.applyMove` with `type='receipt'`, `refType='PZ'`, `refId=receiptId`, `refItemId=receiptItemId`.
- increments `qtyReceived`.

No cost data is passed into `Inventory.applyMove`.

### Recommended PZ cost field placement

Best place to add purchase cost:
- `receipt_items.unit_cost` — cost per unit for that received line.
- `receipt_items.total_cost` — `qty_expected * unit_cost` or actual received quantity cost if partials need separate accounting.
- `receipt_items.currency` or `receipts.currency` — at least one currency source is required; simplest is `receipts.currency`, but line-level currency is safer if imports/mixed sources are possible.

Minimal V1 recommendation:
- Add `receipt_items.unit_cost` and `receipt_items.total_cost`.
- Add `receipts.currency` or use `Product/ProductSupplier.currency` only as default, then persist currency into `cost_layers.currency` and `stock_moves.currency` if adding that field.

---

## 4. StockMove Audit

File: `server/src/models/wms/stockmove.js`

Current fields:
- `companyId`
- `type`: `receipt`, `putaway`, `pick`, `pack`, `ship`, `adjustment`, `transfer`
- `warehouseId`
- `fromLocationId`
- `toLocationId`
- `productId`
- `variantId`
- `lotId`
- `serialId`
- `qty`
- `refType`
- `refId`
- `refItemId`

Missing for costing:
- `unitCost`
- `totalCost`
- `currency`
- optional cost method snapshot (`costMethod`) if audit trail needs to preserve method used.

### Which moves should have cost

| Move | Current type/ref | Cost behavior |
|---|---|---|
| PZ | `type='receipt'`, `refType='PZ'` | Incoming value. Must create cost layer and store `unit_cost/total_cost` from PZ line. |
| PW | `type='adjustment'`, `refType='PW'` | Incoming value. Must create cost layer. Unit cost must come from adjustment line/payload, product fallback, or explicit required input. |
| WZ | `type='ship'`, `refType='WZ'` | Outgoing value/COGS. Must consume cost layers and store actual FIFO/AVCO `unit_cost/total_cost`. |
| RW | `type='adjustment'`, `refType='RW'` | Outgoing value/internal consumption. Must consume cost layers and store actual cost. |
| MM | `type='transfer'`, `refType='MM'` | Value-neutral transfer. Must move cost layer quantity between warehouse/location without changing unit cost or total company value. |

### Important StockMove nuance

Current MM execution creates two `stock_moves` for one line:
- one outgoing movement from source location/warehouse,
- one incoming movement to target location/warehouse.

For costing, the implementation must avoid double-counting MM value. Recommended representation:
- outgoing transfer move carries negative/consumed layer allocation internally,
- incoming transfer move carries same `unit_cost/total_cost` as transferred value,
- reports should treat MM as value-neutral within company, but value-moving between warehouses.

---

## 5. Shipment / WZ Audit

Files:
- `server/src/models/wms/shipment.js`
- `server/src/models/wms/shipmentitem.js`
- `server/src/services/wms/shipmentService.js`
- `server/src/services/oms/orderService.js`

### Current Shipment fields

`Shipment`:
- `companyId`
- `warehouseId`
- `orderId`
- `number`
- `status`: `packing`, `shipped`, `cancelled`

`ShipmentItem`:
- `shipmentId`
- `productId`
- `variantId`
- `qty`

No cost fields.

### Current WZ shipping behavior

`shipmentService.shipItem`:
- validates planned quantity vs already shipped quantity via `stock_moves`.
- calls `Inventory.applyMove` with:
  - `type='ship'`
  - `refType='WZ'`
  - `refId=shipmentId`
  - `refItemId=shipmentItemId`
  - source location/lot/serial if provided.
- marks shipment `shipped` when all lines are moved.

`orderService.ensureOrderShipmentPosted`:
- creates WZ from reservable order items if none exists.
- auto-allocates stock from `InventoryItem` rows ordered by `qtyOnHand DESC`, then `createdAt ASC`.
- calls `shipmentService.shipItem` per allocation.

### Where COGS should be calculated

COGS must be calculated at the point where stock leaves inventory:
- inside a new costing layer called from `Inventory.applyMove`, or
- in `shipmentService.shipItem` before/after `Inventory.applyMove` in the same transaction.

Recommended design:
- Keep `Inventory.applyMove` responsible for quantity movement only if possible.
- Add `costingService.applyCostingForMove(move, payload, tx)` immediately after `StockMove.create`, still inside `Inventory.applyMove` transaction.
- For `ship` and RW, `costingService` consumes cost layers and updates the created `stock_move.unit_cost/total_cost`.

Reason: all stock-moving documents already pass through `Inventory.applyMove`; centralizing costing there reduces missed paths.

---

## 6. Adjustment RW/PW Audit

Files:
- `server/src/models/wms/adjustment.js`
- `server/src/models/wms/adjustmentitem.js`
- `server/src/services/wms/adjustmentService.js`

### Current Adjustment fields

`Adjustment`:
- `companyId`
- `warehouseId`
- `number`
- `documentType`: `RW`, `PW`
- `reason`
- `status`: `draft`, `posted`
- `postedAt`

`AdjustmentItem`:
- `adjustmentId`
- `productId`
- `variantId`
- `locationId`
- `lotId`
- `serialId`
- `qtyDelta`

No cost fields.

### Current RW/PW posting behavior

`adjustmentService.post`:
- locks adjustment and items.
- validates qty sign by document type.
- idempotency guard by `refItemId`.
- PW (`qtyDelta > 0`) creates incoming `Inventory.applyMove` to `toLocationId`.
- RW (`qtyDelta < 0`) creates outgoing `Inventory.applyMove` from `fromLocationId`.

### Costing rules for PW

PW creates inventory, so it must create a cost layer.

Possible unit cost source options:
1. Explicit `adjustment_items.unit_cost` — recommended.
2. Fallback to `ProductVariant.cost` then `Product.cost` if UI does not provide cost.
3. Reject posting if unit cost is missing — safest for accounting, but more intrusive for users.

Recommended V1:
- Add `adjustment_items.unit_cost`, `adjustment_items.total_cost`, optional `currency`.
- Require `unit_cost >= 0` for PW in API validation.
- Allow explicit `0` for free stock only if user deliberately enters `0`.

### Costing rules for RW

RW removes inventory, so it should consume cost layers like WZ.

Rules:
- User should not manually provide output cost for RW.
- Cost should be derived from FIFO/AVCO layers at posting time.
- `stock_moves.total_cost` for RW is consumed inventory value.

---

## 7. Transfer / MM Audit

Files:
- `server/src/models/wms/transferorder.js`
- `server/src/models/wms/transferitem.js`
- `server/src/services/wms/transferService.js`

### Current Transfer fields

`TransferOrder`:
- `companyId`
- `number`
- `fromWarehouseId`
- `toWarehouseId`
- `status`: `draft`, `in_transit`, `received`

`TransferItem`:
- `transferId`
- `productId`
- `variantId`
- `lotId`
- `serialId`
- `qty`
- `movedQty`

No cost fields.

### Current MM execution behavior

`transferService.executeLine`:
- validates `qty > 0`, `movedQty + qty <= planned qty`.
- creates two transfer moves:
  - source warehouse/location outgoing move,
  - target warehouse/location incoming move.
- updates `movedQty`.

### Costing rules for MM

MM does not change total company inventory value.

However, warehouse-level valuation must move with the stock:
- If stock is moved from warehouse A to B, the relevant cost layer quantity must move from A to B.
- If location-level valuation is needed, layer location should move as well or a transfer allocation table should record from/to locations.
- Unit cost must not change during MM.

Recommended V1 FIFO behavior:
- Consume FIFO layers from source warehouse/location for transfer quantity.
- Create equivalent layers in target warehouse/location with the same `unit_cost`, `currency`, and original provenance metadata or a link to the source layer.
- The pair of transfer `stock_moves` may both carry cost for traceability, but financial reports must net MM to zero at company level.

---

## 8. Company Settings Audit

Current relevant model:
- `server/src/models/crm/companywarehousedocumentsetting.js`

Current fields:
- `warehouseDefaultDocumentType`
- `defaultWarehouseId`

No inventory cost method exists.

### Recommended location for `inventory_cost_method`

Best place:
- Extend `company_warehouse_document_settings` with `inventory_cost_method`.

Reason:
- It already stores WMS module settings.
- It is company-scoped and used by WMS/default warehouse flows.
- It keeps costing configuration close to warehouse settings, not invoice/order settings.

Recommended values:
- `FIFO`
- `AVCO`

Default:
- `FIFO`

Implementation note:
- Store as uppercase or lowercase consistently. Current warehouse document types use mixed domain values (`RW`, `PW`) and settings use lowercase for `warehouseDefaultDocumentType`; for cost method, uppercase `FIFO`/`AVCO` is clearer in UI/accounting, but lowercase `fifo`/`avco` is easier for code. Pick one and normalize in service.

---

## 9. Minimal Migration Proposal

No migrations are created in this audit. Proposed implementation migrations:

### 9.1. `receipt_items`

Add:
- `unit_cost DECIMAL(14,4) NULL`
- `total_cost DECIMAL(14,4) NULL`
- optional `currency VARCHAR(3) NULL`

Notes:
- `unit_cost` should be nullable during migration for existing data.
- On new PZ lines, backend should require a valid unit cost when costing is enabled.
- `total_cost` can be denormalized for audit/read performance.

### 9.2. `adjustment_items`

Add:
- `unit_cost DECIMAL(14,4) NULL`
- `total_cost DECIMAL(14,4) NULL`
- optional `currency VARCHAR(3) NULL`

Reason:
- PW needs explicit incoming value.
- RW cost should be computed from layers and not user-entered, but fields can stay nullable for RW input and populated after posting if needed.

The user request only listed `receipt_items` for unit cost, but PW acceptance requires a unit cost source. Without `adjustment_items.unit_cost`, PW must use fallback `Product.cost`, which is weaker.

### 9.3. `stock_moves`

Add:
- `unit_cost DECIMAL(14,4) NULL`
- `total_cost DECIMAL(14,4) NULL`
- optional `currency VARCHAR(3) NULL`
- optional `cost_method VARCHAR(16) NULL`

Reason:
- COGS and stock ledger reports need immutable cost snapshot on each movement.
- `total_cost` on outgoing moves is the actual inventory value consumed.

### 9.4. `cost_layers` table

Create new table; see schema below.

### 9.5. company settings

Add to `company_warehouse_document_settings`:
- `inventory_cost_method VARCHAR(16) NOT NULL DEFAULT 'FIFO'`

Optional CHECK/validation:
- allowed values: `FIFO`, `AVCO`.

---

## 10. Proposed `cost_layers` Schema

Recommended table: `cost_layers`

Fields:
- `id UUID PRIMARY KEY`
- `company_id UUID NOT NULL`
- `warehouse_id UUID NOT NULL`
- optional `location_id UUID NULL` — recommended, even though user list did not include it, because current WMS movements are location-based.
- `product_id UUID NOT NULL`
- `variant_id UUID NULL`
- `source_move_id UUID NOT NULL`
- `source_ref_type VARCHAR(32) NOT NULL`
- `source_ref_id UUID NOT NULL`
- `source_ref_item_id UUID NULL`
- `qty_in DECIMAL(14,4) NOT NULL`
- `qty_remaining DECIMAL(14,4) NOT NULL`
- `unit_cost DECIMAL(14,4) NOT NULL`
- `total_cost DECIMAL(14,4) NOT NULL`
- `currency VARCHAR(3) NOT NULL DEFAULT 'PLN'`
- `received_at TIMESTAMP NOT NULL`
- `created_at TIMESTAMP NOT NULL`
- `updated_at TIMESTAMP NOT NULL`

Indexes:
- `(company_id, warehouse_id, product_id, variant_id, qty_remaining)`
- `(company_id, product_id, variant_id, received_at)`
- `(source_move_id)` unique or indexed
- `(source_ref_type, source_ref_id, source_ref_item_id)`

Potential additional table for allocations:
- `stock_move_cost_allocations`
  - `stock_move_id`
  - `cost_layer_id`
  - `qty`
  - `unit_cost`
  - `total_cost`

Recommendation: add allocation table in FIFO implementation if partial consumption across multiple layers must be auditable. A single `stock_moves.unit_cost` is insufficient when one WZ line consumes multiple FIFO layers with different unit costs; `stock_moves.total_cost` remains correct, but allocation details are lost without a join table.

---

## 11. FIFO Algorithm

### Incoming: PZ / PW

For each incoming stock move:
1. Validate `unit_cost >= 0` and currency.
2. Create `stock_move` with `unit_cost`, `total_cost = qty * unit_cost`, `currency`, `cost_method='FIFO'`.
3. Create `cost_layer`:
   - `qty_in = qty`
   - `qty_remaining = qty`
   - `unit_cost = unit_cost`
   - `total_cost = qty * unit_cost`
   - `source_move_id = stock_move.id`
   - `source_ref_type/ref_id/ref_item_id` from move
   - `warehouse_id`, `location_id`, `product_id`, `variant_id`
   - `received_at = stock_move.createdAt` or document posting timestamp.

### Outgoing: WZ / RW

For each outgoing stock move:
1. Lock eligible cost layers for update:
   - same `company_id`, `warehouse_id`, `product_id`, `variant_id`.
   - if location-level costing is required, same `location_id` or allocation location.
   - `qty_remaining > 0`.
   - order by `received_at ASC`, `created_at ASC`, `id ASC`.
2. Consume layers until requested qty is covered.
3. Decrease `qty_remaining` per layer.
4. Compute `total_cost = Σ(consumed_qty * layer.unit_cost)`.
5. Set outgoing `stock_move.total_cost = total_cost`.
6. Set outgoing `stock_move.unit_cost = total_cost / qty` as weighted result for that move.
7. Create allocation rows if `stock_move_cost_allocations` is implemented.
8. If layers are insufficient, fail transaction with `INSUFFICIENT_COST_LAYER` or reuse existing `INSUFFICIENT_STOCK` with costing details.

### Transfer: MM

For each transfer quantity:
1. Consume FIFO layers from source warehouse/location like an outgoing move.
2. Create equivalent cost layers at target warehouse/location with same `unit_cost` and `currency`.
3. Link new target layers to the incoming transfer move and optionally to original source layer.
4. Set total cost on outgoing and incoming transfer moves to the same value.
5. Company-level stock value remains unchanged.

---

## 12. AVCO Algorithm

AVCO is moving weighted average cost.

### Required data

Minimum options:
- Use `cost_layers` as transaction ledger plus computed average on demand, or
- Add cached average cost per product/variant/warehouse.

Potential cache table:
- `inventory_cost_balances`
  - `company_id`
  - `warehouse_id`
  - `product_id`
  - `variant_id`
  - `qty_on_hand`
  - `total_value`
  - `avg_unit_cost`
  - `currency`

### Incoming PZ/PW AVCO formula

Before receipt:
- `old_qty`
- `old_value`
- `old_avg = old_value / old_qty`

Incoming:
- `in_qty`
- `in_unit_cost`
- `in_value = in_qty * in_unit_cost`

After receipt:
- `new_qty = old_qty + in_qty`
- `new_value = old_value + in_value`
- `new_avg = new_value / new_qty`

### Outgoing WZ/RW AVCO formula

At issue time:
- `issue_unit_cost = current_avg_unit_cost`
- `issue_total_cost = issue_qty * issue_unit_cost`
- `new_qty = old_qty - issue_qty`
- `new_value = old_value - issue_total_cost`

### Transfer MM AVCO

MM should not change total company value.

Warehouse-level AVCO is more complex:
- Source warehouse decreases quantity and value by current source average.
- Target warehouse receives quantity with source issue unit cost and recomputes target average.
- Company total value remains unchanged, but target warehouse average may change.

### Recommendation on AVCO timing

Do not implement AVCO in the first costing implementation unless required immediately.

Reason:
- FIFO can be built directly on layers and is easier to audit.
- AVCO needs additional cached balances or careful recalculation rules.
- The same `cost_layers`, `stock_moves.unit_cost/total_cost`, and `inventory_cost_method` schema can support AVCO later.

---

## 13. Future Acceptance Criteria

Minimum acceptance for G1 implementation:

1. PZ: receive 10 szt at 20 PLN.
   - Creates `stock_move type='receipt' refType='PZ'` with `unit_cost=20`, `total_cost=200`.
   - Creates cost layer `qty_in=10`, `qty_remaining=10`, `unit_cost=20`, `total_cost=200`, `currency='PLN'`.

2. WZ: ship 3 szt.
   - Consumes 3 from oldest FIFO layer.
   - Updates layer `qty_remaining=7`.
   - WZ `stock_move type='ship'` gets `total_cost=60`, `unit_cost=20`.

3. Stock value.
   - Stock value for that layer equals `qty_remaining * unit_cost = 7 * 20 = 140 PLN`.

4. MM transfer.
   - Moving stock between warehouses/locations does not change company total value.
   - Target warehouse/location gets equivalent layer quantity and unit cost.

5. RW.
   - RW consumes cost layers like WZ.
   - RW `stock_move total_cost` reflects consumed inventory value.

6. PW.
   - PW requires or derives `unitCost`.
   - PW creates cost layer with given `unitCost`.

7. Auditability.
   - For a WZ/RW move consuming multiple FIFO layers, allocation details are queryable.
   - Reposting/idempotent repeat does not create duplicate cost layers or duplicate cost allocations.

---

## 14. Recommended Implementation Files

Expected files to change during implementation, not in this audit:

Backend models/migrations:
- `server/src/models/wms/receiptitem.js`
- `server/src/models/wms/stockmove.js`
- `server/src/models/wms/adjustmentitem.js`
- new `server/src/models/wms/costlayer.js`
- optional new `server/src/models/wms/stockmovecostallocation.js`
- `server/src/models/crm/companywarehousedocumentsetting.js`
- migrations for all fields/tables above.

Backend services:
- new `server/src/services/wms/costingService.js`
- `server/src/services/wms/inventoryService.js`
- `server/src/services/wms/receiptService.js`
- `server/src/services/wms/shipmentService.js`
- `server/src/services/wms/adjustmentService.js`
- `server/src/services/wms/transferService.js`
- `server/src/services/wms/stockBalanceService.js` for stock value outputs.
- `server/src/services/wms/warehousePrintService.js` if print views should show costs.
- `server/src/services/crm/companyWarehouseDocumentSettingsService.js`
- `server/src/schemas/companyWarehouseDocumentSettingsSchema.js`

Backend controllers/routes/schemas:
- WMS document create schemas for PZ/PW cost input.
- Company settings schema for `inventoryCostMethod`.
- Stock balances endpoint if `stockValue` is exposed.

Frontend:
- `client/src/pages/wms/WmsDocumentCreatePage/index.js` for PZ/PW unit cost fields.
- WMS detail/list pages if displaying cost/value.
- `client/src/pages/company/CompanySettings/Modules/WarehouseWmsSettings/index.js` for cost method selector/read-only state.
- RTK APIs only if new endpoints/fields require explicit transforms.

Smoke/tests:
- new `server/scripts/smokeWmsCostingFifo.js`
- extend PZ/WZ/RW/PW smoke with cost assertions.
- later `server/scripts/smokeWmsCostingAvco.js`.

---

## 15. Recommendation

Do not implement FIFO and AVCO together in the first pass.

Recommended order:
1. Implement FIFO first.
2. Add schema that is AVCO-compatible: `inventory_cost_method`, `stock_moves.unit_cost/total_cost`, `cost_layers`, optional cost allocation table.
3. Add AVCO after FIFO is stable and after reports confirm required valuation granularity.

Why:
- FIFO gives deterministic, auditable layer consumption and matches the current document/ledger architecture.
- AVCO needs moving average balances and careful warehouse-level transfer semantics.
- Implementing both at once increases accounting risk and smoke-test surface.

Immediate next engineering step:
- Design the migration set and service contract for FIFO implementation.
- Decide whether `stock_move_cost_allocations` is mandatory in V1. For proper FIFO auditability, it should be included.
