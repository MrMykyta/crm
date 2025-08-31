const service = require('../../services/oms/offerService');
const orderService = require('../../services/oms/orderService');

module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query, req.user)); 
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
        res.status(201).json(await service.create(req.body, req.user)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.update = async (req,res,next) => { 
    try{ 
        res.json(await service.update(req.params.id, req.body)); 
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
        res.status(201).json(await orderService.fromOffer(req.params.id, req.body)); 
    } catch(e){ 
        next(e);
    } 
};