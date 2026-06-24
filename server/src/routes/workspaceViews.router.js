'use strict';

const { Router } = require('express');
const c = require('../controllers/workspaceViews.controller');
const authorize = require('../middleware/authorize');

const router = Router();

router.get('/', authorize('workspace_view:read'), c.list);
router.post('/', authorize('workspace_view:create'), c.create);
router.patch('/:id', authorize('workspace_view:update'), c.update);
router.delete('/:id', authorize('workspace_view:delete'), c.remove);
router.post('/:id/actions/pin', authorize('workspace_view:update'), c.pin);
router.post('/:id/actions/hide', authorize('workspace_view:update'), c.hide);
router.post('/:id/actions/touch', authorize('workspace_view:update'), c.touch);

module.exports = router;
