# WMS G1 Review — Costing schema + costingService

> Scope: **audit only**. No code, no migrations, no business-logic changes.
> Date: 2026-06-02. Related: `WMS_COSTING_AUDIT.md`, `WMS_COSTING_IMPLEMENTATION_PLAN.md`.
> Goal: validate G1.1 (schema) and G1.2 (`costingService`), pressure-test the MM-target-layer concern, and pick the right next step (fix schema vs. start wiring).

---

## 1. Current state of WMS (snapshot)

**Already shipped and working:**
- Documents: PZ, WZ, MM, RW, PW (create / detail / print, list).
- Stock balances + `stock_moves` ledger; `productStockCacheService` keeps `Product.stockQuantity/reservedQuantity` in sync after each move.
- Orders → Reservations → WZ (auto WZ on shipped/completed, idempotent via `refItemId` on `stock_moves`).
- Inventory count (Cycle Count → Reconcile → auto RW/PW).
- Company Settings → Modules → Warehouse/WMS (warehouses, locations, **default warehouse via `companyWarehouseDocumentSettingsService`**).

**Costing (this review):**
- G1.1 schema migrated (`20260602180935-add-wms-fifo-costing-schema.js`): cost columns on `receipt_items`, `adjustment_items`, `stock_moves`, plus new tables `cost_layers` and `stock_move_cost_allocations`, plus `company_warehouse_document_settings.inventory_cost_method`.
- G1.2 `costingService` implements `createIncomingLayer`, `consumeFifoLayers`, `transferFifoLayers`, `applyCostingForMove` (FIFO only; AVCO guarded by `COST_METHOD_NOT_IMPLEMENTED`).
- **Not wired:** `inventoryService.applyMove` / `receiptService` / `shipmentService` / `adjustmentService` / `transferService` **do not call `costingService`** yet. Verified by grep — no caller of `costingService.*` outside the service itself.

---

## 2. G1.1 — Schema review

### What's good
- Migration is **idempotent** (`addColumnIfMissing`, `hasTable`, `dropTableIfExists`) → safe replays on heterogeneous dev DBs.
- All cost columns landed on the correct tables and models (`ReceiptItem.unitCost/totalCost/currency`, `AdjustmentItem.{same}`, `StockMove.unitCost/totalCost/currency/costMethod`, `CompanyWarehouseDocumentSetting.inventoryCostMethod` default `'FIFO'`). Verified column-by-column against models.
- `stock_moves.ref_item_id` was added separately (`20260529194000-add-ref-item-id-to-stock-moves.js`) and is consumed by `inventoryService.applyMove` (`refItemId` in destructure + `StockMove.create` payload). Idempotent ledger replay works.
- `cost_layers`:
  - Precise types: `DECIMAL(14,4)` for all qty/cost, `STRING(3)` currency default `'PLN'`.
  - FKs are sane: `company_id`/`source_move_id` CASCADE, `warehouse_id`/`product_id` RESTRICT (no orphans), `location_id`/`variant_id` SET NULL.
  - Indexes cover the hot paths: `cost_layers_fifo_scope_idx` (`company, warehouse, location, product, variant, received_at`) supports FIFO order-by; `cost_layers_stock_scope_idx` supports warehouse aggregates; `cost_layers_source_ref_idx` supports source lookups.
- `stock_move_cost_allocations` has a **unique** `(stock_move_id, cost_layer_id)` index — prevents duplicate allocations on idempotent replay. Good defensive design.

### What's risky
1. **`cost_layers_source_move_uniq` UNIQUE on `source_move_id`** — central to the MM concern (§4). This unique forces exactly one layer per incoming move, which is correct for PZ/PW (1:1 incoming = 1 layer) but is **wrong for the MM target side** if you want to preserve per-source-layer provenance at the destination. The migration here has effectively pre-committed the design choice to "aggregated target layer".
2. **Missing model associations** vs. the plan. `CostLayer` only has `belongsTo StockMove (sourceMove)` + `hasMany allocations`; the plan listed also `belongsTo Company/Warehouse/Location/Product/ProductVariant`. Functionally OK (FK columns work for filtering), but eager loading via `include: 'product'` etc. won't work. Add later, not blocking.
3. **No DB-level CHECK constraints** for `qty_in >= 0`, `qty_remaining >= 0`, `qty_remaining <= qty_in`, `unit_cost >= 0`, `total_cost >= 0`. The plan §2.5 listed these as recommended. Service-layer rounding/validation covers the happy path, but raw SQL writes or future code paths could violate invariants silently. Low priority; add when valuation hardens.
4. **No `received_at` index alone** — covered by composite indexes, but a stand-alone `(company_id, product_id, variant_id, received_at)` is missing (plan listed it). Marginal benefit; current composite probably suffices.
5. `cost_layers` and `stock_move_cost_allocations` are `underscored: true` and timestamped via `defaultValue: Sequelize.NOW` rather than triggers — typical for this codebase; consistent.

