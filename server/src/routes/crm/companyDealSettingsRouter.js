'use strict';

const express = require('express');
const DealSettingsController = require('../../controllers/crm/DealSettings.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');

const router = express.Router();

router.get('/', requireMember, authorize('company:settings:read'), DealSettingsController.get);
router.put('/', requireMember, authorize('company:settings:update'), DealSettingsController.update);

router.get('/lost-reasons', requireMember, authorize('company:settings:read'), DealSettingsController.listLostReasons);
router.post('/lost-reasons', requireMember, authorize('company:settings:update'), DealSettingsController.createLostReason);
router.put('/lost-reasons/reorder', requireMember, authorize('company:settings:update'), DealSettingsController.reorderLostReasons);
router.put('/lost-reasons/:id', requireMember, authorize('company:settings:update'), DealSettingsController.updateLostReason);
router.delete('/lost-reasons/:id', requireMember, authorize('company:settings:update'), DealSettingsController.deleteLostReason);

module.exports = router;
