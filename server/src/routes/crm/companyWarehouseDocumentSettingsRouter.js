'use strict';

const express = require('express');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const CompanyWarehouseDocumentSettingsController = require('../../controllers/crm/CompanyWarehouseDocumentSettings.controller');
const companyWarehouseDocumentSettingsSchema = require('../../schemas/companyWarehouseDocumentSettingsSchema');

const router = express.Router();

router.get('/', requireMember, authorize('company:settings:read'), CompanyWarehouseDocumentSettingsController.get);
router.put(
  '/',
  requireMember,
  authorize('company:settings:update'),
  validateBody(companyWarehouseDocumentSettingsSchema.update),
  CompanyWarehouseDocumentSettingsController.update
);

module.exports = router;
