const dealService = require('../../services/crm/dealService');
const dealActivityService = require('../../services/crm/dealActivityService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { rows, count, page, limit } = await dealService.list({
      query: req.query,
      user: req.user,
      companyId,
    });
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[DealController.list]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.board = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const board = await dealService.board({
      query: req.query,
      user: req.user,
      companyId,
    });
    res.status(200).send(board);
  } catch (e) {
    console.error('[DealController.board]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

module.exports.listActivities = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = await dealActivityService.listActivities(companyId, req.params.id, req.query);
    res.status(200).send({ data: rows });
  } catch (e) {
    console.error('[DealController.listActivities]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

module.exports.createActivity = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const created = await dealActivityService.createActivity(
      companyId,
      req.params.id,
      req.user.id,
      req.body
    );
    res.status(201).send(created);
  } catch (e) {
    console.error('[DealController.createActivity]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

module.exports.deleteActivity = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const deleted = await dealActivityService.deleteActivity(
      companyId,
      req.params.id,
      req.params.activityId
    );
    if (!deleted) return res.sendStatus(404);
    res.status(200).send({ deleted });
  } catch (e) {
    console.error('[DealController.deleteActivity]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const item = await dealService.getById(req.params.id, { companyId, user: req.user });
    if (!item) {
        return res.sendStatus(404);
    }
    res.status(200).send(item);
  } catch (e) {
    console.error('[DealController.getById]', e);
    res.status(400).send({ error: e.message });
  }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const payload = { ...req.body };
    delete payload.companyId;
    const created = await dealService.create(payload, { companyId, user: req.user });
    res.status(201).send(created);
  } catch (e) {
    console.error('[DealController.create]', e);
    res.status(400).send({ error: e.message });
  }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const payload = { ...req.body };
    delete payload.companyId;
    const updated = await dealService.update(req.params.id, payload, { companyId, user: req.user });
    if (!updated) {
        return res.sendStatus(404);
    }
    res.status(200).send(updated);
  } catch (e) {
    console.error('[DealController.update]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.moveStage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const updated = await dealService.moveStage(req.params.id, req.body, { companyId, user: req.user });
    if (!updated) {
        return res.sendStatus(404);
    }
    res.status(200).send(updated);
  } catch (e) {
    console.error('[DealController.moveStage]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

module.exports.markWon = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const updated = await dealService.markWon(req.params.id, req.body, { companyId, user: req.user });
    if (!updated) {
        return res.sendStatus(404);
    }
    res.status(200).send(updated);
  } catch (e) {
    console.error('[DealController.markWon]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

module.exports.markLost = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const updated = await dealService.markLost(req.params.id, req.body, { companyId, user: req.user });
    if (!updated) {
        return res.sendStatus(404);
    }
    res.status(200).send(updated);
  } catch (e) {
    console.error('[DealController.markLost]', e);
    res.status(e.status || 400).send({ error: e.message });
  }
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const n = await dealService.remove(req.params.id, { companyId, user: req.user });
    if (!n) {
        return res.sendStatus(404);
    }
    res.status(200).send({ deleted: n });
  } catch (e) {
    console.error('[DealController.remove]', e);
    res.status(400).send({ error: e.message });
  }
};
