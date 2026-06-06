'use strict';

const { Router } = require('express');
const controller = require('../../controllers/wms/warehouseDocuments.controller');

const router = Router();

// GET /api/wms/documents
router.get('/', controller.list);

module.exports = router;
