const service = require('../../services/oms/invoiceService');

module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query)); 
    } catch(e){ 
        next(e);
    } 
};
module.exports.get = async (req,res,next) => { 
    try{ 
        const r=await service.get(req.params.id); 
        if(!r) return res.status(404).json({message:'Invoice not found'}); 
        res.json(r);
    } catch(e){ 
        next(e);
    } 
};
module.exports.issue = async (req,res,next) => { 
    try{ 
        res.status(201).json(await service.issue(req.params.orderId, req.body)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.cancel = async (req,res,next) => { 
    try{ 
        res.json(await service.cancel(req.params.id, req.body)); 
    } catch(e){ 
        next(e);
    } 
};