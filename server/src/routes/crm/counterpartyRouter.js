const express = require('express');
const counterpartyRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const counterpartyController = require('../../controllers/crm/Counterparty.controller');

// все ручки проверяют членство; companyId берём из :companyId и/или из req.companyId (см. контроллер)
counterpartyRouter.get('/:companyId',        requireMember, counterpartyController.list);
counterpartyRouter.get('/:companyId/:id',    requireMember, counterpartyController.getOne);
counterpartyRouter.post('/:companyId',       requireMember, counterpartyController.create);
counterpartyRouter.put('/:companyId/:id',    requireMember, counterpartyController.update);
counterpartyRouter.delete('/:companyId/:id', requireMember, counterpartyController.remove);

// доп. экшен: конвертация лида в клиента
counterpartyRouter.post('/:companyId/:id/convert-lead', requireMember, counterpartyController.convertLead);

module.exports = counterpartyRouter;