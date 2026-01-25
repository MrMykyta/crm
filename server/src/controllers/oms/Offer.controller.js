const service = require('../../services/oms/offerService');
const orderService = require('../../services/oms/orderService');

module.exports.list = async (req,res,next) => { 
    try{ 
        const query = { ...req.query };
        delete query.companyId;
        res.json(await service.list(query, req.user)); 
    } catch(e) { 
        next(e);
    } 
};
module.exports.get = async (req,res,next) => { 
    try{ 
        const r=await service.get(req.params.id); 
        if(!r) return res.status(404).json({message:'Offer not found'}); 
        res.json(r);
    } catch(e){ 
        next(e);
    } 
};

module.exports.create = async (req,res,next) => { 
    try{ 
        const payload = { ...req.body, companyId: req.user.companyId };
        res.status(201).json(await service.create(payload, req.user)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.update = async (req,res,next) => { 
    try{ 
        const payload = { ...req.body };
        delete payload.companyId;
        res.json(await service.update(req.params.id, payload)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.remove = async (req,res,next)=>{ 
    try{ 
        res.json(await service.remove(req.params.id)); 
    } catch(e){ 
        next(e);
    } 
};
module.exports.convert= async (req,res,next)=>{ 
    try{ 
        const payload = { ...req.body };
        delete payload.companyId;
        res.status(201).json(await orderService.fromOffer(req.params.id, payload)); 
    } catch(e){ 
        next(e);
    } 
};