### Verdict G1.1
Schema is **largely production-ready for FIFO** with one architecturally significant constraint that needs a decision before further wiring (see §4).

---

## 3. G1.2 — `costingService` review

### What's good
- **Tx-aware** throughout via `withTx(fn, transaction)` — composes cleanly with `inventoryService.applyMove` and `transferService.executeLine`.
- **Strong idempotency:**
  - `createIncomingLayer`: locks/finds existing layer by `sourceMoveId` → returns existing on replay (`created: false`).
  - `consumeFifoLayers`: checks existing `StockMoveCostAllocation` rows for the move and short-circuits — repeated calls produce no duplicate allocations and don't re-decrement `qty_remaining`.
  - `transferFifoLayers`: combines both, with an additional `findOne where sourceMoveId = inMove.id` for the target layer.
- **Locking discipline:**
  - Source layers locked `FOR UPDATE` during `findAll` in `consumeFifoLayers`.
  - Existing target layer locked before potential create.
  - `CompanyWarehouseDocumentSetting` locked in `assertFifoCosting` → serializes concurrent posts for the same company on the cost-method read (acceptable for MVP throughput; flagged as a hot row).
- **Hard guards on cost validity:** `assertIncomingCostInput` requires `unitCost >= 0` finite; `planFifoConsumption` throws `INSUFFICIENT_COST_LAYER` (409) with detailed `details` if layers don't cover quantity. Errors are operational (caught by global handler).
- **Deterministic FIFO order:** `receivedAt ASC, createdAt ASC, id ASC` — three-key tiebreaker eliminates non-determinism from same-instant rows.
- **Money rounding:** `round4` for unit/total cost (DECIMAL(14,4)); weighted-average outgoing `unitCost = totalCost / qty` keeps `Σ allocation.totalCost == move.totalCost`.
- **Currency normalization:** uppercased, default `'PLN'`.
- **AVCO guard:** `assertFifoCosting` throws `COST_METHOD_NOT_IMPLEMENTED` if `inventoryCostMethod` is anything other than `FIFO` → prevents silent-AVCO once the column is set to `'AVCO'`.

### What's risky
1. **MM target layer aggregation** — the core finding. `createTransferTargetLayer` creates **one** target `CostLayer` with `unitCost = consumption.totalCost / inMove.qty`. This is the weighted average across all consumed source layers. Detail in §4.
2. **Plan ↔ implementation drift on MM.** Plan §4.4 step 2: *"For each allocation from source layers, create a new CostLayer in target warehouse/location."* The implementation collapses to a single layer. This is the source of the user's question — the plan was right.
3. **`normalizeCostMethod` is a no-op ternary:** `CONFIGURED_COST_METHODS.has(method) ? method : method`. Always returns the uppercased value. Probably intentional ("lenient normalize"), but the variable name suggests validation. The actual rejection is in `assertFifoCosting`. Code smell; not a bug today, but easy to misread.
4. **Missing belongsTo on CostLayer/StockMoveCostAllocation** (see §2.2.2) — affects only future eager-load ergonomics.
5. **No fallback policy for legacy stock without layers.** `consumeFifoLayers` throws `INSUFFICIENT_COST_LAYER` whenever stock exists but no layer covers it. Plan §9.1 noted this; not solved in code. Until opening-balance layers are seeded (script or migration), wiring `consumeFifoLayers` into WZ/RW will hard-fail every existing-stock issue. **This is a wiring prerequisite, not a costing-service bug.**
6. **Location filter** in `buildFifoLayerWhere` is binary: includes `locationId = fromLocationId` only when `fromLocationId` is set. For WZ/RW that always carry `fromLocationId` (current behavior), it enforces strict per-location FIFO. Good. But it does not have a "fallback across locations" mode if the from-location runs dry while another location has stock — that's a stricter policy than `inventoryService` (which guards by `available` across the whole warehouse). They can disagree → quantities pass `inventoryService` but `consumeFifoLayers` throws `INSUFFICIENT_COST_LAYER`. Worth documenting; not necessarily a defect.

### Verdict G1.2
Service is **functionally correct for the happy FIFO paths it covers** (PZ/PW incoming, WZ/RW outgoing) with strong idempotency and tx discipline. The MM transfer path is the architectural weak spot (§4).

---

## 4. MM target layer concern — verdict

### Verdict: **CONFIRMED.** It is a real, non-trivial loss of FIFO audit detail at the destination warehouse, *directly enforced by the schema*. Severity is **moderate** for MVP but **structural for accounting**, so it should be resolved before wiring.

