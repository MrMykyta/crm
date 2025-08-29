
// pickWaveRouter.js (generated)
const pickWaveRouter = require('express').Router();
const controller = require('../../controllers/wms/pickWave.controller');

pickWaveRouter.get('/', controller.list);
pickWaveRouter.get('/:id', controller.getById);
pickWaveRouter.post('/', controller.create);
pickWaveRouter.put('/:id', controller.update);
pickWaveRouter.delete('/:id', controller.remove);

module.exports = pickWaveRouter;
