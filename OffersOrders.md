# Offers & Orders Architecture

> **Scope note:** This document covers the Offers and Orders modules only.
> Document template editor, canvas, DnD, PDF builder — not touched here.
> Use this as a spec for the next Codex implementation task.

---

## 1. Scope and Non-Scope

### In scope
- Offers module: UI standardization, with priority on the list page
- Orders module: production-ready backend foundation + standard frontend list/detail shell
- Offer → Order conversion: keep working, extend Order side without creating a second conversion path

### Explicitly out of scope
- Document template editor / canvas / DnD / PDF
- Invoices module internals
- Warehouse documents module internals
- Document numbering as a standalone nav item
- Analytics dashboard or summary cards on list pages
- Pixel-perfect redesigns, custom visual islands, and one-off UI patterns
- CRM pipeline / Leads / Deals (only referenced as sources)

### UI standard rule
- List pages must use the shared `ListPage` pattern.
- Detail pages should use `EntityDetailsPage` only where it fits safely with existing project APIs.
- Do not guess `EntityDetailsPage` props. Inspect the existing implementation before using it.
- For this iteration, do not force-migrate a working custom detail page if that creates regression risk.
- Custom detail layouts are acceptable only if they visually follow the system detail-page conventions: standard header, tabs, actions, loading/error/empty states, and spacing.

---

## 2. Current State Audit

### 2.1 Offers Backend — Complete

| Layer | File | Status |
|---|---|---|
| Model | `server/src/models/oms/offer.js` | ✅ Full |
| Model | `server/src/models/oms/offeritem.js` | ✅ Full |
| Service | `server/src/services/oms/offerService.js` | ✅ Full (~1675 lines) |
| Controller | `server/src/controllers/oms/Offer.controller.js` | ✅ Full |
| Router | `server/src/routes/oms/offerRouter.js` | ✅ Mounted in rootRouter |

**Offer model key fields:** `number`, `status` (draft/sent/viewed/accepted/rejected/expired/cancelled), `issueDate`, `validUntil`, `currency`, `totalNet/Tax/Gross`, `paymentTerms`, `deliveryTerms`, `convertedOrderId`, `convertedAt/By`, `revision`, full audit trail timestamps.

**Status machine (enforced in service):**
```
draft → sent → viewed → accepted ──► convertible to order
                       → rejected
                       → expired
draft/sent/viewed → cancelled
```

**Offer-to-Order conversion** (`offerService.convertOfferToOrder`):
1. Load offer WITH LOCK (pessimistic concurrency)
2. Validate status = `accepted` AND `convertedOrderId` is null
3. Generate order number (with retry for uniqueness)
4. CREATE Order + bulk-create OrderItems from OfferItems (snapshots preserved)
5. UPDATE Offer: `convertedOrderId`, `convertedAt`, `convertedBy`
6. TODO placeholder: reserve stock
7. Log event `offer.converted_to_order`
8. Return full order DTO

### 2.2 Offers Frontend — Functional but diverges from system patterns

| Layer | File | Status |
|---|---|---|
| RTK Query | `client/src/store/rtk/offersApi.js` | ✅ Full (all mutations + queries) |
| List page | `client/src/pages/oms/offers/OffersListPage.jsx` | ⚠️ Uses ListPage but adds non-standard chrome |
| Detail page | `client/src/pages/oms/offers/OfferDetailPage.jsx` | ⚠️ Fully custom, does NOT use EntityDetailPage |
| Create page | `client/src/pages/oms/offers/OfferCreatePage.jsx` | ✅ Exists |
| Utilities | `client/src/pages/oms/offers/offerUtils.js` | ✅ Keep as-is |
| Routes | `client/src/App.js` | ✅ offers/new + offers/:id defined |
| Menu | `client/src/config/menu.js` | ✅ Offers item registered |

**Where OffersListPage diverges from system standard:**

1. **Summary strip** — 5 summary cards (total, draft, sent, accepted, converted) rendered above the table. These count items only on the current page (not from the server), which is semantically wrong and clutters the page. **Must be removed.**
2. **Custom page header** — bespoke `<section className={s.offersListHeader}>` with eyebrow text, H1, subtitle. Other list pages don't have this. Should use the system header pattern.
3. **Custom CSS island** — `Offers.module.css` with 50+ bespoke classes (`offersListPage`, `offersListSummaryCard`, `offersListSummaryStrip`, etc.). These duplicate system styles.
4. **Custom filter toolbar** — `OffersFiltersToolbar` is a full bespoke component passed to `ListPage.ToolbarComponent`. This is the correct extension point, but filter chip rendering uses custom styles instead of system chip classes.
5. **Custom empty state** — `OffersEmptyState` uses Russian hardcoded strings, custom icon, custom classes.

**Where OfferDetailPage diverges:**

1. Does not use `EntityDetailPage` scaffold at all — completely custom layout.
2. Draft management, autosave, tab preferences all re-implemented inline.
3. Has working inline editors (`OfferHeaderForm`, `OfferItemsEditor`) that contain real business logic — **do not rewrite these**.
4. **Risk:** Migrating to `EntityDetailPage` scaffold would be a significant refactor with risk of regression. Unless Codex specifically targets this, the detail page should be left as-is for now and only lightly adjusted (remove any non-standard chrome). Priority is the list page cleanup and Orders implementation. Detail migration to `EntityDetailsPage` is explicitly deferred unless Codex confirms the shared component can be adopted without touching the working business editors.

### 2.3 Orders Backend — Foundation Only

| Layer | File | Status |
|---|---|---|
| Model | `server/src/models/oms/order.js` | ✅ Complete model |
| Model | `server/src/models/oms/orderitem.js` | ✅ Complete model |
| Service | `server/src/services/oms/orderService.js` | ⚠️ Basic (~176 lines), needs expansion |
| Controller | `server/src/controllers/oms/Order.controller.js` | ⚠️ Basic (list/get/create/update/remove/fromOffer) |
| Router | `server/src/routes/oms/orderRouter.js` | ❌ **NOT MOUNTED in rootRouter.js** |
| Settings | `server/src/services/oms/companyOrderSettingsService.js` | ✅ Exists |

