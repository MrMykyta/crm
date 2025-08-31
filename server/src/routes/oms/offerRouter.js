const offerRouter = require('express').Router();
const OfferController = require('../../controllers/oms/Offer.controller');



offerRouter.get('/', OfferController.list);
offerRouter.post('/', OfferController.create);
offerRouter.post('/convert/:id', OfferController.convert);

offerRouter.get('/:id', OfferController.get);
offerRouter.put('/:id', OfferController.update);
offerRouter.delete('/:id', OfferController.remove);

module.exports = offerRouter;
