const eventRouter = require('express').Router();
const ctrl = require('../../controllers/system/Event.controller');

eventRouter.get('/', ctrl.list);

module.exports = eventRouter;