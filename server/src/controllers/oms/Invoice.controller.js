const service = require('../../services/oms/invoiceService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query)); 
    } catch(e){ 
        next(e);
    } 
};
// Возвращает одну сущность по её идентификатору.
module.exports.get = async (req,res,next) => { 
    try{ 
        const r=await service.get(req.params.id); 
        if(!r) return res.status(404).json({message:'Invoice not found'}); 
        res.json(r);
    } catch(e){ 
        next(e);
    } 
};
// Проводит выпуск/выставление счёта.
module.exports.issue = async (req,res,next) => { 
    try{ 
        res.status(201).json(await service.issue(req.params.orderId, req.body)); 
    } catch(e){ 
        next(e);
    } 
};

// Отменяет ранее выставленный счёт.
module.exports.cancel = async (req,res,next) => { 
    try{ 
        res.json(await service.cancel(req.params.id, req.body)); 
    } catch(e){ 
        next(e);
    } 
};
