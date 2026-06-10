
// pickWaveRouter.js (generated)
const pickWaveRouter = require('express').Router();
const controller = require('../../controllers/wms/pickWave.controller');
const acl = require('./acl');

pickWaveRouter.get('/', acl.pickingManage, controller.list);
pickWaveRouter.get('/:id', acl.pickingManage, controller.getById);
pickWaveRouter.post('/', acl.pickingManage, controller.create);
pickWaveRouter.put('/:id', acl.pickingManage, controller.update);
pickWaveRouter.delete('/:id', acl.pickingManage, controller.remove);

module.exports = pickWaveRouter;
