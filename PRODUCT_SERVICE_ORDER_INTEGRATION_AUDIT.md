# A1 — Product/Service ↔ Offers/Orders/Invoices/WMS integration audit

> Status: **audit only**. No code changes, no migrations. Snapshot of 2026-06-05.
> Related: [WMS_PLAN_REALIZATION.md](./WMS_PLAN_REALIZATION.md), [WMS_CORRECTIONS_AUDIT.md](./WMS_CORRECTIONS_AUDIT.md).
> Pre-condition: WMS Corrections v1 closed (PZK/WZK + correction-aware reports, K1.1–K1.8).
> Goal: characterize the current Product / Service / Offer / Order / Invoice / Shipment seam, surface the risks, and propose a unified line-item model for a phased A2–A5 rollout.

> **A5 update, 2026-06-06:** Product/Service ↔ Orders/Offers/WMS/Invoice integration MVP is **COMPLETE**. The original audit below is retained as the pre-A2 baseline. Current runtime status, smoke results, and remaining gaps are documented in [PRODUCT_SERVICE_ORDER_INTEGRATION_STATUS.md](./PRODUCT_SERVICE_ORDER_INTEGRATION_STATUS.md).

---

## 0. TL;DR

### 0.1. Final MVP status after A2-A5

| Area | Status | Verification |
|---|---:|---|
| Product subtype for services | ✅ complete | `products.is_service`; service product derives `lineType=service` and `affectsInventory=false` |
| Shared line semantics | ✅ complete | `lineType`, `affectsInventory`, `isStockTrackedSnapshot` on OfferItem/OrderItem/InvoiceItem |
| WMS handoff predicate | ✅ complete | Reservations/WZ use only `affectsInventory && productId` |
| Invoice line snapshots | ✅ complete | `invoice_items` materialize all line types and survive OrderItem/Product mutations |
| Offer → Order semantics | ✅ complete | `lineType`, `affectsInventory`, `isStockTrackedSnapshot` copied |
| Orders/Offers frontend editors | ✅ complete | Picker badges + line type/stock badges + semantic payload |
| Integration MVP | ✅ complete | `smokeLineItemRuntimeSemantics.js` 17/17 and full A5 regression battery green |

Remaining non-MVP gaps:
- Invoice frontend UI is still `ComingSoon`; backend invoice_items are ready.
- Product/Service catalogue UX polish is later.
- Dedicated Services table remains deferred.
- KSeF/e-invoice export remains deferred.

The following TL;DR is the original pre-A2 audit snapshot and is intentionally not edited line by line.

