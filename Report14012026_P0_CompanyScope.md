# Report14012026_P0_CompanyScope

## 0) Правило (обязательное)
- companyId берется только из req.user.companyId.
- Запрещено брать companyId из body/query/params для бизнес-сущностей.
- Любая операция чтения/записи бизнес-данных должна иметь company scope: where: { companyId }.

## 1) Модели (Sequelize) и наличие companyId
### CRM (business + ACL)
- Company — server/src/models/crm/company.js — companyId: yes (tenant root).
- CompanyDepartment — server/src/models/crm/companydepartment.js — companyId: yes.
- Contact — server/src/models/crm/contact.js — companyId: yes.
- ContactPoint — server/src/models/crm/contactpoint.js — companyId: yes.
- Counterparty — server/src/models/crm/counterparty.js — companyId: yes.
- CrmPipeline — server/src/models/crm/crmpipeline.js — companyId: yes.
- CrmPipelineStage — server/src/models/crm/crmpipelinestage.js — companyId: yes.
- Deal — server/src/models/crm/deal.js — companyId: yes.
- Note — server/src/models/crm/note.js — companyId: yes.
- Task — server/src/models/crm/task.js — companyId: yes.
- UserCompany — server/src/models/crm/usercompany.js — companyId: yes (membership).
- UserRole — server/src/models/crm/userrole.js — companyId: yes.
- UserPermission — server/src/models/crm/userpermission.js — companyId: yes.
- Role — server/src/models/crm/role.js — companyId: yes.
- User — server/src/models/crm/user.js — companyId: no (identity, membership via UserCompany).
- Permission — server/src/models/crm/permission.js — companyId: no (global ACL catalog).
- RolePermission — server/src/models/crm/rolepermission.js — companyId: no (join Role<->Permission).
- TaskContact — server/src/models/crm/taskcontact.js — companyId: no (join Task<->Contact).
- TaskUserParticipant — server/src/models/crm/taskuserparticipant.js — companyId: no (join Task<->User).
- TaskDepartmentParticipant — server/src/models/crm/taskdepartmentparticipant.js — companyId: no (join Task<->Department).

### PIM (business)
- Attribute — server/src/models/pim/attribute.js — companyId: yes.
- AttributeOption — server/src/models/pim/attributeoption.js — companyId: yes.
- Brand — server/src/models/pim/brand.js — companyId: yes.
- Category — server/src/models/pim/category.js — companyId: yes.
- Channel — server/src/models/pim/channel.js — companyId: yes.
- ChannelCategoryMap — server/src/models/pim/channelcategorymap.js — companyId: yes.
- ChannelListing — server/src/models/pim/channellisting.js — companyId: yes.
- Collection — server/src/models/pim/collection.js — companyId: yes.
- PackagingUnit — server/src/models/pim/packagingunit.js — companyId: yes.
- PriceList — server/src/models/pim/pricelist.js — companyId: yes.
- PriceListItem — server/src/models/pim/pricelistitem.js — companyId: yes.
- Product — server/src/models/pim/product.js — companyId: yes.
- ProductAttachment — server/src/models/pim/productattachment.js — companyId: yes.
- ProductAttributeValue — server/src/models/pim/productattributevalue.js — companyId: yes.
- ProductCategory — server/src/models/pim/productcategory.js — companyId: yes.
- ProductCollection — server/src/models/pim/productcollection.js — companyId: yes.
- ProductComponent — server/src/models/pim/productcomponent.js — companyId: yes.
- ProductExternalRef — server/src/models/pim/productexternalref.js — companyId: yes.
- ProductLocalization — server/src/models/pim/productlocalization.js — companyId: yes.
- ProductRelation — server/src/models/pim/productrelation.js — companyId: yes.
- ProductSupplier — server/src/models/pim/productsupplier.js — companyId: yes.
- ProductTag — server/src/models/pim/producttag.js — companyId: yes.
- ProductType — server/src/models/pim/producttype.js — companyId: yes.
- ProductTypeAttribute — server/src/models/pim/producttypeattribute.js — companyId: yes.
- ProductVariant — server/src/models/pim/productvariant.js — companyId: yes.
- ShippingClass — server/src/models/pim/shippingclass.js — companyId: yes.
- Tag — server/src/models/pim/tag.js — companyId: yes.
- TaxCategory — server/src/models/pim/taxcategory.js — companyId: yes.
- Uom — server/src/models/pim/uom.js — companyId: yes.
- VariantOption — server/src/models/pim/variantoption.js — companyId: yes.

