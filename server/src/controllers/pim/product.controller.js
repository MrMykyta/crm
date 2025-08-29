
// product.controller.js (generated)
const svc = require('../../services/pim/productService');
module.exports.get    = async (req,res)=>{ const r=await svc.getById(req.user?.companyId||req.body.companyId, req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.publish= async (req,res)=>{ await svc.publish(req.user?.companyId||req.body.companyId, req.params.id); res.json({ok:true}); };
module.exports.archive= async (req,res)=>{ await svc.archive(req.user?.companyId||req.body.companyId, req.params.id); res.json({ok:true}); };
module.exports.duplicate= async (req,res)=>{ const r=await svc.duplicate(req.user?.companyId||req.body.companyId, req.params.id, req.body||{}); if(!r) return res.sendStatus(404); res.status(201).json(r); };
module.exports.variantMatrix= async (req,res)=>{ const rows=await svc.variantMatrix(req.user?.companyId||req.body.companyId, req.params.id, req.body.attrs||[], req.body.opts||{}); if(!rows) return res.sendStatus(404); res.status(201).json({ created:rows.length, rows }); };
module.exports.upsertAttrs= async (req,res)=>{ const r=await svc.upsertAttrs(req.user?.companyId||req.body.companyId, req.params.id, req.body.values||[]); if(!r) return res.sendStatus(404); res.json(r); };
