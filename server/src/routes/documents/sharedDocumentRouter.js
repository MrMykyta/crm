'use strict';

const router = require('express').Router();
const controller = require('../../controllers/documents/SharedDocument.controller');

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/revoke', controller.revoke);

module.exports = router;
