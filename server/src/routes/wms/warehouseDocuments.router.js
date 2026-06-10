'use strict';

const { Router } = require('express');
const controller = require('../../controllers/wms/warehouseDocuments.controller');
const acl = require('./acl');

const router = Router();

// GET /api/wms/documents
router.get('/', acl.read, controller.list);

module.exports = router;
