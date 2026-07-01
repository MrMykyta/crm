const service = require('../../services/oms/invoiceService');
const generatedDocumentService = require('../../services/documents/generatedDocument.service');
const documentDeliveryService = require('../../services/documents/documentDelivery.service');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res,next) => { 
    try{ 
        res.json(await service.list(req.query, req.user)); 
    } catch(e){ 
        next(e);
    } 
};
// Возвращает одну сущность по её идентификатору.
module.exports.get = async (req,res,next) => { 
    try{ 
        const r=await service.get(req.params.id, req.user); 
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
        res.json(await service.cancel(req.params.id, req.body, req.user)); 
    } catch(e){ 
        next(e);
    } 
};

module.exports.generatePdf = async (req, res, next) => {
    try {
        res.status(201).json(await generatedDocumentService.generateForEntity({
            entityType: 'invoice',
            entityId: req.params.id,
            user: req.user,
            locale: req.body?.locale || req.query?.locale || 'pl',
            templateId: req.body?.templateId || req.query?.templateId || null,
        }));
    } catch (e) {
        next(e);
    }
};

module.exports.sendDocument = async (req, res, next) => {
    try {
        res.status(200).json(await documentDeliveryService.sendEmail({
            entityType: 'invoice',
            entityId: req.params.id,
            user: req.user,
            payload: req.body || {},
        }));
    } catch (e) {
        next(e);
    }
};