### WMS (business)
- Adjustment — server/src/models/wms/adjustment.js — companyId: yes.
- AdjustmentItem — server/src/models/wms/adjustmentitem.js — companyId: no (line item; relies on Adjustment.companyId).
- CountItem — server/src/models/wms/countitem.js — companyId: no (line item).
- CycleCount — server/src/models/wms/cyclecount.js — companyId: yes.
- InventoryItem — server/src/models/wms/inventoryitem.js — companyId: yes.
- Location — server/src/models/wms/location.js — companyId: yes.
- Lot — server/src/models/wms/lot.js — companyId: yes.
- Parcel — server/src/models/wms/parcel.js — companyId: no (line item).
- PickTask — server/src/models/wms/picktask.js — companyId: no (line item).
- PickWave — server/src/models/wms/pickwave.js — companyId: yes.
- Receipt — server/src/models/wms/receipt.js — companyId: yes.
- ReceiptItem — server/src/models/wms/receiptitem.js — companyId: no (line item).
- Reservation — server/src/models/wms/reservation.js — companyId: yes.
- Serial — server/src/models/wms/serial.js — companyId: yes.
- Shipment — server/src/models/wms/shipment.js — companyId: yes.
- ShipmentItem — server/src/models/wms/shipmentitem.js — companyId: no (line item).
- StockMove — server/src/models/wms/stockmove.js — companyId: yes.
- TransferOrder — server/src/models/wms/transferorder.js — companyId: yes.
- TransferItem — server/src/models/wms/transferitem.js — companyId: no (line item).
- Warehouse — server/src/models/wms/warehouse.js — companyId: yes.

### OMS (business)
- Order — server/src/models/oms/order.js — companyId: yes.
- OrderItem — server/src/models/oms/orderitem.js — companyId: yes.
- OrderNote — server/src/models/oms/ordernote.js — companyId: yes.
- OrderEvent — server/src/models/oms/orderevent.js — companyId: yes.
- Invoice — server/src/models/oms/invoice.js — companyId: yes.
- Payment — server/src/models/oms/payment.js — companyId: yes.
- Discount — server/src/models/oms/discount.js — companyId: yes.
- Promotion — server/src/models/oms/promotion.js — companyId: yes.
- Coupon — server/src/models/oms/coupon.js — companyId: yes.
- CreditNote — server/src/models/oms/creditnote.js — companyId: yes.
- Offer — server/src/models/oms/offer.js — companyId: yes.
- OfferItem — server/src/models/oms/offeritem.js — companyId: no (line item).
- Package — server/src/models/oms/package.js — companyId: yes.

### System/Auth (companyId может быть опционален)
- Invitation — server/src/models/invitation.js — companyId: yes.
- Notification — server/src/models/notifications.js — companyId: yes.
- PasswordResetToken — server/src/models/passwordresettokens.js — companyId: no (system/auth).
- Attachment — server/src/models/system/attachments.js — companyId: yes.
- RefreshToken — server/src/models/system/refreshtoken.js — companyId: no (system/auth).
- Sequence — server/src/models/system/sequence.js — companyId: yes.
- SystemEvent — server/src/models/system/systemevent.js — companyId: yes.
- SystemJob — server/src/models/system/systemjob.js — companyId: yes.
- SystemJobRun — server/src/models/system/systemjobrun.js — companyId: yes.
- SystemTrigger — server/src/models/system/systemtrigger.js — companyId: yes.
- SystemWebhook — server/src/models/system/systemwebhook.js — companyId: yes.
- SystemWebhookDelivery — server/src/models/system/systemwebhookdelivery.js — companyId: yes.
- SystemWorkflow — server/src/models/system/systemworkflow.js — companyId: yes.
- UserPreferences — server/src/models/system/userpreferences.js — companyId: no (user-scoped).