### Why it happens, end-to-end
1. `transferService.executeLine` (today) creates two stock moves via `Inventory.applyMove` — `outMove` from source warehouse/location, `inMove` into target warehouse/location. It does not call `costingService`.
2. When costing gets wired, the pair goes through `costingService.transferFifoLayers(outMove, inMove, t)`.
3. Step 1 — `consumeFifoLayers(outMove, t)` — does the right thing:
   - Locks eligible source layers `FOR UPDATE` in FIFO order.
   - Consumes them in slices: e.g. for `outMove.qty = 7` with source layers `[5 @ 20, 5 @ 15]`, it produces two `StockMoveCostAllocation` rows tied to `outMove`: `(qty=5, unitCost=20, totalCost=100)` and `(qty=2, unitCost=15, totalCost=30)`. **Outgoing audit trail is complete.**
4. Step 2 — `createTransferTargetLayer(inMove, consumption, t)` — collapses everything:
   - Creates **one** `CostLayer` for `inMove` with `qtyIn = inMove.qty = 7`, `totalCost = consumption.totalCost = 130`, `unitCost = totalCost / qty = 18.5714`.
   - Stored on `cost_layers` with `source_move_id = inMove.id`.
5. The `cost_layers_source_move_uniq` UNIQUE index on `source_move_id` **prevents** creating multiple layers for one `inMove` — i.e. the schema actively forbids the per-source-layer target representation.

### What is preserved
- **Company-level total value:** correct (130 in = 130 out). ✅
- **Source-side FIFO audit:** the `outMove`'s allocations record exactly which source layers were drawn and at what unit cost. ✅
- **Quantities at target:** correct. ✅
- **Currency on target:** correct (from `consumption.currency`). ✅
- **Idempotency of MM:** correct (uniqueness on `inMove.sourceMoveId`). ✅

