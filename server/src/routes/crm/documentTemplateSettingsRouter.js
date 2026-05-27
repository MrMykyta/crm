'use strict';

const express = require('express');
const DocumentTemplateSettingsController = require('../../controllers/crm/DocumentTemplateSetting.controller');
const { requireMember } = require('../../middleware/requireMember');

const router = express.Router();

router.get('/', requireMember, DocumentTemplateSettingsController.list);
router.put('/', requireMember, DocumentTemplateSettingsController.update);

module.exports = router;
