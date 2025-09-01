const eventService = require('../../services/system/eventService');

module.exports.list = async (req,res) => {
  const rows = await eventService.list(req.user.companyId, req.query);
  res.json(rows);
};