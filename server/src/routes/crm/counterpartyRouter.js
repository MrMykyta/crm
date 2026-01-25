const express = require('express');
const counterpartyRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const counterpartyController = require('../../controllers/crm/Counterparty.controller');

// все ручки проверяют членство; companyId берём из req.user.companyId (см. контроллер)
counterpartyRouter.get('/',        requireMember, counterpartyController.list);
counterpartyRouter.get('/:id',    requireMember, counterpartyController.getOne);
counterpartyRouter.post('/',       requireMember, counterpartyController.create);
counterpartyRouter.put('/:id',    requireMember, counterpartyController.update);
counterpartyRouter.delete('/:id', requireMember, counterpartyController.remove);

// доп. экшен: конвертация лида в клиента
counterpartyRouter.post('/:id/convert-lead', requireMember, counterpartyController.convertLead);

module.exports = counterpartyRouter;
