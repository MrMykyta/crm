const paymentRouter = require('express').Router();
const PaymentController = require('../../controllers/oms/Payment.controller');

router.get('/', PaymentController.list);
router.post('/', PaymentController.create);

module.exports = paymentRouter;