// src/routes/index.js
const rootRouter = require('express').Router();
const { auth } = require('../middleware/auth');
const { sseRouter } = require('./system/sseRouter');

// ===================SYSTEM====================== 
rootRouter.use('/acl', auth, require('./system/aclRouter')); 
rootRouter.use('/attachments', auth, require('./system/attachmentRouter'));
rootRouter.use('/invitations', require('./system/invitationsRouter'));
rootRouter.use('/system', auth, require('./system/userPreferencesRouter'));
rootRouter.use('/', sseRouter);

//======================CRM===========================
rootRouter.use('/users', auth, require('./crm/userRouter')); 
rootRouter.use('/companies', auth, require('./crm/companyRouter')); 
rootRouter.use('/members', auth, require('./crm/userCompanyRouter')); 
rootRouter.use('/auth', require('./system/authRouter')); 
rootRouter.use('/departments', auth, require('./crm/departmentRouter')); 
rootRouter.use('/counterparties', auth, require('./crm/counterpartyRouter')); 
rootRouter.use('/contact-points', auth, require('./crm/contactPointRouter')); 
rootRouter.use('/contact', auth, require('./crm/contactRouter')); 
rootRouter.use('/deals', auth, require('./crm/dealRouter')); 
rootRouter.use('/tasks', auth, require('./crm/taskRouter')); 
rootRouter.use('/notes', auth, require('./crm/noteRouter')); 

/* ============== PIM: CRUD ============== */
rootRouter.use('/products',                auth, require('./pim/product.router'));           // содержит и команды (см. ниже)
rootRouter.use('/brands',                  auth, require('./pim/brand.router'));
rootRouter.use('/categories',              auth, require('./pim/category.router'));
rootRouter.use('/uoms',                    auth, require('./pim/uom.router'));
rootRouter.use('/product-types',           auth, require('./pim/productType.router'));
rootRouter.use('/attributes',              auth, require('./pim/attribute.router'));
rootRouter.use('/attribute-options',       auth, require('./pim/attributeOption.router'));
rootRouter.use('/product-attribute-values',auth, require('./pim/productAttributeValue.router'));
rootRouter.use('/product-variants',        auth, require('./pim/productVariant.router'));
rootRouter.use('/variant-options',         auth, require('./pim/variantOption.router'));
rootRouter.use('/product-categories',      auth, require('./pim/productCategory.router'));
rootRouter.use('/product-attachments',     auth, require('./pim/productAttachment.router'));
rootRouter.use('/tags',                    auth, require('./pim/tag.router'));
rootRouter.use('/product-tags',            auth, require('./pim/productTag.router'));
rootRouter.use('/collections',             auth, require('./pim/collection.router'));
rootRouter.use('/product-collections',     auth, require('./pim/productCollection.router'));
rootRouter.use('/product-relations',       auth, require('./pim/productRelation.router'));
rootRouter.use('/product-components',      auth, require('./pim/productComponent.router'));
rootRouter.use('/channels',                auth, require('./pim/channel.router'));
rootRouter.use('/channel-listings',        auth, require('./pim/channelListing.router'));
rootRouter.use('/channel-category-maps',   auth, require('./pim/channelCategoryMap.router'));
rootRouter.use('/price-lists',             auth, require('./pim/priceList.router'));
rootRouter.use('/price-list-items',        auth, require('./pim/priceListItem.router'));
rootRouter.use('/product-localizations',   auth, require('./pim/productLocalization.router'));
rootRouter.use('/packaging-units',         auth, require('./pim/packagingUnit.router'));
rootRouter.use('/product-suppliers',       auth, require('./pim/productSupplier.router'));
rootRouter.use('/product-external-refs',   auth, require('./pim/productExternalRef.router'));
rootRouter.use('/tax-categories',          auth, require('./pim/taxCategory.router'));
rootRouter.use('/shipping-classes',        auth, require('./pim/shippingClass.router'));

/* ============== PIM: commands / extras ============== */
// те же базовые префиксы, Express объединит с CRUD
rootRouter.use('/products',        auth, require('./pim/product.router'));            // команды: publish/archive/duplicate/variant-matrix/attributes
rootRouter.use('/price-lists',     auth, require('./pim/priceList.extras.router'));   // PUT /:id/items, GET /:id/best-price
rootRouter.use('/channels',        auth, require('./pim/channel.extras.router'));     // PUT /:id/listings

/* ============== WMS: CRUD ============== */
rootRouter.use('/warehouses',        auth, require('./wms/warehouse.router'));
rootRouter.use('/locations',         auth, require('./wms/location.router'));
rootRouter.use('/lots',              auth, require('./wms/lot.router'));
rootRouter.use('/serials',           auth, require('./wms/serial.router'));
rootRouter.use('/inventory-items',   auth, require('./wms/inventoryItem.router'));
rootRouter.use('/reservations',      auth, require('./wms/reservation.router'));
rootRouter.use('/stock-moves',       auth, require('./wms/stockMove.router'));

rootRouter.use('/receipts',          auth, require('./wms/receipt.router'));
rootRouter.use('/receipt-items',     auth, require('./wms/receiptItem.router'));

rootRouter.use('/transfers',         auth, require('./wms/transferOrder.router'));
rootRouter.use('/transfer-items',    auth, require('./wms/transferItem.router'));

rootRouter.use('/pick-waves',        auth, require('./wms/pickWave.router'));
rootRouter.use('/pick-tasks',        auth, require('./wms/pickTask.router'));

rootRouter.use('/shipments',         auth, require('./wms/shipment.router'));
rootRouter.use('/shipment-items',    auth, require('./wms/shipmentItem.router'));
rootRouter.use('/parcels',           auth, require('./wms/parcel.router'));

rootRouter.use('/adjustments',       auth, require('./wms/adjustment.router'));
rootRouter.use('/adjustment-items',  auth, require('./wms/adjustmentItem.router'));

rootRouter.use('/cycle-counts',      auth, require('./wms/cycleCount.router'));
rootRouter.use('/count-items',       auth, require('./wms/countItem.router'));

/* ============== WMS: commands ============== */
// вынесенные доменные действия
rootRouter.use('/wms/inventory',     auth, require('./wms/inventory.router'));           // reserve, release, applyMove, onHand
rootRouter.use('/wms/receipts',      auth, require('./wms/receipt.commands.router'));    // receive line, close receipt
rootRouter.use('/wms/picks',         auth, require('./wms/pick.commands.router'));       // create wave, complete task
rootRouter.use('/wms/shipments',     auth, require('./wms/shipment.commands.router'));   // ship item(s), close shipment
rootRouter.use('/wms/transfers',     auth, require('./wms/transfer.commands.router'));   // execute/complete transfer
rootRouter.use('/wms/adjustments',   auth, require('./wms/adjustment.commands.router')); // +/- adjust

module.exports = rootRouter;



