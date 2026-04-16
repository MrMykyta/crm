
// transfer.controller.js (generated)
const svc = require('../../services/wms/transferService');

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.create(req.user.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
// Выполняет отдельную строку transfer-операции.
module.exports.executeLine = async (req,res)=> {
  const row = await svc.executeLine(req.user.companyId || req.body.companyId, req.params.itemId, req.body);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};

