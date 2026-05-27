'use strict';

const express = require('express');
const CompanyOrderSettingsController = require('../../controllers/crm/CompanyOrderSettings.controller');
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const companyOrderSettingsSchema = require('../../schemas/companyOrderSettingsSchema');

const router = express.Router();

router.get('/', requireMember, CompanyOrderSettingsController.get);
router.put(
  '/',
  requireMember,
  validateBody(companyOrderSettingsSchema.update),
  CompanyOrderSettingsController.update
);

module.exports = router;