## 2) Ключевые наблюдения
- В server/src/middleware/auth.js companyId кладется в req.companyId, но не в req.user.companyId, поэтому большинство контроллеров нарушают новое правило по источнику companyId.
- Генерируемые CRUD контроллеры PIM/WMS/OMS не передают companyId в сервисы (list/getById/update/remove), а create допускают companyId из body.
- Генерируемые CRUD сервисы PIM/WMS/OMS используют findByPk и destroy по id без company scope и принимают query.companyId (небезопасный источник).
- Есть unscoped include (relations) поверх findByPk, что усиливает риск утечки.

## 3) VIOLATIONS
### Fix patterns (используются в таблицах)
- FP1: companyId = req.user.companyId; игнорировать/запрещать companyId в body/query/params.
- FP2: заменить findByPk(id) на findOne({ where: withCompany(companyId, { id }) }).
- FP3: list/search не принимает query.companyId; companyId передается явно из controller.
- FP4: update/destroy только через where: withCompany(companyId, { id }).
- FP5: для include гарантировать scope по companyId на базовой модели и, при необходимости, на include.

### 3.1 Controllers (companyId source violations)
#### CRM
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/controllers/crm/Contact.controller.js` | list, getOne, create, update, remove, restore | companyId from params/req.companyId | HIGH | FP1 |
| `server/src/controllers/crm/Task.controller.js` | list, listCalendar, getById, create, update, remove, restore | companyId from params | HIGH | FP1 |
| `server/src/controllers/crm/Counterparty.controller.js` | list, create, getOne, update, remove, convertLead | companyId from params/req.companyId | HIGH | FP1 |
| `server/src/controllers/crm/UserCompany.controller.js` | listUsers, addUser, updateUserMembership, removeUser | companyId from params | HIGH | FP1 |
| `server/src/controllers/crm/Department.controller.js` | list, create, update, remove | companyId from req.companyId (not req.user.companyId) | MED | FP1 |
| `server/src/controllers/crm/СontactPoint.controller.js` | list, create, update, remove | companyId from req.companyId (not req.user.companyId) | MED | FP1 |
| `server/src/controllers/crm/User.controller.js` | updateMe, getById, updateById | companyId from req.companyId (not req.user.companyId) | MED | FP1 |
| `server/src/controllers/crm/Company.controller.js` | get, update, delete | companyId from req.companyId (not req.user.companyId) | MED | FP1 |
| `server/src/controllers/crm/Deal.controller.js` | list, getById, create, update, remove | no company scope + companyId from body | HIGH | FP1+FP2+FP3+FP4 |

#### PIM
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/controllers/pim/channel.extras.controller.js` | setListings | companyId from body (req.user?.companyId || req.body.companyId) | HIGH | FP1 |
| `server/src/controllers/pim/priceList.extras.controller.js` | setItems, bestPrice | companyId from body/query | HIGH | FP1 |
| `server/src/controllers/pim/product.controller.js` | get, publish, archive, duplicate, variantMatrix, upsertAttrs | companyId from body (fallback) | HIGH | FP1 |
| `server/src/controllers/pim/attribute.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/attributeOption.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/brand.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/category.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/channel.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/channelCategoryMap.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/channelListing.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/collection.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/packagingUnit.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/priceList.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/priceListItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productAttachment.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productAttributeValue.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productCategory.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productCollection.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productComponent.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productExternalRef.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productLocalization.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productRelation.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productSupplier.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productTag.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productType.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/productVariant.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/shippingClass.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/tag.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/taxCategory.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/uom.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/pim/variantOption.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |

#### WMS
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/controllers/wms/adjustment.controller.js` | create | companyId from body (req.user.companyId || payload.companyId) | HIGH | FP1 |
| `server/src/controllers/wms/inventory.controller.js` | getOnHand, reserve, releaseReservation | companyId from query/body | HIGH | FP1 |
| `server/src/controllers/wms/pick.controller.js` | createWave, completeTask | companyId from body (req.user.companyId || payload/req.body.companyId) | HIGH | FP1 |
| `server/src/controllers/wms/receipt.controller.js` | create, receiveLine | companyId from body (payload.companyId / req.body.companyId) | HIGH | FP1 |
| `server/src/controllers/wms/shipment.controller.js` | create, shipItem | companyId from body (req.user.companyId || payload/req.body.companyId) | HIGH | FP1 |
| `server/src/controllers/wms/transfer.controller.js` | create, executeLine | companyId from body (req.user.companyId || payload/req.body.companyId) | HIGH | FP1 |
| `server/src/controllers/wms/adjustmentItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/countItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/cycleCount.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/inventoryItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/location.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/lot.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/parcel.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/pickTask.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/pickWave.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/receiptItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/reservation.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/serial.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/shipmentItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/stockMove.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/transferItem.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/transferOrder.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/wms/warehouse.controller.js` | list, getById, create, update, remove | no company scope + companyId from body/query | HIGH | FP1+FP2+FP3+FP4 |

