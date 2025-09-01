const webhookRouter = require('express').Router();
const ctrl = require('../../controllers/system/Webhook.controller');

webhookRouter.get('/', ctrl.list);
webhookRouter.post('/', ctrl.create);
webhookRouter.put('/:id', ctrl.update);
webhookRouter.delete('/:id', ctrl.remove);

module.exports = webhookRouter;