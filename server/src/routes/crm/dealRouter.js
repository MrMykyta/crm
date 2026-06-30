const express = require('express');
const dealRouter = express.Router();
const DealController = require('../../controllers/crm/Deal.controller');

const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const dealSchema = require('../../schemas/dealSchema');

const authorize = require('../../middleware/authorize');

// список + фильтры
dealRouter.get('/', validateQuery(dealSchema.listQuery), authorize('deal:read'), DealController.list);
// server-aggregated board
dealRouter.get('/board', validateQuery(dealSchema.boardQuery), authorize('deal:read'), DealController.board);
// создать
dealRouter.post('/', validateBody(dealSchema.create), authorize('deal:create'), DealController.create);
// activity timeline
dealRouter.get('/:id/activities', validateQuery(dealSchema.activityListQuery), authorize('deal:read'), DealController.listActivities);
dealRouter.post('/:id/activities', validateBody(dealSchema.createActivity), authorize('deal:update'), DealController.createActivity);
dealRouter.delete('/:id/activities/:activityId', authorize('deal:update'), DealController.deleteActivity);
// явные lifecycle actions; status остаётся производным от stage
dealRouter.post('/:id/win', validateBody(dealSchema.markWon), authorize('deal:update'), DealController.markWon);
dealRouter.post('/:id/won', validateBody(dealSchema.markWon), authorize('deal:update'), DealController.markWon);
dealRouter.post('/:id/lose', validateBody(dealSchema.markLost), authorize('deal:update'), DealController.markLost);
dealRouter.post('/:id/lost', validateBody(dealSchema.markLost), authorize('deal:update'), DealController.markLost);
// получить одну
dealRouter.get('/:id', authorize('deal:read'), DealController.getById);
// обновить
dealRouter.put('/:id', validateBody(dealSchema.update), authorize('deal:update'), DealController.update);
// переместить сделку между этапами своей воронки
dealRouter.put('/:id/stage', validateBody(dealSchema.stageMove), authorize('deal:update'), DealController.moveStage);
// удалить
dealRouter.delete('/:id', authorize('deal:delete'), DealController.remove);

module.exports = dealRouter;
