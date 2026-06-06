# A5 — Product/Service line item integration status

Date: 2026-06-06

Status: **Product/Service ↔ Orders/Offers/WMS/Invoice integration MVP = COMPLETE**

Scope: final verification only. No business logic changes were made during A5.

---

## 1. Status table

| Area | Status | Evidence |
|---|---:|---|
| Tracked product reserves | ✅ passed | `smokeLineItemRuntimeSemantics.js`, `smokeOrdersReservationsWzApi.js` |
| Tracked product ships through WZ | ✅ passed | WZ created only for tracked product lines; stock reduced only for tracked product |
| Service product does not reserve/ship | ✅ passed | Service product auto-derives `lineType=service`, `affectsInventory=false` |
| Custom line does not reserve/ship | ✅ passed | Custom line uses `lineType=custom`, `affectsInventory=false` |
| Non-stock product does not reserve/ship | ✅ passed | Non-stock product creates no reservations and no WZ |
| InvoiceItem contains all line types | ✅ passed | Invoice materializes tracked product, service, custom, and non-stock lines |
| InvoiceItem snapshot stability | ✅ passed | InvoiceItem survives OrderItem mutation and product catalog mutation/archive |
| Offer → Order semantics | ✅ passed | `lineType`, `affectsInventory`, `isStockTrackedSnapshot` copied |
| Order editor UI semantics | ✅ passed by code/build | Product picker badges, line type display, `Affects stock`, semantic payload |
| Offer editor UI semantics | ✅ passed by code/build | Same implementation path as Order editor |
| WMS regressions | ✅ passed | Orders/WZ, returns/WZK, corrections, warehouse documents, costing smokes green |

---

## 2. Backend verification

Command:

```bash
docker compose exec backend node scripts/smokeLineItemRuntimeSemantics.js
```

Result:

```text
SUMMARY: 17/17 checks passed
```

Coverage:
- tracked product line affects inventory;
- service product auto-derives `lineType=service`;
- custom line has `affectsInventory=false`;
- reservation only for tracked line;
- WZ contains only tracked product line;
- onHand is reduced only for tracked product;
- non-stock product creates no reservation/WZ;
- invoice materializes all line types;
- Offer → Order copies `lineType`, `affectsInventory`, `isStockTrackedSnapshot`;
- InvoiceItem snapshot survives OrderItem mutation;
- InvoiceItem snapshot survives product mutation/archive.

---

## 3. Frontend verification

Verified by code audit and successful production builds.

| Requirement | File | Status |
|---|---|---:|
| Product picker shows `Stock`, `Service`, `Non-stock` badges | `client/src/components/oms/OmsProductPicker.jsx` | ✅ |
| Product picker shows availability for tracked products | `client/src/components/oms/OmsProductPicker.jsx` | ✅ |
| Shared frontend line semantics helper | `client/src/components/oms/lineItemSemantics.js` | ✅ |
| Order editor sends `lineType`, `affectsInventory`, `isStockTrackedSnapshot` | `client/src/pages/oms/Orders/OrderEditorPage/index.js` | ✅ |
| Offer editor sends `lineType`, `affectsInventory`, `isStockTrackedSnapshot` | `client/src/pages/oms/Offers/OfferEditorPage/index.js` | ✅ |
| Custom line sends `lineType=custom`, `affectsInventory=false` | `lineItemSemantics.js` + editor payload builders | ✅ |
| `Affects stock` badge visible only for inventory lines | Order/Offer editor pages | ✅ |

Build results:

```bash
npm --prefix client run build
docker compose build frontend
```

Both passed. The local build emitted only pre-existing lint warnings outside the A4 line editor files.

---

## 4. A5 smoke and build results

| Check | Result |
|---|---:|
| `smokeLineItemRuntimeSemantics.js` | ✅ `17/17` |
| `smokeLineItemFoundation.js` | ✅ `46/46` |
| `smokeOrdersReservationsWzApi.js` | ✅ passed |
| `smokeOrderReturnedAutoWzk.js` | ✅ `18/18` |
| `smokeWmsCorrectionsPzkWzk.js` | ✅ `27/27` |
| `smokeWarehouseDocumentsList.js` | ✅ `29/29` |
| `smokeCostingWmsFlows.js` | ✅ `23/23` |
| `npm --prefix client run build` | ✅ passed with pre-existing warnings |
| `docker compose build frontend` | ✅ passed |
| `docker compose build backend` | ✅ passed |

---

## 5. Remaining gaps

These are explicitly outside the MVP:

- Invoice frontend UI is still `ComingSoon`; backend `invoice_items` and runtime invoice snapshots are ready.
- Product/Service catalog UX polish is later.
- Dedicated `services` table is deferred; MVP uses `Product.isService`.
- KSeF/e-invoice export is deferred.
- Fee/discount line editing UI is reserved by schema but not part of MVP.

---

## 6. Recommendation

Mark the integration as complete:

**Product/Service ↔ Orders/Offers/WMS/Invoice integration MVP = COMPLETE**

Next logical work should be one of the remaining non-MVP gaps, not another backend integration pass.
