# WMS Document Status Matrix

Scope: PZ, PZK, WZ, WZK, MM, RW, PW, and Cycle Count status/action audit.

Sources audited:
- Backend models: `server/src/models/wms/receipt.js`, `shipment.js`, `transferorder.js`, `adjustment.js`, `cyclecount.js`.
- Backend services/routes/controllers: `server/src/services/wms/*`, `server/src/routes/wms/*`, `server/src/controllers/wms/*`.
- Frontend pages/adapters: `client/src/pages/wms/WarehouseDocumentDetailPage/index.js`, `client/src/pages/wms/WmsDocumentCreatePage/index.js`, `client/src/components/documents/DocumentEngine/wmsDocumentModel.js`, `client/src/pages/wms/CycleCountDetailPage/index.js`.

## Backend Statuses Found

| Document | Statuses |
|---|---|
| PZ receipt | `draft`, `received`, `putaway`, `corrected` |
| PZK receipt correction | Same receipt model; identified by `parentDocumentId`; created as `received` |
| WZ shipment | `packing`, `shipped`, `cancelled`, `corrected` |
| WZK shipment correction | Same shipment model; identified by `parentDocumentId`; created as `shipped` |
| MM transfer | `draft`, `in_transit`, `received` |
| RW/PW adjustment | `draft`, `posted` |
| Cycle Count | `planned`, `counting`, `reconciled` |

## PZ Receipt

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `draft` | Frontend detail: no inline edit; create page supports initial edit/receive | Frontend: Receive all; backend: `receiveLine` allowed by quantity guards | No | Backend `receiveLine` does not explicitly require `draft`, but normal transition sets receipt to `received` once all lines are received. |
| `received` | No | None on detail | Yes | Backend correction guard allows `received`; frontend shows Create correction. |
| `putaway` | No | None found | Yes | Status exists and correction guard allows it; no putaway route/service transition found in audit. |
| `corrected` | No | None | No | Original PZ is set to `corrected` after PZK creation. |

## PZK Receipt Correction

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `received` | No | None | No | PZK is a receipt row with `parentDocumentId`; backend rejects correction of correction. Frontend hides Receive and Create correction. |

## WZ Shipment

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `packing` | No inline detail edit | No detail ship action currently | No | Backend `shipItem` transitions to `shipped` when all lines are shipped, but frontend detail does not expose ship action. |
| `shipped` | No | None | Yes | Backend correction guard allows only `shipped`; frontend shows Create correction. |
| `cancelled` | No | None | No | Status exists; no cancel route/service transition found in audit. |
| `corrected` | No | None | No | Original WZ is set to `corrected` after WZK creation. |

## WZK Shipment Correction

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `shipped` | No | None | No | WZK is a shipment row with `parentDocumentId`; backend rejects correction of correction. Frontend hides Create correction. |

## MM Transfer

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `draft` | Frontend detail: no inline edit; create page supports initial edit/execute | Frontend detail: Execute; backend: `executeLine` allowed by quantity guards | No | Backend model has no source/target location fields; detail Execute requires `fromLocationId` and `toLocationId` on the fetched transfer. |
| `in_transit` | No | Frontend detail: Execute; backend: `executeLine` allowed by quantity guards | No | No backend status transition to `in_transit` was found in `executeLine`; status appears externally/manual only. |
| `received` | No | None | No | Backend model uses `received`; expected rule text mentioned `completed`, but no `completed` or `cancelled` status exists for MM. |

## RW Adjustment

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `draft` | Frontend detail: no inline edit; create page supports initial edit/post | Frontend: Post; backend: `post` | No | Backend requires negative `qtyDelta` for RW lines and at least one item. |
| `posted` | No | None | No | Backend `post` is idempotent for already posted adjustments. |

