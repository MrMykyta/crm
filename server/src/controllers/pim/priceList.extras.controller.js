
// priceList.extras.controller.js (generated)
const svc=require('../../services/pim/priceListService.extras');
module.exports.setItems=async(req,res)=>{ const r=await svc.setItems(req.user?.companyId||req.body.companyId, req.params.id, req.body.items||[]); res.json(r); };
module.exports.bestPrice=async(req,res)=>{ const r=await svc.bestPrice(req.user?.companyId||req.query.companyId,{...req.query,priceListId:req.params.id}); res.json(r||{}); };
