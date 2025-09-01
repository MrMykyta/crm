const pipelineRouter = require('express').Router();
const ctrl = require('../../controllers/crm/pipelineController');

pipelineRouter.get('/', ctrl.list);
pipelineRouter.post('/', ctrl.create);
pipelineRouter.post('/:pipelineId/stages', ctrl.addStage);

module.exports = pipelineRouter;