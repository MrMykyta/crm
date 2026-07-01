'use strict';

const creditNoteRouter = require('express').Router();
const CreditNoteController = require('../../controllers/oms/CreditNote.controller');
const authorize = require('../../middleware/authorize');
const { companyIdGuard } = require('../../middleware/companyIdGuard');

creditNoteRouter.use(companyIdGuard);

creditNoteRouter.get('/', authorize('order:read'), CreditNoteController.list);
creditNoteRouter.get('/:id', authorize('order:read'), CreditNoteController.get);
creditNoteRouter.post('/:id/actions/apply', authorize('order:update'), CreditNoteController.apply);
creditNoteRouter.post('/:id/actions/cancel', authorize('order:update'), CreditNoteController.cancel);
creditNoteRouter.post('/:id/actions/refund', authorize('order:update'), CreditNoteController.refund);
creditNoteRouter.post('/:id/actions/generate-pdf', authorize('order:update'), CreditNoteController.generatePdf);
creditNoteRouter.post('/:id/actions/send-document', authorize('order:update'), CreditNoteController.sendDocument);

module.exports = creditNoteRouter;
