const express = require('express');
const taskRouter = express.Router();
const TaskController = require('../../controllers/crm/Task.controller');

const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const taskSchema = require('../../schemas/taskSchema');

const authorize = require('../../middleware/authorize');

taskRouter.get('/', validateQuery(taskSchema.listQuery), authorize('task:read'), TaskController.list);
taskRouter.get('/:id', authorize('task:read'), TaskController.getById);
taskRouter.post('/', validateBody(taskSchema.create), authorize('task:create'), TaskController.create);
taskRouter.put('/:id', validateBody(taskSchema.update), authorize(null, { anyOf: ['task:update', 'task:update:dept'] }), TaskController.update);
taskRouter.delete('/:id', authorize('task:delete'), TaskController.remove);

module.exports = taskRouter;
