const express = require('express');
const departmentRouter = express.Router();

// временно простая проверка — только член компании может работать с отделами
const { requireMember } = require('../../middleware/requireMember');

const departmentController = require('../../controllers/crm/Department.controller');

departmentRouter.get('/', requireMember, departmentController.list);
departmentRouter.post('/', requireMember, departmentController.create);
departmentRouter.put('/:id', requireMember, departmentController.update);
departmentRouter.delete('/:id', requireMember, departmentController.remove);

module.exports = departmentRouter;
