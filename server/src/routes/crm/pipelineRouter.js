const pipelineRouter = require('express').Router();
const ctrl = require('../../controllers/crm/Pipeline.controller');
const authorize = require('../../middleware/authorize');

// DEALS-1 uses existing deal permissions: read pipelines with deal:read, manage pipeline settings with deal:update.
pipelineRouter.get('/', authorize('deal:read'), ctrl.list);
pipelineRouter.post('/', authorize('deal:update'), ctrl.create);
pipelineRouter.put('/reorder', authorize('deal:update'), ctrl.reorder);
pipelineRouter.put('/:id', authorize('deal:update'), ctrl.update);
pipelineRouter.delete('/:id', authorize('deal:update'), ctrl.remove);
pipelineRouter.post('/:pipelineId/stages', authorize('deal:update'), ctrl.addStage);
pipelineRouter.put('/:pipelineId/stages/reorder', authorize('deal:update'), ctrl.reorderStages);
pipelineRouter.put('/:pipelineId/stages/:stageId', authorize('deal:update'), ctrl.updateStage);
pipelineRouter.delete('/:pipelineId/stages/:stageId', authorize('deal:update'), ctrl.deleteStage);

module.exports = pipelineRouter;
