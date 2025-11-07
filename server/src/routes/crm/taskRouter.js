'use strict';

const express = require('express');
const taskRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const TaskController = require('../../controllers/crm/Task.controller');

/**
 * Все ручки требуют членство компании.
 * companyId берётся из :companyId или req.companyId.
 */

// список задач (с фильтрами, пагинацией)
taskRouter.get('/:companyId', requireMember, TaskController.list);

// календарь (по дате / диапазону)
taskRouter.get('/:companyId/calendar', requireMember, TaskController.listCalendar);

// получить одну задачу
taskRouter.get('/:companyId/:id', requireMember, TaskController.getById);

// создать задачу
taskRouter.post('/:companyId', requireMember, TaskController.create);

// обновить задачу
taskRouter.put('/:companyId/:id', requireMember, TaskController.update);

// удалить (soft delete)
taskRouter.delete('/:companyId/:id', requireMember, TaskController.remove);

// восстановить задачу
taskRouter.post('/:companyId/:id/restore', requireMember, TaskController.restore);

module.exports = taskRouter;