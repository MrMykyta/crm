'use strict';

const express = require('express');
const CompanyOrderSettingsController = require('../../controllers/crm/CompanyOrderSettings.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const companyOrderSettingsSchema = require('../../schemas/companyOrderSettingsSchema');

const router = express.Router();

router.get('/', requireMember, authorize('company:settings:read'), CompanyOrderSettingsController.get);
router.put(
  '/',
  requireMember,
  authorize('company:settings:update'),
  validateBody(companyOrderSettingsSchema.update),
  CompanyOrderSettingsController.update
);

module.exports = router;
