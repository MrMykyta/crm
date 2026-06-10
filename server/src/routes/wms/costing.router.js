'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/costing.controller');
const acl = require('./acl');

router.get('/opening-balance/status', acl.costingManage, controller.getOpeningBalanceStatus);
router.post('/opening-balance/dry-run', acl.costingManage, controller.dryRunOpeningBalance);
router.post('/opening-balance/initialize', acl.costingManage, controller.initializeOpeningBalance);

module.exports = router;
