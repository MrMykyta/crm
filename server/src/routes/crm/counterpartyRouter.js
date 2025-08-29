const express = require('express');
const counterpartyRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const counterpartyController = require('../../controllers/crm/Counterparty.controller');

counterpartyRouter.get('/:companyId', requireMember, counterpartyController.list);
counterpartyRouter.get('/:companyId/:id', requireMember, counterpartyController.getOne);

counterpartyRouter.post('/:companyId', requireMember, counterpartyController.create);

counterpartyRouter.put('/:companyId/:id', requireMember, counterpartyController.update);

counterpartyRouter.delete('/:companyId/:id', requireMember, counterpartyController.remove);

module.exports = counterpartyRouter;
