'use strict';

const router = require('express').Router();
const controller = require('../../controllers/documents/SharedDocument.controller');

router.get('/:token', controller.publicView);
router.get('/:token/download', controller.publicDownload);

module.exports = router;
