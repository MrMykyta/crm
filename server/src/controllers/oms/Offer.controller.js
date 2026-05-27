const offerService = require('../../services/oms/offerService');

module.exports.list = async (req, res, next) => {
  try {
    const data = await offerService.listOffers(req.query || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const data = await offerService.getOfferById(req.params.id, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const data = await offerService.createOffer(req.body || {}, req.user);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await offerService.updateOffer(req.params.id, req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.remove = async (req, res, next) => {
  try {
    const data = await offerService.deleteOffer(req.params.id, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.saveItems = async (req, res, next) => {
  try {
    const data = await offerService.saveOfferItems(req.params.id, req.body?.items || [], req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.send = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'sent', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.view = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'viewed', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.accept = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'accepted', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.reject = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'rejected', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.cancel = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'cancelled', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.expire = async (req, res, next) => {
  try {
    const data = await offerService.changeOfferStatus(req.params.id, 'expired', req.body || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.duplicate = async (req, res, next) => {
  try {
    const data = await offerService.duplicateOffer(req.params.id, req.body || {}, req.user);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.convertToOrder = async (req, res, next) => {
  try {
    const data = await offerService.convertOfferToOrder(req.params.id, req.body || {}, req.user);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.meta = async (req, res, next) => {
  try {
    const data = await offerService.getMeta(req.query || {}, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// Backward compatibility with previous controller method names
module.exports.get = module.exports.getById;
module.exports.convert = module.exports.convertToOrder;

