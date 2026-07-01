const invoiceRouter = require('express').Router();
const InvoiceController = require('../../controllers/oms/Invoice.controller');
const CreditNoteController = require('../../controllers/oms/CreditNote.controller');
const authorize = require('../../middleware/authorize');

invoiceRouter.get('/', authorize('order:read'), InvoiceController.list);
invoiceRouter.get('/:id', authorize('order:read'), InvoiceController.get);
invoiceRouter.post('/order/:orderId/actions/issue', authorize('order:convert'), InvoiceController.issue);
invoiceRouter.post('/:invoiceId/actions/credit', authorize('order:update'), CreditNoteController.issueFromInvoice);
invoiceRouter.post('/:id/actions/generate-pdf', authorize('order:update'), InvoiceController.generatePdf);
invoiceRouter.post('/:id/actions/send-document', authorize('order:update'), InvoiceController.sendDocument);

module.exports = invoiceRouter;
