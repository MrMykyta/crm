'use strict';

const express = require('express');
const DocumentNumberingSettingsController = require('../../controllers/crm/DocumentNumberingSetting.controller');
const { requireMember } = require('../../middleware/requireMember');

const router = express.Router();

router.get('/', requireMember, DocumentNumberingSettingsController.list);
router.put('/', requireMember, DocumentNumberingSettingsController.update);
router.put('/:documentType', requireMember, DocumentNumberingSettingsController.updateByType);
router.post('/preview', requireMember, DocumentNumberingSettingsController.preview);
router.post('/bootstrap', requireMember, DocumentNumberingSettingsController.bootstrap);
router.post('/rebuild', requireMember, DocumentNumberingSettingsController.rebuild);

module.exports = router;
