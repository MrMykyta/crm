const service = require('../../services/oms/paymentService');

module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.create = async (req,res,next) => { 
    try{ 
        res.status(201).json(await service.create(req.body)); 
    } catch(e){ 
        next(e);
    } 
};