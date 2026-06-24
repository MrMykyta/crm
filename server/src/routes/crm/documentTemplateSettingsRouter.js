'use strict';

const express = require('express');
const DocumentTemplateSettingsController = require('../../controllers/crm/DocumentTemplateSetting.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');

const router = express.Router();

router.get('/', requireMember, authorize('document:template:read'), DocumentTemplateSettingsController.list);
router.put('/', requireMember, authorize('document:template:manage'), DocumentTemplateSettingsController.update);

module.exports = router;
