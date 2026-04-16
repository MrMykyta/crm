
// ProductAttributeValue.controller.js (generated)
const productAttributeValueService = require('../../services/pim/productAttributeValueService');
// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res)=>{ const r = await productAttributeValueService.list({ query:req.query, user:req.user }); res.json({ data:r.rows, meta:{ count:r.count, page:r.page, limit:r.limit } }); };
// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req,res)=>{ const r = await productAttributeValueService.getById(req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res)=>{ const p={...req.body}; if(req.user?.companyId && !p.companyId) p.companyId=req.user.companyId; const r=await productAttributeValueService.create(p); res.status(201).json(r); };
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req,res)=>{ const r=await productAttributeValueService.update(req.params.id, req.body); if(!r) return res.sendStatus(404); res.json(r); };
// Удаляет сущность по идентификатору.
module.exports.remove = async (req,res)=>{ const n=await productAttributeValueService.remove(req.params.id); if(!n) return res.sendStatus(404); res.json({ deleted:n }); };