#### OMS
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/controllers/oms/Order.controller.js` | list, get, create, update, remove, fromOffer | no company scope + companyId from query/body | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/oms/Offer.controller.js` | list, get, create, update, remove | no company scope + companyId from query/body | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/oms/Invoice.controller.js` | list, get, issue, cancel | no company scope + companyId from query/body | HIGH | FP1+FP2+FP3+FP4 |
| `server/src/controllers/oms/Payment.controller.js` | list, create | no company scope + companyId from query/body | HIGH | FP1+FP2+FP3+FP4 |

#### System/Auth
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/controllers/system/Notification.controller.js` | list, markOneRead, markAllRead, create | companyId from params/req.companyId | MED | FP1 |
| `server/src/controllers/system/Invitation.controller.js` | listInvitations, createInvitation | companyId from params | MED | FP1 |
| `server/src/controllers/system/Auth.controller.js` | login, loginFromCompany, refreshTokens | companyId from body (auth flow) | LOW | FP1 + membership validation already in service |
| `server/src/controllers/system/Acl.controller.js` | listRoles, getRole, createRole, updateRole, deleteRole, assign* | uses req.companyId (token) instead of req.user.companyId | MED | FP1 |
| `server/src/controllers/system/chat/Chat.controller.js` | all handlers | companyId from req.companyId | MED | FP1 |

### 3.2 Services (missing company scope in queries)
#### CRM
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/services/crm/dealService.js` | list, getById, create, update, remove | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/crm/taskService.js` | recomputeTaskStatusIfNeeded | findByPk without company scope (internal) | MED | FP2 |
| `server/src/services/crm/userService.js` | getById, updateById | findByPk without company scope; membership not enforced | HIGH | FP2+FP4 (join UserCompany by companyId) |

#### PIM
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/services/pim/attributeOptionService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/attributeService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/brandService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/categoryService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/channelCategoryMapService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/channelListingService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/channelService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/collectionService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/packagingUnitService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/priceListItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/priceListService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productAttachmentService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productAttributeValueService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productCategoryService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productCollectionService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productComponentService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productExternalRefService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productLocalizationService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productRelationService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productSupplierService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productTagService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productTypeService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/productVariantService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/shippingClassService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/tagService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/taxCategoryService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/uomService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/pim/variantOptionService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |

