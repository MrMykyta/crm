'use strict';

const express = require('express');
const contactRouter = express.Router();

const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const contactSchema = require('../../schemas/contactSchema');
const ContactController = require('../../controllers/crm/Contact.controller');

contactRouter.get(
  '/',
  requireMember,
  authorize('contact:read'),
  validateQuery(contactSchema.listQuery),
  ContactController.list
);

contactRouter.get(
  '/counterparty/:counterpartyId',
  requireMember,
  authorize('contact:read'),
  validateQuery(contactSchema.byCounterpartyQuery),
  ContactController.getByCounterparty
);

contactRouter.get('/:id', requireMember, authorize('contact:read'), ContactController.getById);

contactRouter.post(
  '/',
  requireMember,
  authorize('contact:create'),
  validateBody(contactSchema.create),
  ContactController.create
);

contactRouter.patch(
  '/:id',
  requireMember,
  authorize('contact:update'),
  validateBody(contactSchema.update),
  ContactController.update
);

// backward compatibility with old clients
contactRouter.put(
  '/:id',
  requireMember,
  authorize('contact:update'),
  validateBody(contactSchema.update),
  ContactController.update
);

contactRouter.patch('/:id/set-main', requireMember, authorize('contact:update'), ContactController.setMain);

contactRouter.delete('/:id', requireMember, authorize('contact:delete'), ContactController.remove);

contactRouter.post('/:id/restore', requireMember, authorize('contact:update'), ContactController.restore);

module.exports = contactRouter;
