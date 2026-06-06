# A2-A5 — Line item foundation and Product/Service integration

> Status: **A5 complete**. A2 schema, A3 backend runtime semantics, A4 frontend editors, and A5 final verification are complete.
> Date: 2026-06-07. Related: [PRODUCT_SERVICE_ORDER_INTEGRATION_AUDIT.md](./PRODUCT_SERVICE_ORDER_INTEGRATION_AUDIT.md), [WMS_PLAN_REALIZATION.md](./WMS_PLAN_REALIZATION.md).
> Migration: `server/src/migrations/20260607120000-add-line-item-foundation.js`.

---

## 0. Final status after A5

Product/Service ↔ Orders/Offers/WMS/Invoice integration MVP is **COMPLETE**.

| Phase | Status | Delivered |
|---|---:|---|
| A2 schema foundation | ✅ complete | `Product.isService`, line semantic fields on OfferItem/OrderItem, `InvoiceItem` model/table |
| A3 backend runtime semantics | ✅ complete | shared line normalization, WMS `affectsInventory && productId` predicates, InvoiceItem snapshots |
| A4 frontend line editor | ✅ complete | Orders/Offers product picker badges, line type display, `Affects stock` badge, semantic save payload |
| A5 final verification | ✅ complete | required smokes + frontend/backend builds green |

Acceptance verified on 2026-06-06:
- `smokeLineItemRuntimeSemantics.js`: `17/17`
- `smokeLineItemFoundation.js`: `46/46`
- `smokeOrdersReservationsWzApi.js`: passed
- `smokeOrderReturnedAutoWzk.js`: `18/18`
- `smokeWmsCorrectionsPzkWzk.js`: `27/27`
- `smokeWarehouseDocumentsList.js`: `29/29`
- `smokeCostingWmsFlows.js`: `23/23`
- `npm --prefix client run build`: passed with pre-existing warnings
- `docker compose build frontend`: passed
- `docker compose build backend`: passed

Current remaining gaps are documented in [PRODUCT_SERVICE_ORDER_INTEGRATION_STATUS.md](./PRODUCT_SERVICE_ORDER_INTEGRATION_STATUS.md).

The sections below retain the original A2 foundation plan for traceability.

---

## 1. Locked decisions

### Service ≠ separate entity (MVP)
A standalone `services` table is **not** introduced. The audit's recommendation was: keep service as a Product subtype for MVP, promote to a real entity only when a Service catalogue is needed.

The result: `products.is_service BOOLEAN NOT NULL DEFAULT false`. A service is a Product row with `is_service = true`. Reservation/shipment logic (in A3) treats `is_service = true` the same as `track_inventory = false`.

### `trackInventory` keeps its current meaning
Independent flag. Could in principle be `true` on a service row (nonsensical but not prevented by schema). A3 will hard-decline that combination at the service layer.

### `affectsInventory` is snapshotted per line
The line's `affects_inventory` is decided at line creation/update time and stored. Even if a product later flips `track_inventory` or `is_service`, historical orders ship the way they were ordered.

Derivation rule (A3):
```
affects_inventory = (
  line_type = 'product'
  AND product.track_inventory = true
  AND product.is_service = false
  AND product.is_sellable = true   -- already an OMS guard
)
```

### `lineType` is the shared classifier
ENUM `product_service_line_type ('product','service','custom','fee','discount')`. One PG type, reused by `offer_items.line_type`, `order_items.line_type`, `invoice_items.line_type`. `fee` and `discount` are reserved for parent-line attachments and not used in A2; A3 may or may not use them depending on need.

### `InvoiceItem` is created but unused in A2
The table and model exist after this migration. `invoiceService.issue` is not changed yet; invoices are still header-only at runtime. A3 will start writing snapshots there.

### CHECK constraints deferred
Per task scope: backfill existing rows, but do not add CHECKs that could fail on legacy data. A3 will add CHECKs after the backfill is verified across all production-like datasets.

---

## 2. What ships in A2

### Migration `20260607120000-add-line-item-foundation`

#### Products
- `is_service BOOLEAN NOT NULL DEFAULT false`
- Index `products_company_is_service_idx (company_id, is_service)`

#### offer_items
- `line_type product_service_line_type NOT NULL DEFAULT 'product'`
- `affects_inventory BOOLEAN NOT NULL DEFAULT false`
- `is_stock_tracked_snapshot BOOLEAN NOT NULL DEFAULT false`
- `tax_category_id UUID NULL → tax_categories(id)` ON UPDATE CASCADE / ON DELETE SET NULL
- `parent_line_item_id UUID NULL → offer_items(id)` (self-FK) ON UPDATE CASCADE / ON DELETE SET NULL
- Indexes: `offer_items_company_line_type_idx`, `offer_items_company_affects_inventory_idx`

#### order_items
Same column set + indexes. Plus a composite:
- `order_items_company_product_affects_inventory_idx (company_id, product_id, affects_inventory)`