**Order model key fields:** `number`, `status` ENUM (draft/new/confirmed/paid/shipped/completed/cancelled/returned), `paymentStatus` ENUM (pending/paid/refunded/partially_refunded), `fulfillmentStatus` ENUM (unfulfilled/partial/fulfilled), `offerId`, `customerId`, `contactId`, `ownerId`, `currency`, `totalNet/Tax/Gross`, `placedAt`, `confirmedAt`, source tracking (`sourceType`, `sourceOfferId`).

**Order model relationships (already defined):**
- `hasMany(OrderItem)` with CASCADE
- `hasMany(Payment)` with CASCADE
- `hasMany(Invoice)` with CASCADE
- `hasMany(Shipment)` with CASCADE
- `hasMany(OrderEvent)` with CASCADE
- `hasMany(OrderNote)` with CASCADE
- `belongsTo(Offer)` (source offer)

**Critical bug:** `orderRouter` exists but is never mounted. `rootRouter.js` mounts `/offers` but has no `/orders` line. The Orders settings endpoint (`/company-settings/orders`) does work. The API for order CRUD simply doesn't exist yet from the frontend's perspective.

**Alternative conversion path:** `POST /orders/from-offer/:offerId` via `orderService.fromOffer()` — copies fields from offer but does NOT update `offer.convertedOrderId`. This is a divergent path. The canonical path remains `offerService.convertOfferToOrder()`. The `fromOffer` endpoint should be deprecated or removed to avoid dual paths.

### 2.4 Orders Frontend — Nothing Exists

| Layer | File | Status |
|---|---|---|
| RTK Query | `client/src/store/rtk/ordersApi.js` | ❌ Missing |
| List page | `client/src/pages/oms/orders/OrdersListPage.jsx` | ❌ Missing |
| Detail page | `client/src/pages/oms/orders/OrderDetailPage.jsx` | ❌ Missing |
| Routes | `client/src/App.js` | ❌ Orders routes not defined |
| Menu | `client/src/config/menu.js` | ⚠️ Entry points to `/main/oms/orders` (broken) |

### 2.5 Migrations — Already Exist

All required tables are already migrated:
- `offers`, `offer_items` — complete
- `orders`, `order_items`, `order_events`, `order_notes` — complete
- `company_order_settings`, `company_offer_settings` — complete
- Conversion fields on offers/orders — complete (2026-04-22 migrations)

**No new migrations needed** for the base Orders CRUD. Migrations may be needed later for fulfillment tracking fields if they don't exist yet.

### 2.6 Risks Before Orders Implementation

| Risk | Severity | Mitigation |
|---|---|---|
| orderRouter not mounted → all /orders 404 | High | Mount in rootRouter before any frontend work |
| Dual conversion paths (offerService vs orderService.fromOffer) | Medium | Keep offerService path canonical; deprecate fromOffer or align it |
| Order model has no status transition rules (unlike Offer) | Medium | Implement status machine in orderService before exposing endpoints |
| OrderItem.priceListItemId FK — PriceListItem model may not exist | Low | Make nullable, skip join if model not loaded |
| Stock reservation is TODO stub in both services | Low | Leave as TODO, don't block CRUD |
| Order has hasMany(Invoice/Payment/Shipment) but those models may be stubs | Medium | Guard with optional chaining in service, don't include if model missing |

---

## 3. Offers UI Standardization

### 3.1 What to change in OffersListPage

**Remove entirely:**
- `<section className={s.offersListSummaryStrip}>` and the `OffersSummary` component
- `statusCounters` and `summaryItems` computed values (no longer needed)
- `OffersSummary` component definition
- Most of `Offers.module.css` classes that only serve the summary strip and bespoke header

**Simplify page header:**
- Keep the AddButton and Refresh button
- Remove eyebrow text, subtitle paragraph
- The `<section className={s.offersListHeader}>` should match how other list pages render their header — a simple flex row with title + actions, using system CSS classes, not bespoke ones

**Keep as-is:**
- `OffersFiltersToolbar` — it's the correct `ToolbarComponent` injection point into ListPage; filter logic is correct
- The ListPage usage itself — source="offers", columns, rowActions, grid prefs
- All `useGridPrefs` wiring — keep
- Column schema (`offersColumns.js`) — keep

**Filter chips:** Use system chip classes instead of `s.offersListFilterChip` if system chip classes exist. If not, keep current as-is — this is lower priority than removing the summary strip.

**Empty state:** Replace custom `OffersEmptyState` with the system empty state component if one exists, or use ListPage's built-in `emptyStateText` prop. Remove the custom `OffersEmptyState` component.

### 3.2 What to change in OfferDetailPage now

**Leave the core as-is.** The form editors and status actions are working correctly and migrating to EntityDetailPage scaffold is high-risk.

Do not force `EntityDetailsPage` here. The safe target for this iteration is visual consistency, not a risky structural rewrite.

**Light cleanup only:**
- Ensure tab structure matches the system tab pattern (Overview / Items / Terms / Related)
- Status action buttons should use system button classes, not Offers-specific ones
- "Convert to Order" modal uses system modal, not a custom one — verify this


**Do not:**
- Rewrite OfferHeaderForm or OfferItemsEditor
- Change the inline draft management
- Migrate to EntityDetailPage scaffold in this task

**Deferred technical debt:**
- Later, after Orders is stable, inspect `EntityDetailsPage` and decide whether OfferDetailPage can be migrated safely.
- If migrated later, keep `OfferHeaderForm`, `OfferItemsEditor`, draft management, and status actions intact.

### 3.3 Standard patterns to follow

**List page pattern (as used by counterparties, deals, etc.):**
```
<div className={systemStyles.listPageShell}>
  <ListPage
    source="offers"
    externalData={...}
    externalMeta={...}
    columns={columns}
    ToolbarComponent={OffersFiltersToolbar}
    rowActions={rowActions}
    ...gridPrefs
  />
</div>
```
No extra sections. No summary cards. Header (title + AddButton) goes into ListPage's `actions` prop or as a simple row above.

**Detail page pattern:**
- Prefer `EntityDetailsPage` only after inspecting its real API and confirming it supports the needed layout.
- If using a custom detail layout, match the shared detail-page conventions and do not create a visual island.
- Left pane: master form (header fields, status badge, key metadata)
- Right pane: tabs (Overview / Items / relevant tabs)
- Actions bar: status transitions + duplicate + delete
- System tab bar component
- System empty/loading/error states

