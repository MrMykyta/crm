
// channel.extras.controller.js (generated)
const svc = require('../../services/pim/channelService.extras');

// Обновляет листинги канала для выбранной сущности.
module.exports.setListings = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.setListings(companyId, req.params.id, req.body.listings || []);
    res.json(r);
  } catch (e) {
    next(e);
  }
};