#### Backfill (single UPDATE per table)
```sql
UPDATE <table> SET
  line_type = CASE
    WHEN product_id IS NULL OR is_custom_line = true THEN 'custom'
    WHEN p.is_service = true                          THEN 'service'
    ELSE 'product'
  END,
  is_stock_tracked_snapshot = COALESCE(p.track_inventory, false),
  affects_inventory = CASE
    WHEN product_id IS NULL OR is_custom_line = true THEN false
    WHEN p.is_service = true                          THEN false
    ELSE COALESCE(p.track_inventory, false)
  END
FROM <table> it2 LEFT JOIN products p ON p.id = it2.product_id
WHERE it.id = it2.id;
```

#### invoice_items
New table mirroring the unified LineItem column set: identity (`id`, `company_id`, `invoice_id`), source pointers (`order_item_id`, `product_id`, `variant_id`, `tax_category_id`, `parent_line_item_id` self-FK), classifier (`line_type`, `affects_inventory`, `is_stock_tracked_snapshot`), full snapshots (`sku/name/description/unit/product_type/metadata`), pricing block (`qty`, `price_net/gross`, `tax_rate`, `discount_*`, `line_subtotal_net`, `line_vat`, `line_total_net`, `line_total_gross`), and `notes`, `sort_order`, timestamps + `deleted_at` (paranoid).

Indexes: `(company_id, invoice_id)`, `(company_id, line_type)`, `(company_id, product_id)`.

### Models updated
- `server/src/models/pim/product.js` — adds `isService`.
- `server/src/models/oms/offeritem.js` — adds `lineType`, `affectsInventory`, `isStockTrackedSnapshot`, `taxCategoryId`, `parentLineItemId` + `taxCategory` / `parentLineItem` associations.
- `server/src/models/oms/orderitem.js` — same fields + `taxCategory` / `parentLineItem` / `invoiceItems` associations.
- `server/src/models/oms/invoiceitem.js` — new model, full LineItem shape, paranoid.
- `server/src/models/oms/invoice.js` — `hasMany(InvoiceItem, as:'items')`.

The model `lineType` field declares Sequelize ENUM(...) for **client-side validation only**. The PG column points at the pre-existing shared `product_service_line_type` type; Sequelize never recreates it because we never call `sync()`.

### Spec doc
This file: `LINE_ITEM_FOUNDATION_PLAN.md`.

### Smoke
`server/scripts/smokeLineItemFoundation.js` — verifies columns exist, backfill rules look right, model associations load, and an Invoice + InvoiceItem create flow works end-to-end inside a rolled-back transaction.

---

## 3. What A3 will change (preview, not in scope here)

1. **`normalizeLineItemInput`** — shared between `offerService` and `orderService`. Looks up the product/variant once, snapshots `track_inventory` → `isStockTrackedSnapshot`, derives `affectsInventory`, sets `lineType`. Accepts explicit `lineType` from the editor (e.g. user adds a "Fee" line).
2. **`reservationService.mapReservableItems`** — predicate flips to `Boolean(item.affectsInventory) && Boolean(item.productId)`.
3. **`orderService.loadReservableOrderItems`** — same.
4. **`orderService.ensureOrderShipmentPosted`** — same. Also: skip Shipment creation entirely if no `affectsInventory` lines remain.
5. **`invoiceService.issue`** — after the Invoice header is written, snapshot every `order_items` row into `invoice_items`.
6. **`shipmentService.create`** — explicit assertion that every shipment-line input carries a `productId`. (Today only the DB NOT NULL catches violations.)

A3 also adds:
- `smokeOrderServiceLineRejectedByWms.js`
- `smokeOrderNonTrackedProductSkipsWms.js`
- `smokeInvoiceItemsSnapshot.js`

The full regression battery (`smokeOrdersReservationsWzApi`, `smokeCostingWmsFlows`, `smokeWmsCorrectionsPzkWzk`, `smokeWarehouseDocumentsList`) must remain green after A3.

---

## 4. Why no CHECK constraints in A2

The audit (§4) proposed three CHECK constraints:

```
CHECK ((line_type='product' AND product_id IS NOT NULL) OR …)
CHECK (affects_inventory = false OR (line_type='product' AND product_id IS NOT NULL))
CHECK (line_type <> 'product' OR is_stock_tracked_snapshot = affects_inventory)
```

These will be added in A3 **after** A2's backfill has been validated against real data. Adding them now risks blocking the migration on a row that's structurally legacy (e.g. a historical custom line that's somehow marked `is_custom_line=false` with `product_id=null` — the backfill recovers it but a CHECK would refuse to even apply). Spec deferral is intentional and documented.

---

## 5. Acceptance criteria

- Migration applies cleanly on a fresh schema and on the existing dev database.
- `db:migrate:undo` followed by `db:migrate` is a no-op (smoke verifies both columns and indexes round-trip).
- `smokeLineItemFoundation.js` is green.
- Regression smokes are green:
  - `smokeOrdersReservationsWzApi`
  - `smokeWmsCorrectionsPzkWzk`
  - `smokeWarehouseDocumentsList`
  - `smokeCostingWmsFlows`

---

## 6. Out of scope (do not touch in A2)

- `normalizeLineItemInput` (A3)
- WMS predicate changes (A3)
- `invoiceService.issue` line snapshotting (A3)
- Frontend picker / editor changes (A4)
- Standalone `services` table (post-A4 if ever)
- CHECK constraints on the new columns (A3)
