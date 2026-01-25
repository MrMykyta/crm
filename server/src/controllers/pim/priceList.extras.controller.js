
// priceList.extras.controller.js (generated)
const svc = require('../../services/pim/priceListService.extras');

module.exports.setItems = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.setItems(companyId, req.params.id, req.body.items || []);
    res.json(r);
  } catch (e) {
    next(e);
  }
};

module.exports.bestPrice = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.bestPrice(companyId, { ...req.query, priceListId: req.params.id });
    res.json(r || {});
  } catch (e) {
    next(e);
  }
};
