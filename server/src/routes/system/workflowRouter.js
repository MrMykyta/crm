const workflowRouter = require('express').Router();
const ctrl = require('../../controllers/system/Workflow.controller');

workflowRouter.get('/', ctrl.list);
workflowRouter.post('/', ctrl.create);
workflowRouter.put('/:id', ctrl.update);
workflowRouter.delete('/:id', ctrl.remove);

module.exports = workflowRouter;