## PW Adjustment

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `draft` | Frontend detail: no inline edit; create page supports initial edit/post | Frontend: Post; backend: `post` | No | Backend requires positive `qtyDelta`; PW posting requires unit cost or product/variant cost. |
| `posted` | No | None | No | Backend `post` is idempotent for already posted adjustments. |

## Cycle Count

| Status | Editable | Actions | Correction | Notes |
|---|---|---|---|---|
| `planned` | Yes for counted line entry | Add counted items; Reconcile disabled until items exist | N/A | Backend creates as `planned`; adding first items moves status to `counting`. |
| `counting` | Yes for counted line entry | Add counted items; Reconcile if items exist | N/A | Backend allows adding items until reconciled. |
| `reconciled` | No | Print/back only | N/A | Backend returns idempotent reconcile result with no new adjustments if already reconciled. |

## Frontend Rules Found

| Area | Rule |
|---|---|
| WMS detail mode switch | `DocumentEnginePage` is preview-only with `edit` and `split` disabled for receipt, shipment, transfer, adjustment. |
| PZ receive | Frontend shows Receive all only for receipt without `parentDocumentId` and `status === 'draft'`. |
| PZ correction | Frontend shows Create correction only for non-correction receipt without `correctedById` and status `received` or `putaway`. |
| WZ correction | Frontend shows Create correction only for non-correction shipment without `correctedById` and status `shipped`. |
| MM execute | Frontend shows Execute for transfer statuses `draft` and `in_transit`. |
| RW/PW post | Frontend shows Post for adjustment status `draft`. |
| Cycle Count | Frontend hides counted item editor when `reconciled`; Reconcile disabled when reconciled or no items. |

## Mismatches

| Document | Status/Area | Backend Allows/Denies | Frontend Shows/Hides | Recommended Fix |
|---|---|---|---|---|
| PZ/PZK | Receive line guard | Backend `receiveLine` now rejects correction receipts and non-draft PZ. | Frontend only shows Receive all for non-correction `draft` PZ. | Aligned. |
| PZ | `putaway` | Backend correction guard accepts `putaway`, but no putaway transition route/service was found. | Frontend can show correction for `putaway`. | Decide whether `putaway` is future state or implement/route putaway transition. |
| WZ/WZK | Ship line guard | Backend `shipItem` now rejects correction shipments and non-packing WZ. | Frontend detail exposes no ship action. | Backend is hardened; adding WZ ship action to detail remains a separate UI decision. |
| WZ | `cancelled` | Status exists, but no cancel route/service transition was found. | Frontend shows no cancel action. | Decide whether cancellation is dormant/future or add command later. |
| MM | Execute status transition | Backend `executeLine` now transitions `draft → in_transit` on first partial execution and `→ received` when all lines are fully moved. | Frontend shows Execute for `draft` and `in_transit`; hides for `received`. | Aligned. |
| MM | Execute locations | Backend command requires `fromLocationId` and `toLocationId` and now rejects missing locations with `TRANSFER_LOCATION_REQUIRED`. | Frontend disables Execute when source/target locations are missing. | Aligned at command level; DTO still may omit detail location fields. |
| MM | Expected statuses | Expected rules mention `completed`/`cancelled`. | Frontend/backend use `received` and no `cancelled`. | Align product terminology before adding new MM UI states. |
| RW/PW | Cancelled | Backend status set is only `draft`/`posted`. | Frontend has no cancelled action/status handling. | No frontend fix needed unless backend gains cancellation. |
| Cycle Count | Expected statuses | Expected rules mention `draft/open/counted`; backend uses `planned/counting/reconciled`. | Frontend uses `planned/counting/reconciled`. | Treat current frontend/backend as aligned; update naming only if product wants draft/open/counted. |
| WMS detail editability | Draft documents | Backend has create/post/receive/execute commands and generated transfer update, but no unified inline edit contract for persisted WMS details. | DocumentEngine detail is preview-only; create pages are edit mode. | Keep edit disabled/hidden until inline WMS editing is designed per document type. Business actions should remain independent from edit mode. |

