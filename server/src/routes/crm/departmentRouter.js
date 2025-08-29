const express = require('express');
const departmentRouter = express.Router();

// временно простая проверка — только член компании может работать с отделами
const { requireMember } = require('../../middleware/requireMember');

const departmentController = require('../../controllers/crm/Department.controller');

departmentRouter.get('/:companyId', requireMember, departmentController.list);
departmentRouter.post('/:companyId', requireMember, departmentController.create);
departmentRouter.put('/:companyId/:id', requireMember, departmentController.update);
departmentRouter.delete('/:companyId/:id', requireMember, departmentController.remove);

module.exports = departmentRouter;
