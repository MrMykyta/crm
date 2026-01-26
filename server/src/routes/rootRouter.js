// src/routes/index.js
const rootRouter = require("express").Router();
const { auth } = require("../middleware/auth");
const { companyIdGuard } = require("../middleware/companyIdGuard");
const { sseRouter } = require("./system/sseRouter");

// ===================SYSTEM======================
rootRouter.use("/acl", auth, require("./system/aclRouter"));
// Unified Files API (private + public endpoints)
rootRouter.use("/files", require("./system/filesRouter"));
rootRouter.use("/public-files", require("./system/publicFilesRouter"));
rootRouter.use("/invitations", require("./system/invitationsRouter"));
rootRouter.use("/system", auth, require("./system/userPreferencesRouter"));
rootRouter.use("/notifications", auth, require("./system/notificationRouter"));
rootRouter.use('/chat', auth, require('./system/chatRouter'));
rootRouter.use("/", sseRouter);

//======================CRM===========================
rootRouter.use("/users", auth, companyIdGuard, require("./crm/userRouter"));
rootRouter.use("/companies", auth, require("./crm/companyRouter"));
rootRouter.use("/members", auth, companyIdGuard, require("./crm/userCompanyRouter"));
rootRouter.use("/auth", require("./system/authRouter"));
rootRouter.use("/departments", auth, companyIdGuard, require("./crm/departmentRouter"));
rootRouter.use("/counterparties", auth, companyIdGuard, require("./crm/counterpartyRouter"));
rootRouter.use("/contact-points", auth, companyIdGuard, require("./crm/contactPointRouter"));
rootRouter.use("/contact", auth, companyIdGuard, require("./crm/contactRouter"));
rootRouter.use("/deals", auth, companyIdGuard, require("./crm/dealRouter"));
rootRouter.use("/tasks", auth, companyIdGuard, require("./crm/taskRouter"));
rootRouter.use("/notes", auth, require("./crm/noteRouter"));

/* ============== PIM: CRUD ============== */
rootRouter.use("/products", auth, companyIdGuard, require("./pim/product.router")); // содержит и команды (см. ниже)
rootRouter.use("/brands", auth, companyIdGuard, require("./pim/brand.router"));
rootRouter.use("/categories", auth, companyIdGuard, require("./pim/category.router"));
rootRouter.use("/uoms", auth, companyIdGuard, require("./pim/uom.router"));
rootRouter.use("/product-types", auth, companyIdGuard, require("./pim/productType.router"));
rootRouter.use("/attributes", auth, companyIdGuard, require("./pim/attribute.router"));
rootRouter.use(
  "/attribute-options",
  auth,
  companyIdGuard,
  require("./pim/attributeOption.router")
);
rootRouter.use(
  "/product-attribute-values",
  auth,
  companyIdGuard,
  require("./pim/productAttributeValue.router")
);
rootRouter.use(
  "/product-variants",
  auth,
  companyIdGuard,
  require("./pim/productVariant.router")
);
rootRouter.use("/variant-options", auth, companyIdGuard, require("./pim/variantOption.router"));
rootRouter.use(
  "/product-categories",
  auth,
  companyIdGuard,
  require("./pim/productCategory.router")
);
rootRouter.use(
  "/product-attachments",
  auth,
  companyIdGuard,
  require("./pim/productAttachment.router")
);
rootRouter.use("/tags", auth, companyIdGuard, require("./pim/tag.router"));
rootRouter.use("/product-tags", auth, companyIdGuard, require("./pim/productTag.router"));
rootRouter.use("/collections", auth, companyIdGuard, require("./pim/collection.router"));
rootRouter.use(
  "/product-collections",
  auth,
  companyIdGuard,
  require("./pim/productCollection.router")
);
rootRouter.use(
  "/product-relations",
  auth,
  companyIdGuard,
  require("./pim/productRelation.router")
);
rootRouter.use(
  "/product-components",
  auth,
  companyIdGuard,
  require("./pim/productComponent.router")
);
rootRouter.use("/channels", auth, companyIdGuard, require("./pim/channel.router"));
rootRouter.use(
  "/channel-listings",
  auth,
  companyIdGuard,
  require("./pim/channelListing.router")
);
rootRouter.use(
  "/channel-category-maps",
  auth,
  companyIdGuard,
  require("./pim/channelCategoryMap.router")
);
rootRouter.use("/price-lists", auth, companyIdGuard, require("./pim/priceList.router"));
rootRouter.use(
  "/price-list-items",
  auth,
  companyIdGuard,
  require("./pim/priceListItem.router")
);
rootRouter.use(
  "/product-localizations",
  auth,
  companyIdGuard,
  require("./pim/productLocalization.router")
);
rootRouter.use("/packaging-units", auth, companyIdGuard, require("./pim/packagingUnit.router"));
rootRouter.use(
  "/product-suppliers",
  auth,
  companyIdGuard,
  require("./pim/productSupplier.router")
);
rootRouter.use(
  "/product-external-refs",
  auth,
  companyIdGuard,
  require("./pim/productExternalRef.router")
);
rootRouter.use("/tax-categories", auth, companyIdGuard, require("./pim/taxCategory.router"));
rootRouter.use(
  "/shipping-classes",
  auth,
  companyIdGuard,
  require("./pim/shippingClass.router")
);