## Low-Risk Frontend Fix Assessment

No new frontend fix is required solely from this audit. Current frontend correction visibility is already stricter than backend and matches expected rules:
- PZ draft: correction hidden.
- PZ received/putaway: correction visible.
- PZK/WZK: correction hidden.
- WZ shipped: correction visible.
- RW/PW draft: post visible.

The only obvious frontend risk is MM detail Execute without persisted locations. That needs a product/backend decision because hiding it would change current action visibility, while keeping it can produce a validation error if the fetched transfer lacks locations.

## DTO Enrichment

WMS detail and stock-move history DTOs now include human-readable relation summaries directly. Frontend lookup maps remain fallback only when a relation summary is missing.

| Endpoint/DTO | Missing readable relations | Current frontend fallback |
|---|---|---|
| Receipt detail | None for `warehouse`, `inboundLocation`, `items.product`, `items.variant` | Lookup maps remain fallback for legacy/missing relations |
| Receipt detail | `parentDocument`, `correctedBy` | Already included with `id`, `number`, `status` |
| Shipment detail | None for `warehouse`, `order`, `items.product`, `items.variant` | Lookup maps remain fallback for legacy/missing relations |
| Shipment detail | `parentDocument`, `correctedBy` | Already included with `id`, `number`, `status` |
| Transfer detail | None for `sourceWarehouse`, `targetWarehouse`, `items.product`, `items.variant`; `sourceLocation`/`targetLocation` are derived only when MM stock moves identify one unambiguous source and target location | Lookup maps remain fallback for legacy/missing relations |
| Adjustment detail | None for `warehouse`, `items.location`, `items.product`, `items.variant` | Lookup maps remain fallback for legacy/missing relations |
| Stock move history | None for `warehouse`, `fromLocation`, `toLocation`, `product`, `variant` | Frontend displays `refType` instead of raw `refItemId` |
| Cycle Count detail | None for `warehouse`, `items.location`, `items.product`, `items.variant` | Lookup maps remain fallback for legacy/missing relations |

Location summaries expose `name` from `Location.type` because the current schema has `code` and `type`, but no separate `name` column. Variant summaries expose `name: null` when the current `ProductVariant` schema has no name column.

## Frontend Policy Implementation

Frontend WMS detail action/editability rules are centralized in `client/src/pages/wms/wmsDocumentPolicy.js`.

Policy API:

```js
getWmsDocumentPolicy({ kind, document })
```

Returns:

```js
{
  documentType,
  isCorrection,
  isEditable,
  isReadonly,
  disabledModes,
  defaultMode,
  canReceive,
  canCreateCorrection,
  canExecute,
  canPost,
  canPrint,
  lockedReason,
}
```

Implemented decisions:
- All persisted WMS detail pages remain preview-only: `defaultMode = 'preview'`, `disabledModes = ['edit', 'split']`.
- PZ draft can receive; PZ received/putaway can create correction; PZ corrected and PZK have no business actions except print.
- WZ shipped can create correction; WZ packing/cancelled/corrected and WZK have no correction action.
- MM draft/in_transit can execute only when both source and target locations are present on the document DTO; otherwise Execute is disabled with `executionRequiresLocations`.
- RW/PW draft can post; posted documents have no post action.
- Cycle Count policy is intentionally unchanged in this task.

Remaining DTO gaps:
- MM draft details still cannot expose source/target locations before execution because `TransferOrder` has no persisted location fields.
- Transfer source/target locations are derived from stock moves only when there is exactly one source and one target location.

## Backend Guard Implementation

Backend command guards now enforce the same immutable-document rules as the frontend WMS policy.

Implemented in:
- `server/src/services/wms/receiptService.js`
- `server/src/services/wms/shipmentService.js`
- `server/src/services/wms/transferService.js`
- `server/src/services/wms/adjustmentService.js`

