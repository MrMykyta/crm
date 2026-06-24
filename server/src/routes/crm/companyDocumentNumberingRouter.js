'use strict';

const express = require('express');
const DocumentNumberingSettingsController = require('../../controllers/crm/DocumentNumberingSetting.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');

const router = express.Router();

router.get('/', requireMember, authorize('settings:read'), DocumentNumberingSettingsController.list);
router.put('/:documentType', requireMember, authorize('settings:update'), DocumentNumberingSettingsController.updateByType);
router.post('/preview', requireMember, authorize('settings:read'), DocumentNumberingSettingsController.preview);
router.post('/bootstrap', requireMember, authorize('settings:update'), DocumentNumberingSettingsController.bootstrap);
router.post('/rebuild', requireMember, authorize('settings:update'), DocumentNumberingSettingsController.rebuild);

module.exports = router;
