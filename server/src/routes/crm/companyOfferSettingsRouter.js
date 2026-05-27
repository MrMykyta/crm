'use strict';

const express = require('express');
const CompanyOfferSettingsController = require('../../controllers/crm/CompanyOfferSettings.controller');
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const companyOfferSettingsSchema = require('../../schemas/companyOfferSettingsSchema');

const router = express.Router();

router.get('/', requireMember, CompanyOfferSettingsController.get);
router.put(
  '/',
  requireMember,
  validateBody(companyOfferSettingsSchema.update),
  CompanyOfferSettingsController.update
);

module.exports = router;