Guard decisions:
- PZ `receiveLine` rejects correction receipts with `CORRECTION_DOCUMENT_IMMUTABLE` and non-draft receipts with `RECEIPT_NOT_DRAFT`.
- PZ correction rejects correction-of-correction, already corrected originals, and non-`received`/`putaway` originals with `RECEIPT_NOT_CORRECTABLE`.
- WZ `shipItem` rejects correction shipments with `CORRECTION_DOCUMENT_IMMUTABLE` and non-`packing` shipments with `SHIPMENT_NOT_PACKING`.
- WZ correction rejects correction-of-correction, already corrected originals, and non-`shipped` originals with `SHIPMENT_NOT_SHIPPED`.
- MM `executeLine` rejects statuses outside `draft`/`in_transit` with `TRANSFER_NOT_EXECUTABLE`, rejects missing locations with `TRANSFER_LOCATION_REQUIRED`, transitions first execution to `in_transit`, and transitions fully moved transfers to `received`.
- RW/PW `post` keeps existing idempotent behavior for `posted`; `draft` remains the only state that creates moves, with existing RW `< 0` and PW `> 0` sign guards.

Smoke coverage:
- `server/scripts/smokeWmsCommandGuards.js` covers PZ/PZK, WZ/WZK, MM, RW, and PW command guards and status transitions.

## WMS-VERIFY-2 Final Validation

Validation scope: browser-visible WMS details, backend command guards, status transitions, refetch behavior after commands, DocumentEngine mode/action cluster, summary/relations/history sections, and UUID-only presentation.

| Document | Status | Expected | Actual | Result |
|---|---|---|---|---|
| PZ | `draft` | Preview mode; Edit/Split disabled; Print + Receive all; no correction | Browser shows Print + `Принять всё`; Edit/Split disabled; no UUID | Pass |
| PZ | `received` | Preview mode; Print + Create correction; Receive hidden | Browser shows Print + `Создать коррекцию`; Receive hidden; backend correction smoke passes | Pass |
| PZ | `putaway` | Preview mode; Print + Create correction; Receive hidden | Policy allows correction for `putaway`; backend guard allows `received`/`putaway` | Pass |
| PZ | `corrected` | Preview mode; Print only; no correction | Policy hides receive/correction when `correctedById` exists or status is `corrected` | Pass |
| PZK | `received` | Preview only; Print only; no receive/correction | Browser shows Print only; backend rejects receive/correction-of-correction | Pass |
| WZ | `packing` | Preview mode; Print only; no correction | Browser shows Print only; backend ship guard remains available at service level | Pass |
| WZ | `shipped` | Preview mode; Print + Create correction | Browser shows Print + `Создать коррекцию`; backend WZK smoke passes | Pass |
| WZ | `cancelled` | Preview mode; Print only; no correction | Policy hides correction for non-`shipped` statuses | Pass |
| WZ | `corrected` | Preview mode; Print only; no correction | Policy hides correction when `correctedById` exists or status is not `shipped` | Pass |
| WZK | `shipped` | Preview only; Print only; no correction | Browser shows Print only; backend rejects ship/correction-of-correction | Pass |
| MM | `draft` | Preview mode; Print; Execute only with source/target locations | Browser shows disabled execution reason when DTO lacks locations; backend rejects missing locations | Pass |
| MM | `in_transit` | Preview mode; Execute only with source/target locations | Policy allows Execute only when locations are present; backend transitions partial execution to `in_transit` | Pass |
| MM | `received` | Preview mode; Print only; no Execute | Browser shows Print only; backend rejects execute | Pass |
| RW | `draft` | Preview mode; Print + Post | Browser shows Print + `Провести`; backend post smoke passes | Pass |
| RW | `posted` | Preview mode; Print only; no Post | Browser shows Print only; backend posted post remains idempotent | Pass |
| PW | `draft` | Preview mode; Print + Post | Browser shows Print + `Провести`; backend post smoke passes | Pass |
| PW | `posted` | Preview mode; Print only; no Post | Browser shows Print only; backend posted post remains idempotent | Pass |
| Cycle Count | `planned` | Count entry available; Reconcile disabled until items; Print | Browser shows Print + disabled `Сверить`; no UUID | Pass |
| Cycle Count | `counting` | Count entry available; Reconcile enabled; Print | Browser shows Print + enabled `Сверить`; readable warehouse/location/product/variant | Pass |
| Cycle Count | `reconciled` | Readonly; Print; Reconcile disabled; no count entry | Browser shows Print + disabled `Сверить`; no UUID | Pass |

