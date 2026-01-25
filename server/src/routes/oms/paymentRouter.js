const paymentRouter = require('express').Router();
const PaymentController = require('../../controllers/oms/Payment.controller');
const { companyIdGuard } = require('../../middleware/companyIdGuard');

paymentRouter.use(companyIdGuard);

router.get('/', PaymentController.list);
router.post('/', PaymentController.create);

module.exports = paymentRouter;
