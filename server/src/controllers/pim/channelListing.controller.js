
// ChannelListing.controller.js (generated)
const channelListingService = require('../../services/pim/channelListingService');
module.exports.list = async (req,res)=>{ const r = await channelListingService.list({ query:req.query, user:req.user }); res.json({ data:r.rows, meta:{ count:r.count, page:r.page, limit:r.limit } }); };
module.exports.getById = async (req,res)=>{ const r = await channelListingService.getById(req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.create = async (req,res)=>{ const p={...req.body}; if(req.user?.companyId && !p.companyId) p.companyId=req.user.companyId; const r=await channelListingService.create(p); res.status(201).json(r); };
module.exports.update = async (req,res)=>{ const r=await channelListingService.update(req.params.id, req.body); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.remove = async (req,res)=>{ const n=await channelListingService.remove(req.params.id); if(!n) return res.sendStatus(404); res.json({ deleted:n }); };
