'use strict';

const express = require('express');
const taskRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const TaskController = require('../../controllers/crm/Task.controller');

/**
 * Все ручки требуют членство компании.
 * companyId берётся из req.user.companyId.
 */

// список задач (с фильтрами, пагинацией)
taskRouter.get('/', requireMember, TaskController.list);

// календарь (по дате / диапазону)
taskRouter.get('/calendar', requireMember, TaskController.listCalendar);

// получить одну задачу
taskRouter.get('/:id', requireMember, TaskController.getById);

// создать задачу
taskRouter.post('/', requireMember, TaskController.create);

// обновить задачу
taskRouter.put('/:id', requireMember, TaskController.update);

// удалить (soft delete)
taskRouter.delete('/:id', requireMember, TaskController.remove);

// восстановить задачу
taskRouter.post('/:id/restore', requireMember, TaskController.restore);

module.exports = taskRouter;
