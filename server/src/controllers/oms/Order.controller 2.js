const service = require('../../services/oms/orderService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res,next) => { 
    try{ 
        const query = { ...req.query };
        delete query.companyId;
        res.json(await service.list(query, req.user)); 
    } catch(e){ 
        next(e);
    } 
};

// Возвращает одну сущность по её идентификатору.
module.exports.get = async (req,res,next) => { 
    try{ 
        const r=await service.get(req.params.id); 
        if(!r) return res.status(404).json({message:'Order not found'}); 
        res.json(r);
    } catch(e){ 
        next(e);
    } 
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res,next) => { 
    try{ 
        const payload = { ...req.body, companyId: req.user.companyId };
        res.status(201).json(await service.create(payload, req.user)); 
    } catch(e){ 
        next(e);
    } 
};
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req,res,next) => { 
    try{ 
        const payload = { ...req.body };
        delete payload.companyId;
        res.json(await service.update(req.params.id, payload)); 
    } catch(e){ 
        next(e);
    } 
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req,res,next) => { 
    try{ 
        res.json(await service.remove(req.params.id)); 
    } catch(e){ 
        next(e);
    } 
};

// Создаёт заказ на основании коммерческого предложения.
module.exports.fromOffer = async (req,res,next) => { 
    try{ 
        const payload = { ...req.body };
        delete payload.companyId;
        res.status(201).json(await service.fromOffer(req.params.id, payload)); 
    } catch(e){ 
        next(e);
    } 
};

