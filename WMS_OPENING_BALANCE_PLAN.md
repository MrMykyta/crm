# WMS G1.2c — Opening Balance Strategy (before costing wiring)

> Scope: **audit + recommendation only**. No code, no migrations.
> Date: 2026-06-02. Related: `WMS_COSTING_AUDIT.md`, `WMS_COSTING_IMPLEMENTATION_PLAN.md`, `WMS_G1_REVIEW.md`.
> Goal: decide how to handle existing `inventory_items.qty_on_hand > 0` that has no `cost_layers` row, so that wiring `consumeFifoLayers` into WZ/RW does not blanket-fail with `INSUFFICIENT_COST_LAYER`.

---

## 1. TL;DR

- **The legacy gap is universal, not edge-case.** Every `inventory_items` row in the dev DB (18/18) has `qty_on_hand > 0` and **no** `cost_layers` coverage, across 15 distinct companies. 0 cost_layers exist in the entire DB. Wiring `consumeFifoLayers` today would break WZ/RW for every existing customer.
- **No opening-balance code exists.** No seed-stock import, no costingInit flag, no purchasePrice/defaultCost field, no scaffold. `Product.cost`/`ProductVariant.cost` exist as plain catalog fields, nullable — the only available unit-cost fallbacks.
- **Stock is fully document-backed.** `qty_on_hand` is mutated only by `inventoryService.applyMove` (verified). Every existing row came from a real `stock_moves` (12 receipt + 10 ship + 12 adjustment + 2 transfer = 36 moves). The "opening" we need is for moves posted *before* cost columns were added — not for ad-hoc external imports.
- **Recommendation: hybrid (A+B) — a per-company initialization service that creates `OPENING` cost_layers from current `qty_on_hand`, gated by a `costingInitializedAt` company flag. While the flag is null, outgoing FIFO consumption is blocked with `COSTING_NOT_INITIALIZED` instead of silently corrupting data with `INSUFFICIENT_COST_LAYER`.**

---

## 2. Audit — what's in code

### 2.1. Cost-source fields available for fallback
| Source | Field | Type | Default | Note |
|---|---|---|---|---|
| `Product` | `cost` | `DECIMAL(14,2)` | **nullable** | Static catalog cost. No NOT NULL — can legitimately be null/0. |
| `Product` | `currency` | `STRING(3)` | `'PLN'` | NOT NULL. Always present. |
| `ProductVariant` | `cost` | `DECIMAL(14,2)` | **nullable** | Variant override of `Product.cost`. |
| `ProductVariant` | `currency` | `STRING(3)` | `'PLN'` | NOT NULL. |
| `ProductSupplier` | `price` | `DECIMAL(14,2)` | `0` | Per-supplier purchase price. **No `isDefault`/`isPreferred` flag** — no canonical supplier to pick from. |
| `ProductSupplier` | `currency` | `STRING(3)` | `'PLN'` | nullable in declaration. |
| `CompanyInvoiceSetting` | `invoiceDefaultCurrency` | `STRING(3)` | `'PLN'` | NOT NULL — can serve as the company-level currency fallback. |

**No `purchasePrice`, no `defaultCost`** anywhere in the codebase. The unit-cost fallback chain is realistically: `ProductVariant.cost` → `Product.cost` → `0`. `ProductSupplier.price` is unsafe to auto-pick (multiple suppliers, no preferred flag, no created-at convention).

### 2.2. Existing opening-balance / init machinery
**None.** Grep across the whole repo for `opening.?balance|initial.?balance|opening.?stock|seed.?stock|costingInit|initialize.?costing` returned zero matches. No flag, no service, no script. The only related artifact is `scripts/scaffold-wms.js` — a one-shot codegen that produced the original WMS module skeleton; it does not touch data.

### 2.3. Who mutates `inventory_items.qty_on_hand`
**Only `inventoryService.applyMove`** (verified by grep). `orderService` and `inventoryCountService` read it, never write. The demo seeder `20250813125813-demo-dataset.js` does not touch inventory. Conclusion: **all existing stock is document-backed** (every row is the result of a chain of `stock_moves`). There is no "ghost" inventory.