### What is lost
- **Per-layer unit cost detail at the target.** The target sees a single layer at 18.5714, not two layers at 20 and 15. A subsequent WZ from the target warehouse will consume this single layer at 18.5714, which is **not pure FIFO at original cost** — it is FIFO over a pre-averaged layer. Effectively the system behaves as "FIFO at source, weighted-avg-of-source at target".
- **Chain of custody for individual cost layers.** Given a source layer (qty 5 @ 20 from PZ#A), you cannot directly query "where did its remaining stock end up after MM?". The link via `outMove` allocations exists, but the target layer is one aggregated row — no record of "this 5 came from PZ#A" survives at the destination.
- **Multi-hop MM degradation.** Transfer A→B→C compounds the averaging at each hop (avg over an avg). Per-PZ traceability vanishes after one hop and gets harder to reconstruct.
- **Reports at target warehouse.** "Stock value broken down by acquisition cost / PZ" — at the target, you'll see a single weighted-avg line per MM, not the original PZ breakdown. For pure stock-value totals it doesn't matter; for FIFO audit reports it does.

### How critical?
- **Pure quantity correctness:** zero impact.
- **Company-level inventory value:** zero impact.
- **Single-warehouse companies:** zero impact (no MM).
- **Multi-warehouse companies, occasional MM:** mild — reports lose layer granularity at target, but acceptable for many ERP buyers.
- **Multi-warehouse, frequent MM and/or multi-hop:** significant — strict FIFO accounting at target warehouse breaks; chain-of-custody disappears.
- **Polish UoR / future JPK_MAG:** debatable. UoR §34 ust. 4 mandates a chosen method; many ERPs (Comarch Optima/XL, Subiekt) treat MM as value-neutral with weighted-avg target layers and pass audits. A stricter auditor could flag deviation from "pure" per-layer FIFO across warehouses. For the Polish market positioning this product targets, "strict, defensible FIFO" is the safer bet.
- **Implementation reversibility:** once wired and data starts to accumulate, retrofitting "split target into N layers" is hard — the original source-layer slice info lives in `stock_move_cost_allocations` for the **out** move only, not anywhere on the target layer. You can derive it later (via outMove→allocations→source layers), but you cannot un-mix already-issued WZ/RW that consumed the avg target layer.

### Why the implementation diverged from the plan
The migration set `cost_layers.source_move_id` UNIQUE (`cost_layers_source_move_uniq`). The plan §2.5 hedged: *"unique source_move_id for incoming layer moves, **if one incoming move creates one layer**"*. The migration unconditionally enforces 1:1. The plan §4.4 step 2 said *"For each allocation from source layers, create a new CostLayer in target warehouse/location"* (plural) — directly incompatible with the unique. The code, being correct against the schema, collapsed to a single target layer with weighted-avg cost. So **the implementation matches the migration; the migration disagrees with the plan**.

### Schema change required?
**Yes, minimal:** drop `cost_layers_source_move_uniq` and replace it with a non-unique index on `(source_move_id)`. Service changes (`createTransferTargetLayer`) and idempotency are small follow-ups (iterate `consumption.allocations` instead of one aggregate; idempotency by "any layer exists for `sourceMoveId`" still works as a guard for replay).

### Simpler alternative (no schema change, partial coverage)
Add `StockMoveCostAllocation` rows for the **incoming** transfer move too, mirroring the source allocations. Target layer stays aggregated, but the *allocations* table preserves the source-layer breakdown for both sides. This restores the per-layer audit trail in the allocations data without touching layers' uniqueness. **Limitation:** subsequent WZ/RW at the target warehouse will still consume the aggregated target layer at avg cost — pure FIFO at target is still broken, only the report/audit trail is preserved. Acceptable if the goal is auditability but not strict re-FIFO downstream.

---

## 5. Recommendation — pick A

### Variant A — fix schema first (RECOMMENDED)
**Do this:**
1. New migration: drop `cost_layers_source_move_uniq`, replace with non-unique index on `source_move_id`.
2. `costingService.createTransferTargetLayer`: iterate `consumption.allocations`, create one target `CostLayer` per source allocation, preserving each `unitCost` and linking via `sourceMoveId = inMove.id`. Idempotency check: if **any** layer exists for `sourceMoveId`, treat as replay and return existing layers.
3. `consumeFifoLayers` is unchanged — it consumes by `(warehouse, product, variant, location)` regardless of how many layers exist, so multiple target layers at the same key naturally chain in receivedAt order.
4. Update G1 acceptance criterion 7.6 to assert *N* target layers preserving each source `unitCost`, not a single aggregate.

**Why this is the right call:**
- The bug is **structurally enforced by the schema**. Wiring PZ/WZ/RW/PW/MM now would produce data using the aggregating pattern; once it accumulates, fixing it is partial-only — you cannot un-average already-issued downstream WZ/RW.
- The fix is **small and local** (one migration, one function, one test assertion). Scope-bounded. ~1-2 hours.
- It restores the plan's intent (§4.4 step 2) and gives pure FIFO end-to-end across warehouses.
- It is the safer position for Polish accounting and a future JPK_MAG export. Strict FIFO with per-warehouse provenance is a real selling point in this market.
- Reversibility: dropping a UNIQUE → adding a non-unique INDEX is safe in Postgres on a small table (the dev DB has zero MM data yet). Down-migration just re-adds the unique (and will succeed because no duplicates exist before any MM has run with the new code).
- Side benefit: also unblocks future use cases like opening-balance import where one synthetic "source move" might represent multiple historical PZs.

### Variant B — wire costing first, fix later
**Risks:**
- Data written between now and the fix uses aggregated target layers. After the schema change, historical MM target layers stay aggregated (can't reconstruct per-source unitCost without re-walking out-move allocations and re-running). New MMs would be correct; reports across the cutover would be inconsistent.
- Strict FIFO at target is broken from day one of wiring, including for the acceptance tests in `WMS_COSTING_IMPLEMENTATION_PLAN.md` §7.6 which already validate target layer correctness as single-row.
- Saves ~1-2 hours up front but creates a permanent audit-data scar across the cutover.

### Bonus prerequisite for either path: legacy opening-balance layers
Independent of A/B: before wiring `consumeFifoLayers` into WZ/RW/MM paths, decide on **legacy stock without layers**. Any existing `inventory_items.qty_on_hand` that pre-dates costing has no `cost_layers` row, and `consumeFifoLayers` will throw `INSUFFICIENT_COST_LAYER` on first issue. Options (plan §9.1):
- Seed-script (recommended): synthesize one opening layer per `(company, warehouse, location, product, variant)` from current `qty_on_hand` using `Product.cost` (or zero with a flag) at a sentinel `receivedAt` < any future PZ. Strictly an MVP starting point.
- Alternative: gate costing-on-issue behind a per-company "costing initialized" flag; throw a clear `COSTING_NOT_INITIALIZED` error otherwise.

This is **not part of the schema fix**, but it must be solved before any wiring smoke test passes against a non-empty database.

### Final recommendation
**Variant A.** Fix the schema (drop the source-move uniqueness) and the `createTransferTargetLayer` aggregation in one small change. Then wire `applyCostingForMove` into `inventoryService.applyMove` for PZ/PW/WZ/RW and `transferFifoLayers` into `transferService.executeLine` for MM, with the opening-balance question answered in parallel.

---

> Reminder: no code, migrations, or business-logic changes were made in this review.
