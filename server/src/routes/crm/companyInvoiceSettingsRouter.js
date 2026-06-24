'use strict';

const express = require('express');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const CompanyInvoiceSettingsController = require('../../controllers/crm/CompanyInvoiceSettings.controller');
const companyInvoiceSettingsSchema = require('../../schemas/companyInvoiceSettingsSchema');

const router = express.Router();

router.get('/', requireMember, authorize('company:settings:read'), CompanyInvoiceSettingsController.get);
router.put(
  '/',
  requireMember,
  authorize('company:settings:update'),
  validateBody(companyInvoiceSettingsSchema.update),
  CompanyInvoiceSettingsController.update
);

module.exports = router;