#### WMS
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/services/wms/adjustmentItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/countItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/cycleCountService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/inventoryItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/locationService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/lotService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/parcelService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/pickTaskService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/pickWaveService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/receiptItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/reservationService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/serialService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/shipmentItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/stockMoveService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/transferItemService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/transferOrderService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/wms/warehouseService.js` | list, getById, update, remove, create | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |

#### OMS
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/services/oms/orderService.js` | list, get, create, update, remove, fromOffer | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/oms/offerService.js` | list, get, create, update, remove | query.companyId + findByPk/destroy without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/oms/invoiceService.js` | list, get, issue, cancel | findByPk + list without company scope | HIGH | FP2+FP3+FP4 |
| `server/src/services/oms/paymentService.js` | list, create | list/create without company scope; updates Order by id only | HIGH | FP2+FP3+FP4 |

### 3.3 Services (include leak without company scope)
| File | Function/Method | Type | Risk | Fix |
| --- | --- | --- | --- | --- |
| `server/src/services/oms/orderService.js` | get (Order.findByPk include OrderItem/Discount/Invoice/Payment) | include without company scope | HIGH | FP2+FP5 |
| `server/src/services/oms/offerService.js` | get (Offer.findByPk include OfferItem/Discount) | include without company scope | HIGH | FP2+FP5 |
| `server/src/services/crm/dealService.js` | getById (Deal.findByPk include Counterparty/User/Task) | include without company scope | HIGH | FP2+FP5 |
| `server/src/services/wms/inventoryItemService.js` | list/getById (include Warehouse/Location/Product/Variant) | include without company scope | HIGH | FP2+FP5 |
| `server/src/services/wms/locationService.js` | list/getById (include Warehouse) | include without company scope | HIGH | FP2+FP5 |
| `server/src/services/wms/cycleCountService.js` | getById (findByPk include CountItem) | include without company scope | HIGH | FP2+FP5 |

## 4) Patch Plan (минимально, без кода)
- 1) Auth context: в server/src/middleware/auth.js выставить req.user.companyId = req.companyId и запретить любые иные источники (FP1). Это единая точка для всех контроллеров.
- 2) Guard middleware: добавить проверку на бизнес-роутах, которая запрещает companyId в body/query/params (или жестко игнорирует). Сразу подключить к PIM/WMS/OMS router.
- 3) Controllers first: PIM/WMS/OMS/CRM/Task/Contact/Counterparty/UserCompany переписать на companyId = req.user.companyId. Никакого req.params.companyId, req.query.companyId, req.body.companyId.
- 4) Services second: все CRUD сервисы PIM/WMS/OMS перевести на withCompany(companyId, { ... }) во всех findOne/findAll/update/destroy; полностью убрать query.companyId из buildWhere. findByPk заменить на findOne с companyId (FP2/FP4).
- 5) Include safety: для запросов с include применять companyId на базовой модели; при необходимости — добавить where: { companyId } для included моделей или required: true (FP5).
- 6) Backward compatibility: не менять контракт фронта — принимать payload как есть, но игнорировать companyId, если он прислан.

## 5) Manual Test Cases
- TC1: userA (companyA) вызывает GET /pim/category/:id, где :id принадлежит companyB -> 404/403, без данных.
- TC2: userA делает GET /oms/orders?companyId=companyB -> возвращаются только записи companyA или 403; companyId из query игнорируется.
- TC3: userA делает PUT /wms/warehouse/:id (id из companyB) -> 404/403, запись не изменяется.
- TC4: userA делает POST /crm/deals с body.companyId=companyB -> сделка создается в companyA или запрос отклоняется.
- TC5: userA делает GET /crm/tasks/:companyId/:id с подставленным companyId=companyB -> берется req.user.companyId, чужая задача не доступна.
- TC6: userA делает GET /oms/orders/:id (id из companyB) -> 404/403 и не возвращаются include (items/payments).
- TC7: userA делает DELETE /wms/receiptItem/:id (id из companyB) -> 404/403.
