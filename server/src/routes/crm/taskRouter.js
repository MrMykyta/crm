'use strict';

const express = require('express');
const taskRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const taskSchema = require('../../schemas/taskSchema');
const TaskController = require('../../controllers/crm/Task.controller');

/**
 * Все ручки требуют членство компании.
 * companyId берётся из req.user.companyId.
 */

// список задач (с фильтрами, пагинацией)
taskRouter.get(
  '/',
  requireMember,
  authorize('task:read'),
  validateQuery(taskSchema.listQuery),
  TaskController.list
);

// календарь (по дате / диапазону)
taskRouter.get(
  '/calendar',
  requireMember,
  authorize('task:read'),
  validateQuery(taskSchema.calendarQuery),
  TaskController.listCalendar
);

// получить одну задачу
taskRouter.get('/:id', requireMember, authorize('task:read'), TaskController.getById);

// создать задачу
taskRouter.post(
  '/',
  requireMember,
  authorize('task:create'),
  validateBody(taskSchema.create),
  TaskController.create
);

// обновить задачу
taskRouter.put(
  '/:id',
  requireMember,
  authorize('task:update'),
  validateBody(taskSchema.update),
  TaskController.update
);

// удалить (soft delete)
taskRouter.delete('/:id', requireMember, authorize('task:delete'), TaskController.remove);

// восстановить задачу
taskRouter.post('/:id/restore', requireMember, authorize('task:update'), TaskController.restore);

module.exports = taskRouter;
