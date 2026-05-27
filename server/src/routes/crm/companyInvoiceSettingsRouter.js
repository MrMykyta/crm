'use strict';

const express = require('express');
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const CompanyInvoiceSettingsController = require('../../controllers/crm/CompanyInvoiceSettings.controller');
const companyInvoiceSettingsSchema = require('../../schemas/companyInvoiceSettingsSchema');

const router = express.Router();

router.get('/', requireMember, CompanyInvoiceSettingsController.get);
router.put(
  '/',
  requireMember,
  validateBody(companyInvoiceSettingsSchema.update),
  CompanyInvoiceSettingsController.update
);

module.exports = router;

