const service = require('../../services/oms/paymentService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query)); 
    } catch(e){ 
        next(e);
    } 
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res,next) => { 
    try{ 
        res.status(201).json(await service.create(req.body)); 
    } catch(e){ 
        next(e);
    } 
};
