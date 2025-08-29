
// channel.extras.controller.js (generated)
const svc = require('../../services/pim/channelService.extras');
module.exports.setListings = async (req,res)=> {
  const r = await svc.setListings(req.user?.companyId||req.body.companyId, req.params.id, req.body.listings||[]);
  res.json(r);
};