### 2.4. State of `cost_layers` and `stock_moves`
- `cost_layers`: G1.1 added the table; G1.2/G1.2b populate it inside `costingService`, but **no caller invokes the service yet** (`receiptService`/`shipmentService`/`adjustmentService`/`transferService`/`inventoryService` don't import it — verified earlier).
- `stock_moves`: 36 rows exist, **none have `unit_cost`/`total_cost`/`currency`/`cost_method`** filled (cost columns were added by the same G1.1 migration). So the ledger is rich in quantity but blank in value.

### 2.5. Cost provenance of existing stock
Since `qty_on_hand` is the materialized sum of `stock_moves`, in principle a "replay" reconstruction is possible: walk receipt-type moves in `received_at`/`created_at` order and seed a layer per `(warehouse, location, product, variant)` from `Product.cost` at that point. But:
- `Product.cost` is point-in-time-current, not as-of-move; replay using current cost is not actually faithful to history.
- Without a unit_cost snapshot on the original move, any synthesized "ledger replay" is just a fancy version of "use `Product.cost` today".
- **The honest position:** any pre-costing layer must be labelled as "opening" provenance, not synthesized PZ.

---

## 3. DB measurements (dev environment, today)

```text
companies                  62
warehouses                 16
inventory_items_any        18
inventory_items qty>0      18
cost_layers_any             0
stock_moves_any            36   (receipt 12, ship 10, adjustment 12, transfer 2)

items qty>0 without cost coverage   18   ← 100% of stock
distinct companies affected         15   ← ~24% of all companies
```

**Interpretation.** This is not an edge case; this is **the default state of every company that has touched the warehouse module**. In production this percentage will be **even higher** (live customers have run PZ/WZ for months). If wiring lands without an opening-balance strategy, the first WZ posting after deploy fails with `INSUFFICIENT_COST_LAYER` for every customer carrying inventory. That is a release-blocker.

---

## 4. Option A — Initialization script / service (no per-company gate)

Walk every `inventory_items` row with `qty_on_hand > 0` for a given company that has no covering `cost_layer`, create an `OPENING` cost layer per row from `Product.cost` (or fallback chain).

### 4.1. Proposed cost layer shape
```
sourceRefType      = 'OPENING'
sourceRefId        = null
sourceMoveId       = null          ← REQUIRES schema change (currently NOT NULL)
sourceAllocationId = null
warehouseId, locationId, productId, variantId, lotId, serialId = from inventory_items
qtyIn              = qty_on_hand
qtyRemaining       = qty_on_hand
unitCost           = ProductVariant.cost ?? Product.cost ?? 0
totalCost          = qtyIn * unitCost
currency           = ProductVariant.currency ?? Product.currency ?? CompanyInvoiceSetting.invoiceDefaultCurrency ?? 'PLN'
receivedAt         = inventory_items.createdAt   ← chronologically before any future PZ
```

### 4.2. Pros
- Simple, focused. One script, one run per company.
- After running, `consumeFifoLayers` "just works" against existing stock.
- Visible audit row in `cost_layers` with `sourceRefType='OPENING'` — easy to filter in reports as "non-acquisition cost".

### 4.3. Cons / Risks
- **Schema change required.** `cost_layers.source_move_id` is currently `NOT NULL` with FK → `stock_moves`. Opening layers have no source move. We'd need a migration to make `source_move_id` nullable (and the FK `ON DELETE` already works for nulls). This is a non-trivial structural change to a table that already has 2 migrations.
- **Silent fallback to 0.** If `Product.cost` is null (very common — it's nullable with no default), the opening layer gets `unitCost=0`. Every subsequent WZ/RW consumes at zero-cost → COGS is silently understated. Operationally this is worse than a hard fail: the system *seems* to work but produces inflated profit numbers, which is exactly the kind of accounting bug that becomes noticed quarters later.
- **"Initialized" state is implicit.** Caller has to remember to run the script; nothing in code enforces it. New companies created after wiring still hit `INSUFFICIENT_COST_LAYER` on their first WZ until someone remembers to run init.
- **Idempotency is per-row, not per-company.** Re-running picks up rows added since last run, but there's no clean "this company is initialized" boundary, which makes downstream guards (e.g. "block WZ until init") impossible.

---

## 5. Option B — Per-company `costingInitializedAt` flag

Add `company_warehouse_document_settings.costingInitializedAt` (or similar). While it's `NULL`, any outgoing FIFO consumption throws `COSTING_NOT_INITIALIZED (409)` instead of falling into `INSUFFICIENT_COST_LAYER`. Setting the timestamp is an explicit per-company opt-in.

### 5.1. Pros
- **Explicit, defensible.** An accountant signs off "yes, we have entered initial cost data" before any WZ posts. No silent zero-cost.
- **Clear error.** `COSTING_NOT_INITIALIZED` is a deployment / onboarding error, not a data-shape error. Frontend can render an actionable banner ("Run opening balance to enable WZ/RW cost tracking").
- **Per-company independence.** Each tenant initializes when they're ready. No blanket migration risk.

### 5.2. Cons / Risks alone
- The flag alone doesn't *create* opening layers — it only tells the engine to refuse. You still need a way to actually create them (some script or UI). Without a tool, the flag is just a fancier failure mode.
- Risk of indefinite "not initialized" state: companies set up months ago never get the flag flipped, WMS quietly fails on every WZ → user perception "WMS is broken".

---

## 6. Recommendation — **Hybrid A + B**

Adopt **both** mechanisms in one MVP step:

1. **`costingInitializedAt` flag** on `company_warehouse_document_settings` (already the home of `inventoryCostMethod` and `defaultWarehouseId`). Nullable timestamp.
2. **Initialization service** `costingOpeningBalanceService.initializeForCompany(companyId, { unitCostFallback?, currencyFallback?, dryRun? })`:
   - Locks the settings row `FOR UPDATE`.
   - Throws `COSTING_ALREADY_INITIALIZED` if `costingInitializedAt IS NOT NULL` (unless `force=true`, which would be a separate operation).
   - Iterates `inventory_items` for the company where `qty_on_hand > 0` and there is no covering `cost_layer` (matched by warehouse+location+product+variant, NULL-safe).
   - Per row, creates **one** opening `CostLayer` (see §4.1 shape) with `sourceRefType='OPENING'` and `sourceMoveId=NULL` (after the schema fix below).
   - Unit cost resolution: explicit override → `ProductVariant.cost` → `Product.cost` → `unitCostFallback` arg → **throws `OPENING_COST_MISSING`** for that row (do NOT default to 0; surface the gap). `dryRun=true` returns the per-row resolution plan without writing.
   - On success, sets `costingInitializedAt = now()`.
   - Returns a summary: `{ companies, items, layers, totalValue, currency, missingCost: [{productId,variantId,…}] }`.
3. **Engine guards** in `costingService` (before FIFO consumption is wired):
   - `assertCostingInitialized(companyId, tx)` runs alongside `assertFifoCosting`. If `costingInitializedAt IS NULL`, throws `AppError(409, 'COSTING_NOT_INITIALIZED')` with company id.
   - Applied in `consumeFifoLayers` and `transferFifoLayers` (outgoing/transfer paths). `createIncomingLayer` does **not** need the gate — PZ/PW can always create new layers from explicit cost input regardless of init state.

### 6.1. Why hybrid is the right MVP choice
- **No silent zero-cost.** B blocks WZ until init; A's fallback chain is hard-stopped at "no cost found" rather than defaulting to 0. Together they guarantee the only way you ever consume an `OPENING` layer is if a real person decided what its unit cost is.
- **Releaseable into a populated prod DB.** Deploy wiring + this gate; existing customers see `COSTING_NOT_INITIALIZED`, get a clear onboarding step. No data corruption risk during the cutover.
- **Idempotent and reversible-ish.** Re-running with `force=true` could rewrite opening layers as long as none has been consumed (no `qtyRemaining` decrement and no allocations). That gives operators an escape hatch if the first init used a wrong fallback.
- **Clean reporting.** `sourceRefType='OPENING'` lets stock-value reports separate "opening" from real acquisitions cleanly. JPK_MAG / accounting exports can flag opening provenance.
- **Compatible with G2 wiring.** Once init is done for a company, wiring `applyCostingForMove` into `inventoryService.applyMove` and `transferFifoLayers` into `transferService.executeLine` does the right thing for every flow without further special-casing.

### 6.2. Trade-offs accepted
- Single migration to land both the `costingInitializedAt` column AND make `cost_layers.source_move_id` nullable. Two related changes in one migration are acceptable because they're coupled by the same feature.
- Onboarding overhead: every company needs an explicit init step. Mitigated by an admin UI/CLI later; for MVP a backend endpoint + smoke script are enough.

---

## 7. Required migrations (proposed, NOT created in this step)

### 7.1. `cost_layers.source_move_id` — make nullable
```sql
ALTER TABLE cost_layers
  ALTER COLUMN source_move_id DROP NOT NULL;
-- FK stays as-is; current FK already allows the (currently non-existent) NULL value semantics.
-- The existing index `cost_layers_source_move_idx` (non-unique, added by G1.2b) continues to work.
```
**Down.** Re-set NOT NULL after deleting any opening rows (or skip — opening rows mean down isn't reversible; document this).

### 7.2. `company_warehouse_document_settings.costing_initialized_at`
```sql
ALTER TABLE company_warehouse_document_settings
  ADD COLUMN costing_initialized_at TIMESTAMP NULL;
```
No FK, no constraint, nullable. Trivial.

### 7.3. Optional but recommended
- Add a CHECK on `cost_layers`: `(source_move_id IS NOT NULL) OR (source_ref_type = 'OPENING')` — keeps the table from accepting `NULL source_move_id` for non-opening rows, which would be an accident.

---

## 8. Services / files that will be added or touched (proposed)

### 8.1. New
- `server/src/services/wms/costingOpeningBalanceService.js`
  - `initializeForCompany(companyId, opts, tx)` — described in §6.
  - `getInitializationStatus(companyId, tx)` — returns `{ initializedAt, totalItems, coveredItems, gapItems }` for UI/CLI status checks.
  - Helper `findUncoveredInventoryItems(companyId, tx)` used by both above.
- `server/scripts/smokeCostingOpeningBalance.js`
  - End-to-end: create company + warehouse + locations + product + PZ-like inventory via direct move, run init, verify layers, verify gate flips, verify replay idempotency, verify dry-run, verify `OPENING_COST_MISSING` when `Product.cost` is null and no fallback supplied.

### 8.2. Modified (small, focused)
- `server/src/models/wms/costlayer.js` — relax `sourceMoveId` allowNull to `true`.
- `server/src/models/crm/companywarehousedocumentsetting.js` — add `costingInitializedAt` (DATE, nullable).
- `server/src/services/wms/costingService.js` — add `assertCostingInitialized(companyId, tx)`; call it from `consumeFifoLayers` and `transferFifoLayers` (NOT from `createIncomingLayer`). Add the new error code to the module's exported set if there is one.
- `server/src/services/crm/companyWarehouseDocumentSettingsService.js` — expose `costingInitializedAt` (read-only via DTO; writes only through the new service to keep accounting-side discipline).

### 8.3. NOT touched in G1.2c
- `inventoryService` / `receiptService` / `shipmentService` / `adjustmentService` / `transferService` — wiring stays out of this step.
- Frontend — backend-only step. Admin UI for init is a follow-up.
- JPK_MAG / cost reports — separate phase.

---

## 9. Acceptance criteria (smoke goals, not implemented here)

- Fresh company with stock → `consumeFifoLayers` throws `409 COSTING_NOT_INITIALIZED`.
- `initializeForCompany` with `dryRun=true` reports planned per-row resolution and never writes.
- `initializeForCompany` (real run) creates one `OPENING` layer per uncovered `inventory_items` row, sets `costingInitializedAt`.
- After init, `consumeFifoLayers` consumes the opening layer correctly with its resolved unit cost.
- Re-running `initializeForCompany` throws `COSTING_ALREADY_INITIALIZED` (no double layers).
- A product with no `cost` and no fallback throws `OPENING_COST_MISSING` and **does not** silently create a zero-cost layer.
- `createIncomingLayer` (PZ/PW) works regardless of init state — incoming with explicit cost is always allowed.

---

## 10. Risks / open decisions for the implementation step

1. **What unit cost source should be `ProductVariant.cost` vs `Product.cost` when both exist?** Recommendation: variant first, product second. Matches catalog convention.
2. **Should opening layers be **per-location** or **per-warehouse aggregate**?** Recommendation: per-location (one layer per `inventory_items` row), matching current FIFO granularity. Future MM from opening behaves like any other transfer.
3. **`OPENING_COST_MISSING` policy.** Recommendation: hard fail and return the list of products needing cost. The accountant fixes `Product.cost` (or supplies override) and reruns. Alternative — "force=allow-zero" flag — should exist but be off by default.
4. **Currency mixing.** If a company has products in multiple currencies, the opening layers can mix currencies legitimately. Reports already need a per-currency or converted aggregation; not an opening-balance problem.
5. **What about new inventory added between wiring and init?** While `costingInitializedAt IS NULL`, all incoming `createIncomingLayer` still works (PZ/PW write cost from payload). So receiving more stock before init is fine — it just creates real (non-OPENING) layers alongside future opening ones. Init only covers the gap for rows that have qty_on_hand at the moment of running.
6. **Re-init / force mode.** Useful escape hatch but dangerous if any opening layer has been partially consumed (allocations exist). Recommendation: `force=true` allowed only when no allocation references any of the company's opening layers; otherwise refuse with `OPENING_LAYERS_ALREADY_CONSUMED`.
7. **`stock_moves` ledger replay** as an alternative source of opening cost (instead of `Product.cost`) — deferred. Not faithful to history without per-move snapshots, and adds significant complexity. Treat as a possible v2 if accountants demand "historical PZ-based opening" later.

---

## Final report — what to do next

**Chosen variant:** **Hybrid A + B.** A `costingInitializedAt` company-level flag (B) gates outgoing FIFO consumption with `COSTING_NOT_INITIALIZED`, and a dedicated `costingOpeningBalanceService.initializeForCompany` (A) is the only way to flip that flag — by walking current `inventory_items` and creating `OPENING` cost layers with explicit, non-zero unit cost.

**Migrations needed (1 file, 2-3 statements):**
1. `cost_layers.source_move_id` → drop NOT NULL.
2. `company_warehouse_document_settings.costing_initialized_at` → add nullable timestamp.
3. (Optional) CHECK constraint `(source_move_id IS NOT NULL) OR (source_ref_type='OPENING')` on `cost_layers`.

**Services to add:**
- `server/src/services/wms/costingOpeningBalanceService.js` — `initializeForCompany`, `getInitializationStatus`, helper `findUncoveredInventoryItems`.
- `server/scripts/smokeCostingOpeningBalance.js`.

**Services to modify (small, focused):**
- `costingService.js` — `assertCostingInitialized` gate on `consumeFifoLayers` + `transferFifoLayers`.
- `companywarehousedocumentsetting.js` model — add `costingInitializedAt`.
- `costlayer.js` model — `sourceMoveId` becomes nullable.
- `companyWarehouseDocumentSettingsService.js` — expose `costingInitializedAt` in DTO (read-only).

**Out of scope for this step:** any wiring of `costingService` into `inventoryService`/`receiptService`/`shipmentService`/`adjustmentService`/`transferService`, any frontend, any cost report.

> Reminder: no code, migrations, or business-logic changes were made in this step.