---

## 4. Orders Product Model

### 4.1 Role of Orders in the Business Chain

```
Lead / Deal
    ↓
  Offer  ──── draft/sent/viewed/accepted/rejected
    ↓ (convert)
  Order  ──── confirmed/in-progress/completed/cancelled
    ↓
  ┌──────────────────────────────────────────┐
  │  Invoice      Warehouse Doc    Shipment  │
  │  (billing)    (stock mvmt)    (delivery) │
  └──────────────────────────────────────────┘
    ↓
  Payment
```

**Order is the binding commitment.** It is the central document that:
- Locks in the customer, items, prices, and quantities
- Tracks fulfillment progress (what was shipped)
- Tracks billing progress (what was invoiced)
- Tracks payment progress (what was paid)
- Links to the actual operational documents (invoices, warehouse docs, shipments)

### 4.2 How Order Differs from Offer

| Dimension | Offer | Order |
|---|---|---|
| Purpose | Commercial proposal, negotiable | Binding commitment |
| Mutability | Editable until accepted | Items locked after confirmation |
| Validity date | validUntil field | N/A (order doesn't expire) |
| Conversion | Converts to Order | Does not convert further |
| Invoicing | No invoice logic | Has invoiceStatus, links to invoices |
| Fulfillment | No fulfillment | Has fulfillmentStatus, tracks qty |
| Payment | No payment tracking | Has paymentStatus, links to payments |
| Warehouse | No warehouse docs | Links to warehouse docs |

### 4.3 Order Entity Fields

**Header fields (already on model, verify completeness):**
- `id` UUID PK
- `companyId` UUID FK — tenant scope
- `number` VARCHAR(128) — auto-generated, unique per company
- `offerId` UUID FK nullable — source offer
- `customerId` UUID FK — Counterparty
- `contactId` UUID FK nullable — Contact
- `ownerId` UUID FK nullable — sales owner (User)
- `dealId` UUID FK nullable — linked Deal (add if missing)
- `currency` CHAR(3) default PLN
- `exchangeRate` DECIMAL(18,6) default 1
- `status` ENUM — see section 4.4
- `paymentStatus` ENUM — see section 4.4
- `fulfillmentStatus` ENUM — see section 4.4
- `invoiceStatus` ENUM (not_invoiced / partially_invoiced / fully_invoiced) — **add if missing**
- `totalNet` DECIMAL(14,2)
- `totalTax` DECIMAL(14,2)
- `totalGross` DECIMAL(14,2)
- `discountTotal` DECIMAL(14,2)
- `paymentTerms` TEXT nullable
- `deliveryTerms` TEXT nullable
- `leadTime` VARCHAR(128) nullable
- `incoterms` VARCHAR(32) nullable
- `notes` TEXT nullable
- `internalNotes` TEXT nullable
- `billingAddressSnapshot` JSONB nullable
- `shippingAddressSnapshot` JSONB nullable
- `placedAt` TIMESTAMP — when order was placed/created
- `confirmedAt` TIMESTAMP nullable
- `shippedAt` TIMESTAMP nullable
- `completedAt` TIMESTAMP nullable
- `cancelledAt` TIMESTAMP nullable
- `sourceType` VARCHAR(32) nullable ('offer', 'direct', 'api')
- `sourceId` UUID nullable
- `sourceOfferId` UUID nullable — explicit ref back to offer
- `meta` JSONB nullable
- `revision` INTEGER default 0
- `createdBy` UUID FK
- `updatedBy` UUID FK nullable
- Standard paranoid: `createdAt`, `updatedAt`, `deletedAt`

**OrderItem fields (already on model, verify completeness):**
- `id` UUID PK
- `orderId` UUID FK
- `sortOrder` INTEGER
- `productId` UUID FK nullable
- `variantId` UUID FK nullable
- `uomId` UUID FK nullable
- `priceListItemId` UUID FK nullable
- `sku` VARCHAR(128) nullable
- `nameSnapshot` TEXT
- `descriptionSnapshot` TEXT nullable
- `unitSnapshot` VARCHAR(64) nullable
- `vatRateSnapshot` DECIMAL(7,4) nullable
- `productTypeSnapshot` VARCHAR(32) nullable
- `metadataSnapshot` JSONB nullable
- `qty` DECIMAL(14,3)
- `qtyReserved` DECIMAL(14,3) default 0 — **add if missing**
- `qtyFulfilled` DECIMAL(14,3) default 0 — **add if missing**
- `qtyInvoiced` DECIMAL(14,3) default 0 — **add if missing**
- `priceNet` DECIMAL(14,4)
- `priceGross` DECIMAL(14,4)
- `taxRate` DECIMAL(7,4)
- `discountType` ENUM (none/fixed/percent)
- `discountValue` DECIMAL(14,4) default 0
- `discountAmount` DECIMAL(14,4) default 0
- `lineSubtotalNet` DECIMAL(14,2)
- `lineVat` DECIMAL(14,2)
- `lineTotalGross` DECIMAL(14,2)
- `isCustomLine` BOOLEAN default false
- `notes` TEXT nullable
- `createdAt`, `updatedAt`

### 4.4 Statuses

**`status` (lifecycle):**

Current model enum appears to use:
```text
draft → new → confirmed → completed
                  ↘ cancelled
completed → returned
```

Recommended business labels for UI:
- `draft` — draft order, editable
- `new` — new / submitted order waiting for confirmation; keep the enum if already migrated, but label it clearly in UI
- `confirmed` — confirmed by ops team, can trigger reservation/fulfillment basis
- `completed` — commercially closed order
- `cancelled` — cancelled before completion
- `returned` — returned after completion

Do not rename or replace existing enum values in this iteration unless the existing migration/model is explicitly updated and all conversion paths are adjusted. Prefer UI labels over enum churn.

**`paymentStatus` (derived from linked payments):**
Current model may use `pending`, `paid`, `refunded`, `partially_refunded`. If `partially_paid` is missing, add it only via a deliberate migration; otherwise map it carefully in service/UI.
- `pending` — no payments yet
- `partially_paid` — some payments received, if supported by the enum
- `paid` — fully paid
- `refunded` — fully refunded
- `partially_refunded` — partial refund

**`fulfillmentStatus` (derived from qtyFulfilled vs qty):**
- `unfulfilled` — nothing shipped
- `partial` — some lines shipped
- `fulfilled` — all lines shipped

**`invoiceStatus` (derived from linked invoices):**
This field may be missing from the current model/migration. If missing, add it in a small dedicated migration before exposing it in the frontend.
- `not_invoiced` — no invoices
- `partially_invoiced` — some lines invoiced
- `fully_invoiced` — fully invoiced

### 4.5 Qty Tracking (OrderItem level)

| Field | Meaning | Set by |
|---|---|---|
| `qty` | Ordered quantity | Order creation/edit |
| `qtyReserved` | Reserved in warehouse | Warehouse reservation action |
| `qtyFulfilled` | Actually shipped | Warehouse doc / shipment completion |
| `qtyInvoiced` | Invoiced quantity | Invoice creation/link |

**Invariant:** `qtyFulfilled <= qtyReserved <= qty` and `qtyInvoiced <= qty`

Derived `fulfillmentStatus` at Order level:
- All items: `qtyFulfilled == 0` → `unfulfilled`
- Any item: `qtyFulfilled > 0 && qtyFulfilled < qty` → `partial`
- All items: `qtyFulfilled >= qty` → `fulfilled`

### 4.6 Snapshots Are Mandatory

Every OrderItem must capture at creation time:
- `nameSnapshot` — product name as shown on the order
- `unitSnapshot` — unit label
- `vatRateSnapshot` — VAT % at time of order
- `priceNet`, `priceGross` — locked prices

Rationale: product catalog changes must not retroactively alter order line data.

### 4.7 Custom Lines

`isCustomLine = true` allows free-text lines without a productId:
- `nameSnapshot` set manually
- `productId` is null
- All price/tax fields still required

---

## 5. Orders Backend Architecture

### 5.1 What Must Not Break

- `offerService.convertOfferToOrder()` is the canonical conversion path — **do not change its signature or behavior**
- `Offer.convertedOrderId` and `convertedAt/By` fields are set there — keep
- The `OrderItem` model associations to `Reservation` — leave these in place even if Reservation model is a stub
- `companyOrderSettingsService` — used for numbering and annotations, already works

### 5.2 Mount the Router First

**File:** `server/src/routes/rootRouter.js`

Add one line (alongside the existing `/offers` mount):
```javascript
router.use("/orders", auth, companyIdGuard, requireMember, ordersRouter);
```
Import `ordersRouter` at the top of rootRouter. This alone unblocks all frontend development.

### 5.3 Extend OrderService

Current `orderService.js` has ~176 lines with basic CRUD. Needs:

**`listOrders(query, userContext)`** — full list with:
- Pagination: page, limit (default 25, max 200)
- Filters: `search` (number/customer name), `status`, `paymentStatus`, `fulfillmentStatus`, `ownerId`, `customerId`, `offerId`, `placedAtFrom`, `placedAtTo`
- Sorting: `sort` + `dir`
- companyId scope always applied
- Include: `customer` (Counterparty), `contact`, `owner` (User) for table display
- Returns: `{ items, total, page, limit }`

**`getOrderById(id, userContext)`** — full detail with:
- Include: `items` (with product/variant/uom), `customer`, `contact`, `owner`, `sourceOffer`
- Guard includes with try/catch or optional chaining for missing models
- Returns full DTO

**`createOrder(payload, userContext)`** — direct creation (not from offer):
- Validate required fields: `customerId`, at least 1 item
- Generate `number` using document numbering service (same pattern as offers)
- Calculate totals from items
- Set `status = 'draft'`, `paymentStatus = 'pending'`, `fulfillmentStatus = 'unfulfilled'`
- Transaction: create Order + bulk create OrderItems
- Log OrderEvent: `order.created`
- Return full DTO

**`updateOrder(id, payload, userContext)`** — header update:
- Only allow header fields (not items) — items have separate endpoint
- Cannot edit if status is completed/cancelled/returned
- Recalculate totals if item-related fields change
- Increment revision
- Log OrderEvent: `order.updated`

**`updateOrderItems(id, items, userContext)`** — replace items:
- Only if status is draft/new (not after confirmation)
- Same pattern as `offerService.saveOfferItems()` — replace all lines in transaction
- Recalculate totals
- Log OrderEvent: `order.items_updated`

- **`changeOrderStatus(id, newStatus, payload, userContext)`** — state machine:
```javascript
const ALLOWED_TRANSITIONS = {
  draft: ['new', 'cancelled'],
  new: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};
```
- Set corresponding timestamp field (`confirmedAt`, `completedAt`, etc.)
- Log OrderEvent with actor
- Return updated order

**`deleteOrder(id, userContext)`** — soft delete only if status = draft

**`duplicateOrder(id, payload, userContext)`** — copy header + items into new draft

**`getOrderMeta(query, userContext)`** — metadata for list UI (customers, users for filter dropdowns)

**Remove/deprecate `fromOffer()`** — merge its logic into `convertOfferToOrder` in offerService. The dual path is confusing. If orderRouter's `POST /from-offer/:id` is needed, proxy it to `offerService.convertOfferToOrder()`.

Before changing this, inspect how the existing Offer detail frontend calls conversion. Do not break the current `offersApi.convertOfferToOrder` flow. The goal is to eliminate the alternative Orders-side conversion path, not to move canonical conversion out of `offerService`.

### 5.4 Order Controller

**File:** `server/src/controllers/oms/Order.controller.js`

Add/replace methods:
```
list()          → orderService.listOrders()
getById()       → orderService.getOrderById()
create()        → orderService.createOrder()
update()        → orderService.updateOrder()
remove()        → orderService.deleteOrder()
saveItems()     → orderService.updateOrderItems()
confirm()       → orderService.changeOrderStatus(id, 'confirmed')
cancel()        → orderService.changeOrderStatus(id, 'cancelled')
complete()      → orderService.changeOrderStatus(id, 'completed')
duplicate()     → orderService.duplicateOrder()
meta()          → orderService.getOrderMeta()
```

Each method wraps its service call in `asyncHandler()`.

### 5.5 Order Router

**File:** `server/src/routes/oms/orderRouter.js`

```
GET    /meta                         → OrderController.meta
GET    /                             → OrderController.list
POST   /                             → OrderController.create
GET    /:id                          → OrderController.getById
PATCH  /:id                          → OrderController.update
DELETE /:id                          → OrderController.remove
PUT    /:id/items                    → OrderController.saveItems
POST   /:id/actions/confirm          → OrderController.confirm
POST   /:id/actions/cancel           → OrderController.cancel
POST   /:id/actions/complete         → OrderController.complete
POST   /:id/actions/duplicate        → OrderController.duplicate
```

All routes: `auth` + `companyIdGuard` + `requireMember` middleware.
Permissions: `order:read`, `order:create`, `order:update`, `order:delete`.

**Future endpoints (not in this iteration):**
- `POST /:id/actions/reserve` — trigger warehouse reservation
- `POST /:id/actions/fulfill` — mark as fulfilled
- `POST /:id/invoices` — link or create invoice
- `POST /:id/warehouse-docs` — link or create warehouse doc

### 5.6 Validation (Schemas)

Create `server/src/validators/orderSchema.js` (mirror of offerSchema pattern):

- **List query schema:** page, limit, sort, dir, search, status, paymentStatus, fulfillmentStatus, ownerId, customerId, placedAtFrom, placedAtTo
- **Create schema:** customerId (required), contactId, ownerId, currency, items[] (required, min 1), paymentTerms, deliveryTerms, notes, internalNotes, billingAddressSnapshot, shippingAddressSnapshot, placedAt
- **Update schema:** same as create but all fields optional
- **Items schema:** array of `{ productId?, variantId?, uomId?, nameSnapshot, qty, priceNet, taxRate, discountType?, discountValue?, isCustomLine?, notes? }`
- **Status action schemas:** confirm/cancel may accept `{ notes? }`, complete may accept `{ completedAt? }`

### 5.7 DTO / Response Shape

List item DTO (what the table needs):
```json
{
  "id": "uuid",
  "number": "ORD-2026-001",
  "status": "confirmed",
  "paymentStatus": "pending",
  "fulfillmentStatus": "unfulfilled",
  "placedAt": "2026-04-27",
  "totalGross": 12345.00,
  "currency": "PLN",
  "customer": { "id": "uuid", "shortName": "ACME sp. z o.o." },
  "owner": { "id": "uuid", "firstName": "Jan", "lastName": "Kowalski" },
  "sourceOffer": { "id": "uuid", "number": "OFF-2026-042" },
  "itemsCount": 5,
  "createdAt": "2026-04-27T..."
}
```

Detail DTO adds: `items[]`, `contact`, `notes`, `internalNotes`, address snapshots, `paymentTerms`, `deliveryTerms`, `invoices[]` (id+number+status), `payments[]` (id+amount+status).

### 5.8 Numbering

Use the same document numbering service as Offers:
- Get format from `companyOrderSettings.numberingFormat`
- Retry on uniqueness collision (same pattern as `offerService`)
- Number is set at creation time and never changes

### 5.9 companyId Scoping

Every query in orderService must include `where: { companyId: userContext.companyId }`. Never return records from other companies. This is already enforced by `companyIdGuard` middleware but the service must double-enforce it at the DB layer.

### 5.10 Transactions

Use Sequelize transactions for:
- `createOrder` (Order + OrderItems)
- `updateOrderItems` (delete-and-recreate items)
- `changeOrderStatus` (status + timestamp + event)
- `duplicateOrder` (Order + OrderItems)

Pattern: `const t = await sequelize.transaction(); try { ... await t.commit(); } catch (e) { await t.rollback(); throw e; }`

### 5.11 Audit / Events

Log to `OrderEvent` (model already exists) for:
- `order.created`
- `order.updated`
- `order.items_updated`
- `order.status_changed` with `{ from, to }` payload
- `order.converted_from_offer` (logged at conversion time by offerService, not orderService)

Event shape: `{ orderId, companyId, type, payload: {}, actorId, createdAt }`

### 5.12 Permissions

Use `requireMember` with permission keys:
- `order:read` — GET endpoints
- `order:create` — POST /
- `order:update` — PATCH /:id, PUT /:id/items, status actions
- `order:delete` — DELETE /:id

If permission system is role-based (not per-resource), use the same role gates as offers.

---

## 6. Orders Frontend Architecture

### 6.1 RTK Query — `ordersApi.js`

**File:** `client/src/store/rtk/ordersApi.js`

**Queries:**
- `getOrders(args)` — list with pagination/filters; tag: `OrderList`
- `getOrderById(id)` — detail; tag: `Order` (id-specific)
- `getOrdersMeta()` — metadata; tag: `OrderMeta`

**Mutations (each invalidates relevant tags):**
- `createOrder(payload)` → invalidates `OrderList`
- `updateOrder({ id, payload })` → invalidates `Order`(id), `OrderList`
- `deleteOrder(id)` → invalidates `OrderList`
- `saveOrderItems({ id, items })` → invalidates `Order`(id)
- `confirmOrder({ id, payload? })` → invalidates `Order`(id), `OrderList`
- `cancelOrder({ id, payload? })` → invalidates `Order`(id), `OrderList`
- `completeOrder({ id, payload? })` → invalidates `Order`(id), `OrderList`
- `duplicateOrder({ id })` → invalidates `OrderList`

**Tags:** `'Order'` (with id), `'OrderList'` (LIST sentinel), `'OrderMeta'`

**Note:** `offersApi.convertOfferToOrder` already invalidates `{ type: 'Order', id: res.order.id }` — this will work once ordersApi defines the `Order` tag.

Add `'orders'` entry to the ListPage registry in `client/src/components/data/ListPage/index.js`:
```javascript
orders: {
  useQuery: useGetOrdersQuery,
  adapt: (data) => ({
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? 1),
    limit: Number(data?.limit ?? 25),
  }),
}
```

### 6.2 Routes

**File:** `client/src/App.js`

Add alongside existing oms routes:
```jsx
<Route path="oms/orders" element={<OrdersListPage />} />
<Route path="oms/orders/new" element={<OrderCreatePage />} />
<Route path="oms/orders/:id" element={<OrderDetailPage />} />
```

### 6.3 Menu

**File:** `client/src/config/menu.js`

The `orders` menu entry already exists and points to `/main/oms/orders`. No change needed — it will work once the route is registered.

### 6.4 OrdersListPage

**File:** `client/src/pages/oms/orders/OrdersListPage.jsx`

**Pattern:** Follow the system standard — no summary strip, no bespoke page header section. Use ListPage with a custom `ToolbarComponent` for filters.

**Structure:**
```jsx
export default function OrdersListPage() {
  const [query, setQuery] = useState(BASE_QUERY);
  const { gridPrefs } = useGridPrefs('oms.orders');

  return (
    <ListPage
      source="orders"
      externalData={orders}
      externalMeta={listMeta}
      externalLoading={isFetching}
      columns={columns}
      actions={<AddButton onClick={() => navigate('/main/oms/orders/new')}>Создать заказ</AddButton>}
      ToolbarComponent={(props) => <OrdersFiltersToolbar {...props} />}
      rowActions={rowActions}
      emptyStateText="Нет заказов"
      ...gridPrefs
    />
  );
}
```

**Table columns for orders list:**
- `number` — order number, clickable link to detail
- `status` — status badge
- `paymentStatus` — payment status badge
- `fulfillmentStatus` — fulfillment status badge
- `customer.shortName` — customer name
- `owner` — first+last name of owner
- `totalGross` — formatted with currency
- `placedAt` — formatted date
- `sourceOffer.number` — linked offer number (optional column, off by default)
- `itemsCount`
- Row actions: Open, Duplicate, Cancel (if cancellable)

**Column schema file:** `client/src/components/data/ListPage/columnSchemas/ordersColumns.js`

**Filters (OrdersFiltersToolbar):**
- `search` — text, debounced 350ms (searches number, customer name)
- `status` — select (all statuses)
- `paymentStatus` — select
- `fulfillmentStatus` — select
- `ownerId` — select from users
- `customerId` — select from counterparties
- Advanced panel: `placedAtFrom`, `placedAtTo`
- Active filter chips
- Reset all button

### 6.5 OrderDetailPage

**File:** `client/src/pages/oms/orders/OrderDetailPage.jsx`

**Pattern:** Prefer `EntityDetailsPage` only if the existing component supports the required header/actions/tabs layout without invented props. If it does not fit safely, use a custom layout that visually matches the shared detail-page conventions. Do not create a separate visual style.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header bar: Order number | Status badges | Action buttons│
├──────────────────────┬──────────────────────────────────┤
│ Left pane            │ Right pane: Tabs                 │
│ - Customer info      │ Overview | Items | Fulfillment   │
│ - Key dates          │ Invoices | Payments | Activity   │
│ - Totals summary     │                                  │
│ - Source offer link  │                                  │
└──────────────────────┴──────────────────────────────────┘
```

**Required tabs for this iteration:**
- `overview` — address snapshots, payment terms, delivery terms, notes, internal notes
- `items` — items table, editable only in draft/new status
- `related` — source offer link and safe linked summaries

**Placeholder/read-only tabs only if existing models/services are safe to include:**
- `fulfillment` — per-item qty tracking display: ordered / reserved / fulfilled
- `invoices` — linked invoices summary only; do not implement invoice creation logic here
- `payments` — linked payments summary only; do not implement payment processing here
- `activity` — OrderEvents log if the event model already works

**Action buttons (status-gated):**
- `draft` → "Submit" (→ new), "Cancel"
- `new` → "Confirm", "Cancel"
- `confirmed` → "Complete", "Cancel"
- `completed` → "Return" (→ returned)
- `cancelled` / `returned` → no actions
- Always available when allowed by status/permissions: "Duplicate", "Edit header"

**Convert from Offer:** If `sourceOfferId` is set, show a "Source: OFF-2026-042" link in the left pane. No action needed — the conversion already happened.

### 6.6 OrderCreatePage

**File:** `client/src/pages/oms/orders/OrderCreatePage.jsx`

Simple form page, preferably using the same form controls/layout conventions as Offers:
- Customer select (required)
- Contact select (optional, filtered by customer)
- Owner select (optional)
- Currency select
- Placed at date
- Notes (optional)
- Minimal item editor or immediate redirect to detail for item editing, depending on existing UX pattern
- Submit → `createOrder()` → navigate to detail

**Note:** Orders are more often created via Offer conversion than directly. The create page is for the direct creation path (rare but needed).

### 6.7 i18n

Add keys to all four locale files (`en.json`, `pl.json`, `ru.json`, `ua.json`):
```json
{
  "menu.orders": "Orders",
  "orders.status.draft": "Draft",
  "orders.status.new": "New",
  "orders.status.confirmed": "Confirmed",
  "orders.status.completed": "Completed",
  "orders.status.cancelled": "Cancelled",
  "orders.status.returned": "Returned",
  "orders.paymentStatus.pending": "Pending",
  "orders.paymentStatus.paid": "Paid",
  "orders.fulfillmentStatus.unfulfilled": "Unfulfilled",
  "orders.fulfillmentStatus.partial": "Partial",
  "orders.fulfillmentStatus.fulfilled": "Fulfilled",
  "orders.actions.create": "Create Order",
  "orders.actions.confirm": "Confirm",
  "orders.actions.cancel": "Cancel",
  "orders.actions.complete": "Complete"
}
```

### 6.8 Loading / Error / Empty States

Use system patterns (same as counterparties, deals):
- Loading: skeleton rows in table (ListPage handles this via `externalLoading`)
- Error: system error banner (ListPage handles this via `externalError`)
- Empty (no filters): "No orders yet" + Create button
- Empty (with filters): "No results" + Reset filters button
- Detail loading: skeleton layout matching left-pane + tabs structure
- Detail 404: "Order not found" with back link

Do not create bespoke error/loading/empty components — use what ListPage provides or what other detail pages use.

---

## 7. Module Boundaries

### 7.1 Orders ↔ Invoices

- Orders **stores** `invoiceStatus` (aggregate: not_invoiced / partially_invoiced / fully_invoiced)
- Orders **links** to invoices via `hasMany(Invoice)` — only stores the FK, not invoice logic
- "Create invoice from order" button lives on OrderDetailPage but **calls the Invoices module API**, not an Orders endpoint
- Orders endpoint `POST /:id/invoices` (future) may be a convenience wrapper, but actual invoice creation logic stays in the Invoices service
- `qtyInvoiced` on OrderItem is updated by the Invoices service when an invoice is confirmed, via an event or direct update — not by the Orders service

### 7.2 Orders ↔ Warehouse Documents

- Orders **links** to warehouse docs — only stores FK references
- "Create warehouse doc from order" button lives on OrderDetailPage but calls the WMS module API
- `qtyReserved` and `qtyFulfilled` on OrderItem are updated by the WMS service when reservations/shipments complete
- Orders service does not know the internal logic of reservations

### 7.3 Orders ↔ Payments

- Orders stores `paymentStatus` (aggregate)
- Orders links to payments via `hasMany(Payment)`
- Payment recording logic stays in its own service (if it exists) or is a simple Payment model write
- Orders service updates `paymentStatus` based on payment totals vs `totalGross`

### 7.4 Offers ↔ Orders

- Offer knows about conversion: `convertedOrderId`, `convertedAt/By`
- Order knows its source: `offerId`, `sourceOfferId`, `sourceType`
- Offer does NOT know about invoice/warehouse/payment status of the resulting order
- The `convertOfferToOrder` function lives in **offerService** (it transitions the Offer) — this must not move

### 7.5 What Orders Does Not Own

- Invoice business logic (tax calculation, accounting entries)
- Warehouse reservation logic (bin locations, stock levels)
- Shipment tracking details (carrier, tracking numbers)
- Payment processing (gateway, settlement)

Orders is the **coordination layer** — it holds the commitment and tracks aggregate statuses, but delegates all operational logic to the respective modules.

---

## 8. Implementation Plan for Codex

### Global implementation constraints
- Before coding, inspect the real APIs of `ListPage`, `EntityDetailsPage`, DataTable/grid prefs, shared buttons, modals, tabs, and empty/error components.
- Do not invent props for shared components.
- Do not implement analytics, dashboards, reports, template editor, PDF generation, invoice internals, warehouse internals, payment processing, or document builder work.
- Invoice/warehouse/payment tabs must be read-only linked summaries or placeholders unless their dedicated modules already provide safe APIs.
- Keep `offerService.convertOfferToOrder()` as the canonical conversion path.
- Keep changes incremental and verify build after each major phase.

### Phase A — Mount the router and fix the broken Orders entry point

**Objective:** Make `/api/orders` respond with real data.

**Files to look at:**
- `server/src/routes/rootRouter.js` — see how `/offers` is mounted
- `server/src/routes/oms/orderRouter.js` — understand existing endpoints
- `server/src/services/oms/orderService.js` — understand current list/get

**Files to change:**
- `server/src/routes/rootRouter.js` — add `router.use("/orders", auth, companyIdGuard, requireMember, ordersRouter)`

**Files to create:**
- None in this phase

**Verification:**
- `GET /api/orders` returns 200 with `{ items: [], total: 0, ... }` (even if empty)
- `GET /api/orders/:nonexistentId` returns 404
- `POST /api/orders` with valid payload returns 201

---

### Phase B — Expand OrderService to full CRUD + status machine

**Objective:** All order endpoints work correctly with proper validation, scoping, and audit.

**Files to look at:**
- `server/src/services/oms/offerService.js` — reference implementation for patterns (listing, getById DTO, createWithItems, status machine, numbering)
- `server/src/services/system/documentNumberingService.js` — numbering pattern
- `server/src/models/oms/order.js` — all fields and associations
- `server/src/models/oms/orderitem.js` — item fields
- `server/src/models/oms/orderEvent.js` (if exists) — event model
- `server/src/services/oms/companyOrderSettingsService.js` — settings for numbering

**Files to change:**
- `server/src/services/oms/orderService.js` — full rewrite/expansion with all functions listed in section 5.3
- `server/src/controllers/oms/Order.controller.js` — add new controller methods
- `server/src/routes/oms/orderRouter.js` — add new routes

**Files to create:**
- `server/src/validators/orderSchema.js` — Joi/Yup validation schemas

**Verification:**
- All CRUD endpoints return correct shape
- Status transitions reject invalid moves (e.g., confirmed → new is rejected)
- companyId is always applied — cannot see other company's orders
- Items are preserved correctly after `PUT /:id/items`
- Totals recalculate correctly after item changes
- Order number is generated on creation
- Duplicate creates a new draft with new number

---

### Phase C — Create ordersApi.js and connect to ListPage registry

**Objective:** Frontend can query and mutate orders.

**Files to look at:**
- `client/src/store/rtk/offersApi.js` — mirror this structure exactly
- `client/src/components/data/ListPage/index.js` — understand registry pattern
- `client/src/store/rtk/crmApi.js` — see how the base API is set up

**Files to change:**
- `client/src/components/data/ListPage/index.js` — add `orders` to REGISTRY

**Files to create:**
- `client/src/store/rtk/ordersApi.js`

**Verification:**
- `useGetOrdersQuery({ page: 1, limit: 25 })` returns data without error
- `useCreateOrderMutation()` creates an order and invalidates the list
- `useConfirmOrderMutation()` works and invalidates the order detail

---

### Phase D — Build OrdersListPage

**Objective:** `/main/oms/orders` shows a working, standard list page.

**Files to look at:**
- `client/src/pages/oms/offers/OffersListPage.jsx` — reference structure (minus summary strip)
- `client/src/components/data/ListPage/columnSchemas/offersColumns.js` — column definition pattern
- `client/src/config/menu.js` — verify orders entry
- `client/src/App.js` — see how offers routes are defined

**Files to change:**
- `client/src/App.js` — add orders routes
- `client/src/i18n/locales/{en,pl,ru,ua}.json` — add order i18n keys

**Files to create:**
- `client/src/pages/oms/orders/OrdersListPage.jsx`
- `client/src/pages/oms/orders/OrdersFiltersToolbar.jsx`
- `client/src/components/data/ListPage/columnSchemas/ordersColumns.js`
- `client/src/pages/oms/orders/Orders.module.css` (minimal, system classes preferred)

**Verification:**
- Menu → Orders navigates to the list page
- Table shows orders with correct columns
- Pagination works
- Filters work (status, customer, owner, search)
- Row click navigates to detail (even if detail is stub)
- AddButton navigates to `/main/oms/orders/new`
- No summary cards are shown

---

### Phase E — Build OrderDetailPage

**Objective:** `/main/oms/orders/:id` shows a working detail page with standard system conventions, without implementing invoice/warehouse/payment internals.

**Files to look at:**
- `client/src/pages/oms/offers/OfferDetailPage.jsx` — layout reference
- `client/src/pages/oms/offers/OfferItemsEditor.jsx` — items editor reference
- `client/src/pages/oms/offers/offerUtils.js` — formatting utilities reference

**Files to create:**
- `client/src/pages/oms/orders/OrderDetailPage.jsx`
- `client/src/pages/oms/orders/OrderHeaderForm.jsx` (editable header fields)
- `client/src/pages/oms/orders/OrderItemsView.jsx` (read-only items table; editable if status allows)
- `client/src/pages/oms/orders/OrderRelatedTab.jsx` (source offer + linked summaries/placeholders)
- `client/src/pages/oms/orders/OrderFulfillmentTab.jsx` (optional read-only qty tracking, only if data is already safe)
- `client/src/pages/oms/orders/orderUtils.js` (status labels, formatting)

**Verification:**
- Navigate to a converted order (from offer) and see correct data
- Status badges show correctly
- Confirm action → status changes to confirmed
- Cancel action → status changes to cancelled
- Back to list preserves filter state (RTK Query cache)
- "Source Offer" link in left pane navigates to the offer detail

---

### Phase F — OrderCreatePage

**Objective:** Direct order creation without a source offer.

**Files to create:**
- `client/src/pages/oms/orders/OrderCreatePage.jsx`

**Verification:**
- Form validates required fields before submit
- On success, navigates to the new order detail
- Order appears in the list with status `draft`

---

### Phase G — Offer → Order integration check

**Objective:** Confirm the full conversion flow still works end-to-end.

**Files to look at:**
- `client/src/pages/oms/offers/OfferDetailPage.jsx` — the "Convert to Order" action
- `client/src/store/rtk/offersApi.js` — `convertOfferToOrder` mutation and its tag invalidation
- `server/src/services/oms/offerService.js` — `convertOfferToOrder` function

**Verification:**
- Create offer → send → accept → convert to order
- New order appears in `/main/oms/orders` list
- Order detail shows `sourceOffer.number`
- Offer detail shows "Converted" badge and link to the order
- Offer status is still `accepted` (not changed by conversion)
- `offer.convertedOrderId` is set

---

### Phase H — Offers list page cleanup

**Objective:** Remove summary strip and non-standard chrome from OffersListPage, keeping working filters/table behavior intact.

**Files to change:**
- `client/src/pages/oms/offers/OffersListPage.jsx` — remove OffersSummary, summaryItems, statusCounters, the summary section render
- `client/src/pages/oms/offers/Offers.module.css` — remove unused classes (offersListSummaryCard, offersListSummaryStrip, etc.)

**Verification:**
- Offers list loads without summary cards
- All filters still work
- Grid prefs (column resize/order/visibility) still work
- No visual regressions in the list table

---

## 9. Smoke Test Checklist

After full implementation, verify end-to-end:

**Offers:**
- [ ] List page loads, shows offers, pagination works
- [ ] No summary strip on list page
- [ ] Filters work (search, status, owner, counterparty, date range)
- [ ] Click row → navigate to offer detail
- [ ] Offer detail shows correct data
- [ ] Status actions work: send, accept, reject, cancel
- [ ] Duplicate creates a new draft
- [ ] Convert to Order → creates order → offer shows "converted" state

**Orders:**
- [ ] Menu → Orders navigates to list page (no 404)
- [ ] List page loads, shows orders from DB
- [ ] Create order directly (not from offer) → appears in list
- [ ] Order detail loads correct data
- [ ] Confirm action changes status to `confirmed`
- [ ] Cancel action changes status to `cancelled`
- [ ] Converted order shows source offer number with link
- [ ] Offer that was converted → order link in offer detail page
- [ ] Order number is auto-generated and unique

**Data integrity:**
- [ ] Orders from one company are not visible to another (companyId scoping)
- [ ] Deleting offer does not cascade-delete the converted order
- [ ] Soft-deleted orders do not appear in list

**Build:**
- [ ] `npm run build` in `/client` passes with no new errors

---

## 10. Risks and Open Questions

| # | Risk / Question | Recommendation |
|---|---|---|
| 1 | `Order.hasMany(Invoice)` — is the Invoice model present and complete? | Read `server/src/models/oms/invoice.js` before implementation. If stub, guard the include. |
| 2 | `Order.hasMany(Payment)` — same question for Payment model | Same — guard or skip include in DTO if model missing |
| 3 | `Order.hasMany(Shipment)` — same for Shipment | Same |
| 4 | `OrderItem.qtyReserved/qtyFulfilled/qtyInvoiced` — do these columns exist in migration? | Check `server/src/migrations/` for the order-item migration. If missing, create a new migration to add them. |
| 5 | `invoiceStatus` field on Order — does it exist in the model/migration? | Check `order.js` model. If missing, add via migration. |
| 6 | `orderService.fromOffer()` creates an order without updating `offer.convertedOrderId` — dual conversion paths | Remove `POST /orders/from-offer/:id` endpoint or proxy it through `offerService.convertOfferToOrder()`. Don't leave two paths. |
| 7 | `requireMember` permission keys for orders — are `order:read/create/update/delete` defined? | Check `server/src/middleware/requireMember.js` or the permissions config. If using role-based access, map to existing roles. |
| 8 | Document numbering service — does it support `order` document type? | Check `server/src/services/system/documentNumberingService.js`. It must support the order numbering format from `companyOrderSettings`. |
| 9 | Offers list page: `OffersEmptyState` uses hardcoded Russian strings | Replace with i18n keys when cleaning up. Not blocking. |
| 10 | EntityDetailPage scaffold for OfferDetailPage — not migrated in this task | Explicitly defer. Document as tech debt. The OfferDetailPage works correctly as-is. |
| 11 | `EntityDetailsPage` API may not fit current Offer/Order detail needs | Inspect the real component before using it. If unsafe, keep custom detail layout but match system conventions. |
| 12 | Orders frontend scope can easily expand into invoice/warehouse/payment modules | Keep those areas read-only or placeholder-only in this iteration. |
