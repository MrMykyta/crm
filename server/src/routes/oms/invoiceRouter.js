const invoiceRouter = require('express').Router();
const InvoiceController = require('../../controllers/oms/Invoice.controller');
const authorize = require('../../middleware/authorize');

invoiceRouter.get('/', authorize('order:read'), InvoiceController.list);
invoiceRouter.get('/:id', authorize('order:read'), InvoiceController.get);
invoiceRouter.post('/order/:orderId/actions/issue', authorize('order:convert'), InvoiceController.issue);

module.exports = invoiceRouter;
