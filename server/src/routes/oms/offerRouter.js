const offerRouter = require('express').Router();
const OfferController = require('../../controllers/oms/Offer.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const offerSchema = require('../../schemas/offerSchema');

offerRouter.get('/meta', authorize('offer:read'), OfferController.meta);

offerRouter.get('/', validateQuery(offerSchema.listQuery), authorize('offer:read'), OfferController.list);
offerRouter.post('/', validateBody(offerSchema.create), authorize('offer:create'), OfferController.create);

offerRouter.get('/:id', authorize('offer:read'), OfferController.getById);
offerRouter.put('/:id', validateBody(offerSchema.update), authorize('offer:update'), OfferController.update);
offerRouter.patch('/:id', validateBody(offerSchema.update), authorize('offer:update'), OfferController.update);
offerRouter.delete('/:id', authorize('offer:delete'), OfferController.remove);

offerRouter.get('/:id/items', authorize('offer:read'), OfferController.getById);
offerRouter.put('/:id/items', validateBody(offerSchema.saveItems), authorize('offer:update'), OfferController.saveItems);
offerRouter.patch('/:id/items', validateBody(offerSchema.saveItems), authorize('offer:update'), OfferController.saveItems);

offerRouter.post('/:id/actions/send', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.send);
offerRouter.post('/:id/actions/view', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.view);
offerRouter.post('/:id/actions/accept', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.accept);
offerRouter.post('/:id/actions/reject', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.reject);
offerRouter.post('/:id/actions/cancel', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.cancel);
offerRouter.post('/:id/actions/expire', validateBody(offerSchema.actionPayload), authorize('offer:update'), OfferController.expire);
offerRouter.post('/:id/actions/duplicate', validateBody(offerSchema.duplicatePayload), authorize('offer:create'), OfferController.duplicate);
offerRouter.post('/:id/actions/convert-to-order', validateBody(offerSchema.convertPayload), authorize('offer:convert'), OfferController.convertToOrder);
offerRouter.post('/:id/actions/convert-to-invoice', validateBody(offerSchema.convertPayload), authorize('offer:convert'), OfferController.convertToInvoice);

module.exports = offerRouter;
