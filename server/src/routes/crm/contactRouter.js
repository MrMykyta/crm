'use strict';

const express = require('express');
const contactRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const ContactController = require('../../controllers/crm/Contact.controller');

/**
 * companyId берём из req.user.companyId.
 * В запросах можно передавать:
 *  - GET /contact?counterpartyId=...&status=active&search=...
 *  - include флаги: withPoints=1, withCounterparty=1
 */

contactRouter.get('/',        requireMember, ContactController.list);
contactRouter.get('/:id',    requireMember, ContactController.getOne);
contactRouter.post('/',       requireMember, ContactController.create);
contactRouter.put('/:id',    requireMember, ContactController.update);
contactRouter.delete('/:id', requireMember, ContactController.remove);
contactRouter.post('/:id/restore', requireMember, ContactController.restore);

module.exports = contactRouter;
