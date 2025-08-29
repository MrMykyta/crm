
// PackagingUnit.controller.js (generated)
const packagingUnitService = require('../../services/pim/packagingUnitService');
module.exports.list = async (req,res)=>{ const r = await packagingUnitService.list({ query:req.query, user:req.user }); res.json({ data:r.rows, meta:{ count:r.count, page:r.page, limit:r.limit } }); };
module.exports.getById = async (req,res)=>{ const r = await packagingUnitService.getById(req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.create = async (req,res)=>{ const p={...req.body}; if(req.user?.companyId && !p.companyId) p.companyId=req.user.companyId; const r=await packagingUnitService.create(p); res.status(201).json(r); };
module.exports.update = async (req,res)=>{ const r=await packagingUnitService.update(req.params.id, req.body); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.remove = async (req,res)=>{ const n=await packagingUnitService.remove(req.params.id); if(!n) return res.sendStatus(404); res.json({ deleted:n }); };
