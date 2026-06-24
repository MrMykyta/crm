const express = require('express');
const departmentRouter = express.Router();

// временно простая проверка — только член компании может работать с отделами
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');

const departmentController = require('../../controllers/crm/Department.controller');

departmentRouter.get('/', requireMember, authorize('department:read'), departmentController.list);
departmentRouter.get('/scope-readiness/counterparties', requireMember, authorize('department:read'), departmentController.counterpartyScopeReadiness);
departmentRouter.get('/:id', requireMember, authorize('department:read'), departmentController.getById);
departmentRouter.post('/', requireMember, authorize('department:create'), departmentController.create);
departmentRouter.put('/:id', requireMember, authorize('department:update'), departmentController.update);
departmentRouter.delete('/:id', requireMember, authorize('department:delete'), departmentController.remove);
departmentRouter.post('/:id/restore', requireMember, authorize('department:update'), departmentController.restore);

module.exports = departmentRouter;
