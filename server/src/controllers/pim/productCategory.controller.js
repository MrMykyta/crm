
// ProductCategory.controller.js (generated)
const productCategoryService = require('../../services/pim/productCategoryService');
module.exports.list = async (req,res)=>{ const r = await productCategoryService.list({ query:req.query, user:req.user }); res.json({ data:r.rows, meta:{ count:r.count, page:r.page, limit:r.limit } }); };
module.exports.getById = async (req,res)=>{ const r = await productCategoryService.getById(req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.create = async (req,res)=>{ const p={...req.body}; if(req.user?.companyId && !p.companyId) p.companyId=req.user.companyId; const r=await productCategoryService.create(p); res.status(201).json(r); };
module.exports.update = async (req,res)=>{ const r=await productCategoryService.update(req.params.id, req.body); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.remove = async (req,res)=>{ const n=await productCategoryService.remove(req.params.id); if(!n) return res.sendStatus(404); res.json({ deleted:n }); };
