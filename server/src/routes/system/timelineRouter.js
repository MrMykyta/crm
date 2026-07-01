'use strict';

const router = require('express').Router();
const timelineController = require('../../controllers/system/Timeline.controller');

router.get('/', timelineController.list);

module.exports = router;
