const express = require('express');
const dealRouter = express.Router();
const DealController = require('../../controllers/crm/Deal.controller');

const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const dealSchema = require('../../schemas/dealSchema');

const authorize = require('../../middleware/authorize');

// список + фильтры
dealRouter.get('/', validateQuery(dealSchema.listQuery), authorize('deal:read'), DealController.list);
// получить одну
dealRouter.get('/:id', authorize('deal:read'), DealController.getById);
// создать
dealRouter.post('/', validateBody(dealSchema.create), authorize('deal:create'), DealController.create);
// обновить
dealRouter.put('/:id', validateBody(dealSchema.update), authorize('deal:update'), DealController.update);
// удалить
dealRouter.delete('/:id', authorize('deal:delete'), DealController.remove);

module.exports = dealRouter;
