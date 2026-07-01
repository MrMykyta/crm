const service = require('../../services/oms/paymentService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list({ ...(req.query || {}), companyId: req.user.companyId }));
    } catch(e){ 
        next(e);
    } 
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res,next) => { 
    try{ 
        const payload = {
            ...(req.body || {}),
            companyId: req.user.companyId,
            userId: req.user.id,
            createdBy: req.user.id,
        };
        res.status(201).json(await service.create(payload));
    } catch(e){ 
        next(e);
    } 
};
