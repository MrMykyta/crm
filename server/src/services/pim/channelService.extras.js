
// channelService.extras.js (generated)
const { withTx } = require('../../utils/tx');
const { Channel, ChannelListing } = require('../../models');
module.exports.setListings = (companyId, channelId, listings=[], tx=null)=> withTx(async (t)=>{
  await ChannelListing.destroy({ where:{ companyId, channelId }, transaction:t });
  if (listings?.length) await ChannelListing.bulkCreate(listings.map(l=>({ ...l, companyId, channelId })), { transaction:t });
  return Channel.findOne({ where:{ companyId, id: channelId }, include:[{ model: ChannelListing, as:'listings' }], transaction:t });
}, tx);
