'use strict';

const authorize = require('../../middleware/authorize');

module.exports = {
  read: authorize('wms:read'),
  settingsUpdate: authorize('wms:settings:update'),
  warehouseManage: authorize('wms:warehouse:manage'),
  locationManage: authorize('wms:location:manage'),
  documentCreate: authorize('wms:document:create'),
  documentUpdate: authorize('wms:document:update'),
  documentPost: authorize('wms:document:post'),
  documentCorrect: authorize('wms:document:correct'),
  inventoryRead: authorize('wms:inventory:read'),
  inventoryCount: authorize('wms:inventory:count'),
  reservationManage: authorize('wms:reservation:manage'),
  pickingManage: authorize('wms:picking:manage'),
  reportsRead: authorize('wms:reports:read'),
  costingManage: authorize('wms:costing:manage'),
};
