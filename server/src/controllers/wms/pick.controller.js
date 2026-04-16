
// pick.controller.js (generated)
const svc = require('../../services/wms/pickService');

// Создаёт волну отбора для складских pick-задач.
module.exports.createWave = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.createWave(req.user.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
// Завершает pick-задачу и фиксирует результат отбора.
module.exports.completeTask = async (req,res)=> {
  const row = await svc.completeTask(req.user.companyId || req.body.companyId, req.params.id);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};

