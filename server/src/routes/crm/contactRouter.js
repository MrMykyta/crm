'use strict';

const express = require('express');
const contactRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');
const ContactController = require('../../controllers/crm/Contact.controller');

/**
 * companyId берём из :companyId или req.companyId (middleware).
 * В запросах можно передавать:
 *  - GET /:companyId/contacts?counterpartyId=...&status=active&search=...
 *  - include флаги: withPoints=1, withCounterparty=1
 */

contactRouter.get('/:companyId',        requireMember, ContactController.list);
contactRouter.get('/:companyId/:id',    requireMember, ContactController.getOne);
contactRouter.post('/:companyId',       requireMember, ContactController.create);
contactRouter.put('/:companyId/:id',    requireMember, ContactController.update);
contactRouter.delete('/:companyId/:id', requireMember, ContactController.remove);
contactRouter.post('/:companyId/:id/restore', requireMember, ContactController.restore);

module.exports = contactRouter;