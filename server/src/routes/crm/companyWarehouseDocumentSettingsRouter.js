'use strict';

const express = require('express');
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const CompanyWarehouseDocumentSettingsController = require('../../controllers/crm/CompanyWarehouseDocumentSettings.controller');
const companyWarehouseDocumentSettingsSchema = require('../../schemas/companyWarehouseDocumentSettingsSchema');

const router = express.Router();

router.get('/', requireMember, CompanyWarehouseDocumentSettingsController.get);
router.put(
  '/',
  requireMember,
  validateBody(companyWarehouseDocumentSettingsSchema.update),
  CompanyWarehouseDocumentSettingsController.update
);

module.exports = router;