/* ============== PIM: commands / extras ============== */
// те же базовые префиксы, Express объединит с CRUD
rootRouter.use("/products", auth, companyIdGuard, require("./pim/product.router")); // команды: publish/archive/duplicate/variant-matrix/attributes
rootRouter.use("/price-lists", auth, companyIdGuard, require("./pim/priceList.extras.router")); // PUT /:id/items, GET /:id/best-price
rootRouter.use("/channels", auth, companyIdGuard, require("./pim/channel.extras.router")); // PUT /:id/listings

/* ============== WMS: CRUD ============== */
rootRouter.use("/warehouses", auth, companyIdGuard, require("./wms/warehouse.router"));
rootRouter.use("/locations", auth, companyIdGuard, require("./wms/location.router"));
rootRouter.use("/lots", auth, companyIdGuard, require("./wms/lot.router"));
rootRouter.use("/serials", auth, companyIdGuard, require("./wms/serial.router"));
rootRouter.use("/inventory-items", auth, companyIdGuard, require("./wms/inventoryItem.router"));
rootRouter.use("/reservations", auth, companyIdGuard, require("./wms/reservation.router"));
rootRouter.use("/stock-moves", auth, companyIdGuard, require("./wms/stockMove.router"));

rootRouter.use("/receipts", auth, companyIdGuard, require("./wms/receipt.router"));
rootRouter.use("/receipt-items", auth, companyIdGuard, require("./wms/receiptItem.router"));

rootRouter.use("/transfers", auth, companyIdGuard, require("./wms/transferOrder.router"));
rootRouter.use("/transfer-items", auth, companyIdGuard, require("./wms/transferItem.router"));

rootRouter.use("/pick-waves", auth, companyIdGuard, require("./wms/pickWave.router"));
rootRouter.use("/pick-tasks", auth, companyIdGuard, require("./wms/pickTask.router"));

rootRouter.use("/shipments", auth, companyIdGuard, require("./wms/shipment.router"));
rootRouter.use("/shipment-items", auth, companyIdGuard, require("./wms/shipmentItem.router"));
rootRouter.use("/parcels", auth, companyIdGuard, require("./wms/parcel.router"));

rootRouter.use("/adjustments", auth, companyIdGuard, require("./wms/adjustment.router"));
rootRouter.use(
  "/adjustment-items",
  auth,
  companyIdGuard,
  require("./wms/adjustmentItem.router")
);

rootRouter.use("/cycle-counts", auth, companyIdGuard, require("./wms/cycleCount.router"));
rootRouter.use("/count-items", auth, companyIdGuard, require("./wms/countItem.router"));

/* ============== WMS: commands ============== */
// вынесенные доменные действия
rootRouter.use("/wms/inventory", auth, companyIdGuard, require("./wms/inventory.router")); // reserve, release, applyMove, onHand
rootRouter.use("/wms/receipts", auth, companyIdGuard, require("./wms/receipt.commands.router")); // receive line, close receipt
rootRouter.use("/wms/picks", auth, companyIdGuard, require("./wms/pick.commands.router")); // create wave, complete task
rootRouter.use(
  "/wms/shipments",
  auth,
  companyIdGuard,
  require("./wms/shipment.commands.router")
); // ship item(s), close shipment
rootRouter.use(
  "/wms/transfers",
  auth,
  companyIdGuard,
  require("./wms/transfer.commands.router")
); // execute/complete transfer
rootRouter.use(
  "/wms/adjustments",
  auth,
  companyIdGuard,
  require("./wms/adjustment.commands.router")
); // +/- adjust

module.exports = rootRouter;
