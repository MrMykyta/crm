'use strict';

const router = require('express').Router();
const FileController = require('../../controllers/system/File.controller');

// Public files are served by publicKey (no auth)
router.get('/:publicKey', FileController.downloadPublic);

module.exports = router;