Fixes made during WMS-VERIFY-2:
- Cycle Count detail DTO now includes `warehouse`, `items.location`, `items.product`, and `items.variant` relation summaries.
- Cycle Count detail UI now uses WMS display helpers for warehouse/location/product/variant labels.
- Stock move history no longer renders raw `refItemId`; it displays `refType`.
- `server/scripts/smokeInventoryCount.js` fixture now initializes costing and seeds stock through PZ receive flow with product cost, matching current costing guards.

Browser command smoke:
- PZ draft `Receive all` changed visible status to `ПРИНЯТО` after refetch.
- RW draft `Post` changed visible status to `ПРОВЕДЁН` after refetch.
- PW draft `Post` changed visible status to `ПРОВЕДЁН` after refetch.
- Cycle Count `counting` `Reconcile` changed visible status to `Сверен` after refetch.

Remaining gaps:
- ~~MM draft details cannot provide executable source/target locations until the transfer DTO/model has persisted location fields~~ → **resolved in MM-EXECUTE-1** (see audit below).
- `Location` has no separate `name` column; location label uses `code — type`.

---

## MM-EXECUTE-1 — Transfer source/target location audit (2026-06-07)

**Symptom:** MM detail `Execute` disabled; backend `executeLine` rejects missing locations with `TRANSFER_LOCATION_REQUIRED`.

**Findings (pre-change):**
- **DB / model** `transfer_orders`: `id, company_id, number, from_warehouse_id, to_warehouse_id, status(draft|in_transit|received), timestamps`. **No** source/target location columns. `transfer_items`: `product_id, variant_id, lot_id, serial_id, qty, moved_qty` — **no** per-line locations.
- **Create MM** (`transferService.create` ← `transfer.controller.create` ← `POST /wms/transfers`): accepts `fromWarehouseId/toWarehouseId/items`; **does not** accept or persist any location.
- **executeLine** (`transferService.executeLine` ← `POST /wms/transfers/item/:itemId/execute`): **requires** `fromLocationId`+`toLocationId` in the payload, else `400 TRANSFER_LOCATION_REQUIRED`. Status transition: partial move → `in_transit`; all lines moved → `received`.
- **Detail DTO** (`enrichTransferDto`): **already** emits `sourceLocation/targetLocation/sourceLocationId/targetLocationId`, but only resolved from existing `stock_moves` (`resolveTransferMoveLocations`, post-execution) — for a fresh draft they are `null`.
- **Frontend policy** (`wmsDocumentPolicy.js`): `canExecute = (draft|in_transit) && sourceLocationId && targetLocationId`, else `lockedReason='executionRequiresLocations'`. Detail page already renders Execute / disabled-reason from policy.
- **Root cause:** a draft MM has no document-level locations (no column, no moves yet) ⇒ DTO ids `null` ⇒ `canExecute=false`; and even forced, `executeLine` can't be supplied locations from the detail page.
- **Secondary bug:** detail `onExecuteAll` read `base.fromLocationId/toLocationId`, but the DTO field names are `sourceLocationId/targetLocationId`.

**Decision (MVP):** persist **document-level** `sourceLocationId` / `targetLocationId` on `TransferOrder` (one source + one target per MM). No per-line locations. `executeLine` falls back to these when the payload omits locations.
