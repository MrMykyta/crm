const express = require('express');
const counterpartyRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const counterpartyController = require('../../controllers/crm/Counterparty.controller');

// все ручки проверяют членство; companyId берём из req.user.companyId (см. контроллер)
counterpartyRouter.get('/',        requireMember, authorize('counterparty:read'), counterpartyController.list);
counterpartyRouter.get('/:id',    requireMember, authorize('counterparty:read'), counterpartyController.getOne);
counterpartyRouter.post('/',       requireMember, authorize('counterparty:create'), counterpartyController.create);
counterpartyRouter.put('/:id',    requireMember, authorize('counterparty:update'), counterpartyController.update);
counterpartyRouter.delete('/:id', requireMember, authorize('counterparty:delete'), counterpartyController.remove);

// доп. экшен: конвертация лида в клиента
counterpartyRouter.post('/:id/convert-lead', requireMember, authorize('counterparty:update'), counterpartyController.convertLead);

module.exports = counterpartyRouter;
