'use strict';

const { Router } = require('express');
const c = require('../controllers/workspaceViews.controller');

const router = Router();

router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/actions/pin', c.pin);
router.post('/:id/actions/hide', c.hide);
router.post('/:id/actions/touch', c.touch);

module.exports = router;
