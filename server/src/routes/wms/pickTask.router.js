
// pickTaskRouter.js (generated)
const pickTaskRouter = require('express').Router();
const controller = require('../../controllers/wms/pickTask.controller');
const acl = require('./acl');

pickTaskRouter.get('/', acl.pickingManage, controller.list);
pickTaskRouter.get('/:id', acl.pickingManage, controller.getById);
pickTaskRouter.post('/', acl.pickingManage, controller.create);
pickTaskRouter.put('/:id', acl.pickingManage, controller.update);
pickTaskRouter.delete('/:id', acl.pickingManage, controller.remove);

module.exports = pickTaskRouter;