- **There is no separate `Service` entity** anywhere — backend models, migrations, services, routes, or frontend pages. The PIM `Service` menu entry resolves to `<ComingSoonPage>` ([client/src/App.js:237](client/src/App.js#L237), [client/src/config/menu.js:54](client/src/config/menu.js#L54)). Any "service" sold today must be modeled either as a custom OfferItem/OrderItem (no product), or as a `Product` row with `trackInventory=false`.
- **`Product.trackInventory` exists** ([server/src/models/pim/product.js:254-259](server/src/models/pim/product.js#L254-L259), DB `track_inventory`, default `false`), but **the OMS→WMS pipeline never consults it**. Reservation and shipment-creation filters use only `Boolean(productId) && qty > 0` ([loadReservableOrderItems @ orderService.js:934-947](server/src/services/oms/orderService.js#L934-L947), [mapReservableItems @ reservationService.js:77-89](server/src/services/wms/reservationService.js#L77-L89)). A non-tracked product on an order becomes a shipment line and will fail at `INSUFFICIENT_STOCK` instead of being skipped.
- **`ProductType` is free-form classification** ([server/src/models/pim/producttype.js](server/src/models/pim/producttype.js)) — UUID + `code` + `name` + `isActive`. No semantic flags (`isService`, `affectsInventory`, etc.). The string `productTypeSnapshot` on order lines is informational only ([orderService.js:582-584](server/src/services/oms/orderService.js#L582-L584)) and never branched on.
- **`InvoiceItem` does not exist.** `Invoice` has only `orderId` + totals ([server/src/models/oms/invoice.js](server/src/models/oms/invoice.js)). Invoice line provenance is read live from `order_items` every time, so editing the order silently mutates the invoice's lines and editing/deleting a Product silently rewrites historical invoices.
- **`OfferItem` and `OrderItem` have rich snapshots** (`nameSnapshot`, `skuSnapshot`, `descriptionSnapshot`, `unitSnapshot`, `vatRateSnapshot`, `productTypeSnapshot`, `metadataSnapshot`) + an `isCustomLine` boolean ([offeritem.js:77-178](server/src/models/oms/offeritem.js#L77-L178), [orderitem.js:85-186](server/src/models/oms/orderitem.js#L85-L186)). **There is no `lineType` enum** — line identity is implicit from `productId IS NULL` ⇒ custom.
- **`ProductVariant` carries `price` and `cost`** but does *not* carry `trackInventory`/`isService` — tracking is decided at the Product level only.
- **Custom lines flow through everywhere unchanged**: the OfferItem→OrderItem converter pipes `productTypeSnapshot` and `isCustomLine` 1:1 ([offerService.js:1645-1675](server/src/services/oms/offerService.js#L1645-L1675)); WMS filters strip them out by `productId IS NULL`, so a custom line that *was* a service is correctly excluded from reservation/shipment.
- **`shouldReserveProducts(orderSettings)`** is a per-company toggle (`orderProductReservationMode === 'enabled'`, [companyOrderSettingsService.js:378-380](server/src/services/crm/companyOrderSettingsService.js#L378-L380)). When false, no reservation runs even on tracked-product lines. There is currently a `TODO(order-reservation)` at the create-order seam ([orderService.js:1371-1372](server/src/services/oms/orderService.js#L1371-L1372)).
- **Front-end product picker has no stock awareness**: [OmsProductPicker.jsx](client/src/components/oms/OmsProductPicker.jsx) lists products by name/SKU/price/VAT/unit, **never reads `stockQuantity`/`reservedQuantity`/`trackInventory`/`isService`**, and offers no visual signal that a row is a service or out of stock.

The MVP unlock requires three things together: (1) tag every line with a `lineType` and `affectsInventory`, (2) gate every WMS handoff on `affectsInventory && productId`, (3) snapshot lines onto Invoices so finance documents stop reading mutable order rows.

---

## 1. Current state

### 1.1. PIM models

#### Product ([server/src/models/pim/product.js](server/src/models/pim/product.js))

| Column | Type | Semantic for OMS/WMS |
|---|---|---|
| `id`, `companyId`, `brandId`, `primaryCategoryId`, `subcategoryId`, `uomId`, `supplierId` | UUIDs | Identification/lineage |
| `sku`, `name`, `slug`, `barcode`, `ean`, `pkwiu`, `cn`, `gtu`, `hsCode` | strings | Identification + Polish tax codes |
| `description` | text | — |
| `status` | ENUM `draft / active / archived` | Lifecycle |
| `visibility` | ENUM `public / private` | Catalogue scope |
| `currency` | string(3), default `PLN` | — |
| `price`, `oldPrice`, `cost` | DECIMAL(14,2) | Default unit price + cost |
| **`stockQuantity`** | DECIMAL(14,3), default 0 | Cached `qty_on_hand` aggregate maintained by `productStockCacheService` |
| **`reservedQuantity`** | DECIMAL(14,3), default 0 | Cached reservation sum |
| **`orderedQuantity`** | DECIMAL(14,3), default 0 | Cached open-order sum |
| **`isSellable`** | bool, default `true` | OMS filter only — does NOT gate WMS |
| `weight / length / width / height` | DECIMAL(12,3) | Logistics |
| **`trackInventory`** | bool, default `false` | The closest thing to "is stock-tracked". **Not read by reservation/shipment services.** |
| `publishedAt` | timestamp | Catalogue |
| **`productTypeId`** | UUID → `ProductType` | Free-form classification (no `isService` flag downstream) |
| `taxCategoryId` | UUID → `TaxCategory` (`rate` decimal) | VAT |
| `shippingClassId` | UUID → `ShippingClass` | Carrier hints |
| `countryOfOrigin`, `warrantyMonths`, `dangerousGoodsClass`, `unNumber` | string/int | Polish/EU compliance |
| `isSerialized`, `isLotTracked` | bool | WMS hint only |
| `shelfLifeDays` | int | WMS hint |
| `discontinuedAt`, `replacedByProductId` | timestamp / UUID | Lifecycle |

**No `isService` boolean** anywhere on `Product` or `ProductVariant`.

#### ProductVariant ([server/src/models/pim/productvariant.js](server/src/models/pim/productvariant.js))

Has `price` and `cost`. **Does not** have `trackInventory`, `isService`, `stockQuantity`, etc. Tracking is decided at the Product level and inherited by all variants.

#### ProductType ([server/src/models/pim/producttype.js](server/src/models/pim/producttype.js))

Free-form classification table: `code` + `name` + `isActive`. No semantic columns. The string is propagated into `OfferItem.productTypeSnapshot` / `OrderItem.productTypeSnapshot` purely as a display label.

#### ProductCategory, ProductSupplier

Pivot/related tables — not part of the line-type semantic.

### 1.2. Service entity

| Question | Answer |
|---|---|
| Backend model? | **No** — `server/src/models/pim` has no service.* file |
| Migration? | **No** |
| Service module under `server/src/services/`? | **No** |
| Route? | **No** |
| Frontend page? | **No** — [client/src/App.js:237](client/src/App.js#L237) routes `pim/services` to `<ComingSoonPage moduleName="pim.services" />`; sidebar item [menu.js:54](client/src/config/menu.js#L54) |

**Today's reality**: a service is either (a) a `Product` row with `trackInventory=false` and possibly some `ProductType` named "Service", or (b) a custom OfferItem/OrderItem with `productId IS NULL`. Both work end-to-end *only because* WMS strips out `productId IS NULL`.

### 1.3. OfferItem ([server/src/models/oms/offeritem.js](server/src/models/oms/offeritem.js))

Key columns:
- `productId` UUID nullable, `variantId` UUID nullable, `uomId` UUID nullable
- `sku` string + **`skuSnapshot`** + **`nameSnapshot`** + **`descriptionSnapshot`** + **`unitSnapshot`** + **`vatRateSnapshot`** (DECIMAL 7,4) + **`productTypeSnapshot`** (string up to 32 chars) + **`metadataSnapshot`** JSONB
- `qty` DECIMAL(14,3), default 1
- `priceNet`, `priceGross` DECIMAL(14,2), `taxRate` DECIMAL(7,4)
- `discountType` ENUM-ish string (`none / fixed / percent`), `discountValue`, `discountAmount`
- `lineSubtotalNet`, `lineVat`, `lineTotalGross`
- **`isCustomLine`** bool (the only line-type signal)
- `notes` text

Conversion flow:
- Offer→Order copies snapshot fields 1:1 ([offerService.js:1645-1675](server/src/services/oms/offerService.js#L1645-L1675)). `productTypeSnapshot` is preserved. `isCustomLine` is preserved.
- Offer→Invoice goes through `convertOfferToOrder` first ([offerService.js:1729](server/src/services/oms/offerService.js#L1729)), then issues an Invoice from that order's totals — no separate line snapshot.

### 1.4. OrderItem ([server/src/models/oms/orderitem.js](server/src/models/oms/orderitem.js))

Same shape as OfferItem (drops the discount-owner association, adds `priceListItemId` and a `Reservation` `hasMany` association at line level).

`orderService.normalizeOrderItemInput` ([line 649-687](server/src/services/oms/orderService.js#L649-L687)) sets:
- `isCustomLine` defaults to `!productId` when not supplied
- requires `nameSnapshot` when `productId` is missing

Inventory pipeline filters:
- `loadReservableOrderItems` ([line 934-947](server/src/services/oms/orderService.js#L934-L947)): `items.filter(item => Boolean(item.productId) && asNumber(item.qty,0) > 0)`
- `reservationService.mapReservableItems` ([line 77-89](server/src/services/wms/reservationService.js#L77-L89)): same filter
- `ensureOrderShipmentPosted` ([line 1024-1050](server/src/services/oms/orderService.js#L1024-L1050)): builds the Shipment from `reservableItems.map(productId, variantId, qty)`

### 1.5. Invoice ([server/src/models/oms/invoice.js](server/src/models/oms/invoice.js))

```
Invoice {
  id, companyId, orderId, number, issueDate, dueDate, paidDate,
  totalNet, totalTax, totalGross,
  timestamps + paranoid
}
```

**No `InvoiceItem` model. No `invoice_items` table.** `Invoice.issue(orderId, payload)` ([invoiceService.js:14-99](server/src/services/oms/invoiceService.js#L14-L99)) copies `order.totalNet / totalTax / totalGross` to the invoice header and stops. There is a `TODO(invoice-foundation)` at [line 67-68](server/src/services/oms/invoiceService.js#L67-L68) flagging that invoice subtype/payout/currency/annotation are also missing. The print/PDF flow likely reads lines back from `order_items` via the joined `Order`.

### 1.6. ShipmentItem ([server/src/models/wms/shipmentitem.js](server/src/models/wms/shipmentitem.js))

```
ShipmentItem { id, shipmentId, productId NOT NULL, variantId, qty }
```

`productId` is **NOT NULL** at the DB level → no service or custom line could ever physically land here. The OMS→WMS bridge in `ensureOrderShipmentPosted` already filters at the SQL/service layer, so this NOT NULL is currently the last-line guard.

### 1.7. shouldReserveProducts gate

`companyOrderSettingsService.shouldReserveProducts(orderSettings)` returns `orderProductReservationMode === 'enabled'`. Two seams that use it:
- `orderService.create` ([line 1371-1372](server/src/services/oms/orderService.js#L1371-L1372)) — currently a `TODO`, no actual call to `reservationService.reserveOrder` on create.
- `orderService.update` status transitions ([line 1649-1690](server/src/services/oms/orderService.js#L1649-L1690)) — calls `reservationService.reserveOrder` / `fulfillOrderReservations` on the right transitions.

### 1.8. Frontend line UI

[OrderEditorPage/index.js](client/src/pages/oms/Orders/OrderEditorPage/index.js):
- `createEmptyItem()` ([line 51-74](client/src/pages/oms/Orders/OrderEditorPage/index.js#L51-L74)) — `productId: null, isCustomLine: true, vatRateSnapshot: '23', taxRate: '23'` — i.e. **"Add custom line" is the default**.
- `createProductItem(product)` ([line 76-109](client/src/pages/oms/Orders/OrderEditorPage/index.js#L76-L109)) — snapshots `product.name/sku/desc`, `uom.symbol|code|name` into `unitSnapshot`, `taxCategory.rate` into VAT, `type.code|name` into `productTypeSnapshot`, `price` into `priceNet`. **No `trackInventory` snapshot, no stock check.**
- Add-product button opens [OmsProductPicker.jsx](client/src/components/oms/OmsProductPicker.jsx) — a paged list with `name / sku / netPrice / vat / unit` columns. **Zero stock awareness.**
- Placeholder copy at [line 657-659](client/src/pages/oms/Orders/OrderEditorPage/index.js#L657-L659) flips between `Product name` / `Custom line name` based on `item.productId`. There is **no visual distinction between physical products and services**.

The OfferEditorPage mirrors this exactly.

---

## 2. Entity map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  PIM                                        │
│  Product (trackInventory, isSellable, isSerialized, isLotTracked,           │
│           productTypeId → ProductType{code,name})                            │
│      │                                                                      │
│      ├── ProductVariant (price, cost — no tracking flags)                   │
│      └── ProductCategory, ProductSupplier, PackagingUnit, …                 │
│                                                                              │
│  Service entity: ✗ does not exist (frontend page = ComingSoonPage)          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ (productId, variantId, snapshots)
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  OMS                                        │
│                                                                              │
│  OfferItem ──convertOfferToOrder──▶ OrderItem ──Invoice.issue──▶ Invoice    │
│  (snapshots,                       (snapshots,                  (orderId   │
│   isCustomLine)                     isCustomLine,                + totals  │
│                                     reservations[])               only)     │
│                                                                              │
│      OfferItem ──convertOfferToInvoice──▶ (also goes via Order first)      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ filter: Boolean(productId) && qty > 0
                              │ (no trackInventory check, no lineType check)
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  WMS                                        │
│                                                                              │
│  reservationService.reserveOrder  ─┐                                        │
│                                    ├── reads OrderItem.productId|variantId  │
│  ensureOrderShipmentPosted   ──────┘   creates ShipmentItem(productId NOT  │
│  shipmentService.shipItem   ──▶  StockMove(type=ship, refType=WZ)         │
│                                                                              │
│  ShipmentItem.productId NOT NULL at DB level — last-line safety net         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current risks

### 3.1. Service line accidentally enters WMS
- **How it bites**: a Product with `trackInventory=false` (modelling a service) lands on an Order. On status transition → `reserveOrder` checks `Boolean(productId)` only → it tries to reserve → throws `INSUFFICIENT_STOCK` or, worse, succeeds because `getAvailable` returns 0 deficit when the requirement is 0… but a downstream `ensureOrderShipmentPosted` still creates a ShipmentItem and ultimately fails on `INSUFFICIENT_STOCK` at `applyMove`.
- **Severity**: high — observable today as "the order won't ship even though one of the lines is a hairdresser consultation."
- **Where to fix**: `loadReservableOrderItems` / `mapReservableItems` / `ensureOrderShipmentPosted` — all need an `affectsInventory` predicate, not just `Boolean(productId)`.

### 3.2. Non-stock-tracked physical product enters WMS
- **How it bites**: a Product modelled as a physical good but with `trackInventory=false` (e.g. dropshipped, manually fulfilled) currently still goes through reservation/shipment because the predicate ignores `trackInventory`.
- **Severity**: medium — usually surfaces as `INSUFFICIENT_STOCK` since no PZ ever brought stock on hand.
- **Where to fix**: same predicate.

### 3.3. Missing line-type signal
- The codebase uses `productId IS NULL` as a proxy for "custom line", but a `Product` line that is logically a service is indistinguishable from a stock item. There is no `lineType` enum at the schema level — every downstream guard has to re-derive line semantics.
- **Severity**: medium — every new feature has to pick the right predicate; drift between services is likely.

### 3.4. Price/name/SKU drift
- OfferItem/OrderItem snapshot `priceNet / priceGross / nameSnapshot / skuSnapshot / vatRateSnapshot / unitSnapshot`, so once a line is saved, mutating the Product won't drift its OMS totals. ✓ good.
- BUT `Invoice` has **no snapshots at all** — it reads everything from the order at print time. Editing or deleting an OrderItem after invoice issue silently changes the printed invoice content. ✗
- **Severity**: high for finance.

### 3.5. Deleted/archived product breaks history
- `Product` rows are not paranoid (no soft-delete column visible in the model). A hard-delete (currently nothing in the system actually hard-deletes, but `status='archived'` is supported) will not corrupt OfferItem/OrderItem because they hold snapshots — *except* every join (`OfferItem.product`) returns NULL on render and the picker assumes the product exists.
- The detail pages tolerate it because snapshots have the displayable fields, but the **invoice print** (which doesn't have snapshots — see 3.4) will fall apart.
- **Severity**: medium — bound to surface after first product cleanup.

### 3.6. `OmsProductPicker` shows services as if they were stockable
- No `isService` / `trackInventory` filter or label in the picker UI. A user picking "Hairdressing consultation" sees the same row affordance as picking "Glass bottle 0.5 L".
- **Severity**: low–medium for UX, but **the more dangerous coupling is**: the picker also doesn't refuse to add a service to an order that later transitions to `shipped`. The accident is silent until WMS fails.

### 3.7. Variants have no tracking flag of their own
- `ProductVariant` inherits `trackInventory` from the parent. If a future workflow needs "this variant is a service, that one is a physical bundle" — schema doesn't support it.
- **Severity**: low for MVP.

### 3.8. Invoice has no `subtype / payout method / annotation / currency`
- Marked as `TODO(invoice-foundation)` ([invoiceService.js:67-68](server/src/services/oms/invoiceService.js#L67-L68)).
- **Severity**: medium for finance, but out of the line-item scope.

### 3.9. `shouldReserveProducts` is global
- Either all orders reserve, or none do. There is no per-line "skip reservation" knob today other than `productId IS NULL`. Once `lineType` lands this becomes a non-issue.

---

## 4. Target model — unified `LineItem`

Single conceptual line, shared by Offer / Order / Invoice / Shipment headers. Per-document tables still exist (`offer_items`, `order_items`, `invoice_items`, `shipment_items`), but they share a common column shape and the same enum/derivation rules.

```
LineItem {
  // Identity
  id                 UUID PK
  companyId          UUID NOT NULL
  ownerId            UUID NOT NULL          -- offerId / orderId / invoiceId / shipmentId
  ownerType          ENUM('offer','order','invoice','shipment')   -- redundant with table, but explicit
  sortOrder          INTEGER NOT NULL

  // What kind of line is this?
  lineType           ENUM('product','service','custom','fee','discount') NOT NULL
  affectsInventory   BOOLEAN NOT NULL DEFAULT false
                      -- derived from lineType + product.trackInventory at create-time
                      -- snapshot so later product changes don't rewrite history

  // Source pointers (all nullable except per-row CHECK below)
  productId          UUID NULL  → products(id)        ON UPDATE CASCADE ON DELETE SET NULL
  variantId          UUID NULL  → product_variants(id)
  serviceId          UUID NULL  → services(id)        -- new entity, see §10
  parentLineItemId   UUID NULL                        -- for fee/discount bound to another line

  // Snapshots (always written on create, never live-resolved later)
  nameSnapshot          VARCHAR(512) NOT NULL
  skuSnapshot           VARCHAR(128)
  descriptionSnapshot   TEXT
  unitSnapshot          VARCHAR(64)         -- 'pcs','kg','h','svc'
  productTypeSnapshot   VARCHAR(64)         -- code or name
  isStockTrackedSnapshot BOOLEAN NOT NULL DEFAULT false
                          -- snapshot of Product.trackInventory (or Service.* = false) at the line-creation moment
  metadataSnapshot      JSONB

  // Pricing
  qty                 DECIMAL(14,3) NOT NULL
  unitPriceNet        DECIMAL(14,2) NOT NULL
  unitPriceGross      DECIMAL(14,2) NOT NULL
  taxRate             DECIMAL(7,4)  NOT NULL    -- effective rate %
  taxCategoryId       UUID NULL  → tax_categories(id)
  discountType        ENUM('none','fixed','percent') NOT NULL DEFAULT 'none'
  discountValue       DECIMAL(18,4) NOT NULL DEFAULT 0
  discountAmount      DECIMAL(14,2) NOT NULL DEFAULT 0
  lineSubtotalNet     DECIMAL(18,4) NOT NULL DEFAULT 0
  lineVat             DECIMAL(18,4) NOT NULL DEFAULT 0
  lineTotalNet        DECIMAL(18,4) NOT NULL DEFAULT 0    -- (subtotal − discount)
  lineTotalGross      DECIMAL(18,4) NOT NULL DEFAULT 0

  notes               TEXT
  createdAt, updatedAt, deletedAt (paranoid)
}
```

CHECK constraints (per ownerType table):
```
CHECK ((lineType = 'product'  AND productId IS NOT NULL)
    OR (lineType = 'service'  AND (serviceId IS NOT NULL OR productId IS NOT NULL))
    OR (lineType = 'custom'   AND productId IS NULL AND serviceId IS NULL)
    OR (lineType IN ('fee','discount')))
CHECK (affectsInventory = false OR (lineType = 'product' AND productId IS NOT NULL))
CHECK (lineType <> 'product' OR isStockTrackedSnapshot = affectsInventory)   -- derivation contract
```

Reservation/shipment predicate becomes one line:
```js
const isWmsLine = (item) => Boolean(item.affectsInventory) && Boolean(item.productId);
```

---

## 5. WMS rule

> Only lines with **`affectsInventory = true` AND `productId IS NOT NULL`** are passed to:
> - `reservationService.reserveOrder`
> - `reservationService.fulfillOrderReservations`
> - `ensureOrderShipmentPosted` (Shipment auto-creation)
> - `shipmentService.shipItem` (line execution)
> - any future PZ-equivalent receipt flow

All other line types (`service` / `custom` / `fee` / `discount`, or `product` with `affectsInventory=false`) are invisible to the entire WMS stack.

Derivation at line-creation time:
- `lineType='product' && product.trackInventory=true && product.isSellable=true` → `affectsInventory=true`
- everything else → `affectsInventory=false`

Once snapshotted, `affectsInventory` is immutable on the line — even if the product flips `trackInventory` later. Historical orders ship the way they were ordered.

---

## 6. Offer → Order conversion rule

For each `OfferItem`:
- Copy `lineType`, `productId`, `variantId`, `serviceId`, `parentLineItemId` verbatim.
- Re-snapshot **only the absent fields** (defensive — sometimes editor leaves them blank for custom lines).
- Re-derive `affectsInventory` from the current `Product` at conversion time IFF the conversion happens within N days (configurable; default: re-snapshot always). Otherwise carry the offer's value forward.
- Carry `unitPriceNet`/`taxRate`/`discountType`/`discountValue` verbatim — these were the price the customer accepted.

The existing `convertOfferToOrder` flow already does the 1:1 snapshot copy ([offerService.js:1645-1675](server/src/services/oms/offerService.js#L1645-L1675)); A3 only needs to add `lineType` + `affectsInventory` + `isStockTrackedSnapshot` to the field list.

---

## 7. Order → Invoice conversion rule

For each `OrderItem` → `InvoiceItem`:
- Materialise **all snapshot columns** onto the InvoiceItem (this is new — today there's no InvoiceItem at all).
- Use the Order's line as the snapshot source, not the live Product.
- Carry `lineType` so credit-notes / e-invoice exports know what they're refunding.
- Recompute `lineSubtotalNet / lineVat / lineTotalNet / lineTotalGross` deterministically from `qty × unitPriceNet × (1 − discount) × (1 + taxRate)` and verify equality with the stored order totals (tolerance: rounding ε).
- **Invoice can have lines without a productId**: services and custom lines flow into invoices unchanged.

---

## 8. Order → WZ rule

`ensureOrderShipmentPosted({ orderId, … })`:

```
selectLinesForShipment = OrderItem.findAll(...).filter(
  (line) => line.affectsInventory && line.productId && Number(line.qty) > 0
);
```

Behaviour by line type (after A3):
- `product` + tracked → enters shipment, FIFO consumes a layer, makes a `stock_moves(type='ship', refType='WZ')`.
- `product` + not tracked → **skipped**; invoice still gets the line.
- `service` / `custom` / `fee` / `discount` → **skipped** unconditionally.

If `affectsInventory` lines is **empty**, skip Shipment creation entirely (today the code already early-returns `null`, [orderService.js:1026-1028](server/src/services/oms/orderService.js#L1026-L1028)). That contract is preserved.

---

## 9. Proposed migrations (A2 — schema)

Not produced here. Sketch:

1. **`add-line-type-to-offer-and-order-items`** — adds `line_type ENUM`, `affects_inventory BOOL`, `is_stock_tracked_snapshot BOOL`, `tax_category_id UUID NULL`, `parent_line_item_id UUID NULL`, `service_id UUID NULL` to `offer_items` + `order_items`. Backfills `line_type = CASE WHEN product_id IS NULL THEN 'custom' WHEN is_custom_line THEN 'custom' ELSE 'product' END`; `affects_inventory = (line_type='product' AND EXISTS(SELECT 1 FROM products p WHERE p.id = product_id AND p.track_inventory))`.
2. **`create-services-foundation`** (optional, A3 or later) — `services { id, companyId, code UNIQUE, name, defaultPriceNet, defaultTaxCategoryId, uomId, status }`. Service can also be derived from Product with `trackInventory=false`; the entity is the cleaner long-term design.
3. **`create-invoice-items`** — `invoice_items` table mirroring the LineItem column set; `invoices` gets `subtype`, `payoutMethod`, `annotation`, `currency` columns (also closes `TODO(invoice-foundation)`).
4. **`add-affects-inventory-check-constraints`** — the CHECKs from §4.
5. **`add-snapshots-to-shipment-items`** (optional) — `nameSnapshot`, `unitSnapshot` for printable WZ form. Light touch.

Each migration is reversible (down drops columns/tables). None affect the cost-layer or stock-move schema → costing/correction work stays untouched.

---

## 10. Proposed service changes (A3 — backend)

### 10.1. `offerService` / `orderService` (line normalization)
- Replace `normalizeOrderItemInput` (currently sets `isCustomLine` from `!productId`) with a `normalizeLineItemInput` that:
  - Determines `lineType` from explicit input or `productId`/`serviceId` presence.
  - Looks up `Product` (or `ProductVariant`) once and snapshots `trackInventory` → `isStockTrackedSnapshot`.
  - Derives `affectsInventory = lineType === 'product' && product.trackInventory === true && product.isSellable === true`.
  - Carries `taxCategoryId` to the line for accurate later e-invoice export.
- Update `convertOfferToOrder` to forward `lineType`, `affectsInventory`, `isStockTrackedSnapshot`, `serviceId`, `parentLineItemId`, `taxCategoryId`.

### 10.2. `reservationService.mapReservableItems`
- Predicate changes from `Boolean(item.productId)` to `Boolean(item.affectsInventory) && Boolean(item.productId)`.

### 10.3. `orderService.loadReservableOrderItems` + `ensureOrderShipmentPosted`
- Same predicate. Skip Shipment creation if all order lines are non-inventory.

### 10.4. `invoiceService.issue`
- After Invoice header row is created, snapshot **all** `order_items` into the new `invoice_items` table.
- Carry `lineType` and `affectsInventory` so credit notes / e-invoice can distinguish refundable physical vs service refunds.

### 10.5. `shipmentService.create`
- Strictly assert `every(item => item.productId !== null && Number(item.qty) > 0)`. Right now the model NOT NULL is the only guard.
- Optionally snapshot `nameSnapshot` / `unitSnapshot` onto ShipmentItem for richer WZ prints.

### 10.6. Backwards-compat shims
- During the migration window, `isCustomLine` should be a **derived virtual** column (`lineType === 'custom'`). Existing API consumers keep working until the next major.

---

## 11. Proposed frontend changes (A4)

### 11.1. `OmsProductPicker`
- Add badges per row: `Stock: X` (from `Product.stockQuantity`), `Service`, `Not tracked`.
- Add a `lineType` filter chip (`Products / Services / All`).
- Sort/filter availability respects `isSellable`.
- Surface `isStockTrackedSnapshot` decision to the parent so the order editor labels the line with a small "S" badge for services.

### 11.2. Order/Offer line editor (`OrderEditorPage`, `OfferEditorPage`)
- Add a **"Line type"** dropdown to each line row (`Product / Service / Custom / Fee / Discount`). Default: from picker.
- Disable the qty/price fields appropriately (`Discount` line uses the percent on the parent line).
- Show a "🚫 will not affect inventory" hint on `service / custom` lines so the user understands why WMS won't fire.
- For `lineType='product'` rows that **don't** have stock, show an inline warning before order can be moved to `confirmed/picking`.

### 11.3. Invoice detail
- New `invoice_items` table → render lines from the invoice itself, not the order.
- Show snapshots and the `lineType`.

### 11.4. PIM Services page (post-A2)
- Replace `<ComingSoonPage>` with a real list/detail/create page once the `services` table lands.

---

## 12. Phased implementation plan

### A2 — schema & spec (1–2 days)
- Write `WMS_LINE_ITEM_SPEC.md` (one canonical source for the LineItem shape; supersedes today's split between OfferItem/OrderItem).
- Migration: `add-line-type-to-offer-and-order-items`.
- Migration: `create-invoice-items` + extra Invoice fields.
- Decision: Service as separate entity vs Product subtype. Recommendation: **Product subtype for MVP** (`Product.isService BOOLEAN NOT NULL DEFAULT false`), promote to a separate `services` table later when PIM gains a real Service catalogue. The LineItem `serviceId` column stays nullable in MVP and is filled later.
- Acceptance: migrations apply, rollback, re-apply; no behaviour change yet.

### A3 — backend line item normalization (3–5 days)
- New `normalizeLineItemInput` shared by offer/order services.
- Update `reservationService.mapReservableItems` + `orderService.loadReservableOrderItems` + `ensureOrderShipmentPosted` to the `affectsInventory` predicate.
- `invoiceService.issue` writes `invoice_items`.
- Smokes:
  - `smokeOrderServiceLineRejectedByWms.js` — order with one `service` line + one `product` line → reservation/shipment touches only the product, invoice carries both.
  - `smokeOrderNonTrackedProductSkipsWms.js` — `Product.trackInventory=false` on the order → invoice has the line, no Shipment row.
  - `smokeInvoiceItemsSnapshot.js` — issue invoice, then mutate Product / delete OrderItem; assert invoice prints unchanged.
- Acceptance: all existing OMS/WMS smokes stay green; the three new smokes are green.

### A4 — frontend selectors/forms (3–5 days)
- Picker shows stock + service badges + line-type filter.
- Order/Offer editor renders the line-type dropdown + write-through to backend.
- Invoice detail reads from `invoice_items`.
- New PIM Services page **only after** A2 decision to keep Service inline on Product.
- Acceptance: `CI=false npm --prefix client run build` green; manual click-through on dev (create order with mixed lines, issue invoice, confirm WMS skips services).

### A5 — regression smokes & docs (1–2 days)
- Re-run the WMS regression battery:
  - `smokeCostingReverse.js`, `smokeCostingWmsFlows.js`
  - `smokeInventoryLedgerReport.js`, `smokeStockTurnoverReport.js`, `smokeStockAsOfReport.js`, `smokeStockValuationReport.js`, `smokeCorrectionAwareReports.js`
  - `smokeWmsCorrectionsPzkWzk.js`, `smokeOrderReturnedAutoWzk.js`
  - `smokeWarehouseDocumentsList.js`
- Run new line-item smokes from A3.
- Update [WMS_PLAN_REALIZATION.md](./WMS_PLAN_REALIZATION.md) §19.1 with the LineItem rollout and mark **OMS Line Items v1 = COMPLETE**.

---

## 13. Out of scope (now)

- Real `Service` entity with its own catalogue page — deferred to post-A2 if Product subtype proves limiting.
- E-invoice / KSeF export (Polish authority structured invoices) — needs `invoice_items` first; A2 + A3 are prerequisites.
- Fee/discount lines tied to a parent line (`parentLineItemId`) — schema reserves the column; UX is post-A4.
- Per-variant `trackInventory` override — schema does not need it for MVP; revisit if a real workflow appears.
- Credit-note refactor — credit notes today reference Invoice; once `invoice_items` exists, they should snapshot lines too. Out of A3.

---

## 14. Anchor file references

| Concern | File |
|---|---|
| Product model | [server/src/models/pim/product.js](server/src/models/pim/product.js) |
| ProductVariant | [server/src/models/pim/productvariant.js](server/src/models/pim/productvariant.js) |
| ProductType | [server/src/models/pim/producttype.js](server/src/models/pim/producttype.js) |
| OfferItem | [server/src/models/oms/offeritem.js](server/src/models/oms/offeritem.js) |
| OrderItem | [server/src/models/oms/orderitem.js](server/src/models/oms/orderitem.js) |
| Invoice (no InvoiceItem) | [server/src/models/oms/invoice.js](server/src/models/oms/invoice.js) |
| ShipmentItem (productId NOT NULL) | [server/src/models/wms/shipmentitem.js](server/src/models/wms/shipmentitem.js) |
| Offer→Order converter | [server/src/services/oms/offerService.js:1552-1707](server/src/services/oms/offerService.js#L1552-L1707) |
| `loadReservableOrderItems` | [server/src/services/oms/orderService.js:934-947](server/src/services/oms/orderService.js#L934-L947) |
| `ensureOrderShipmentPosted` | [server/src/services/oms/orderService.js:1024-1100](server/src/services/oms/orderService.js#L1024-L1100) |
| `mapReservableItems` | [server/src/services/wms/reservationService.js:77-89](server/src/services/wms/reservationService.js#L77-L89) |
| `shouldReserveProducts` | [server/src/services/crm/companyOrderSettingsService.js:378-380](server/src/services/crm/companyOrderSettingsService.js#L378-L380) |
| `invoiceService.issue` | [server/src/services/oms/invoiceService.js:14-99](server/src/services/oms/invoiceService.js#L14-L99) |
| Order editor | [client/src/pages/oms/Orders/OrderEditorPage/index.js](client/src/pages/oms/Orders/OrderEditorPage/index.js) |
| Product picker | [client/src/components/oms/OmsProductPicker.jsx](client/src/components/oms/OmsProductPicker.jsx) |
| Services route stub | [client/src/App.js:237](client/src/App.js#L237), [client/src/config/menu.js:54](client/src/config/menu.js#L54) |
