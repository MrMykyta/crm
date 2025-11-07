const taskService = require('../../services/crm/taskService');

module.exports.list = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const { rows, count, page, limit } = await taskService.list({
      query: req.query,
      companyId,
      user: req.user,
    });
    res.status(200).send({ items: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[TaskController.list]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.listCalendar = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const data = await taskService.listCalendar({
      query: req.query,
      companyId,
      user: req.user,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[TaskController.listCalendar]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.getById = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const id = req.params.id;
    const item = await taskService.getById({ id, companyId, user: req.user });
    if (!item) return res.status(404).send({ error: 'Task not found' });
    res.status(200).send({ data: item });
  } catch (e) {
    console.error('[TaskController.getById]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.create = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const item = await taskService.create({
      payload: req.body,
      companyId,
      user: req.user,
    });
    res.status(201).send({ data: item });
  } catch (e) {
    console.error('[TaskController.create]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.update = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const id = req.params.id;
    const item = await taskService.update({
      id,
      payload: req.body,
      companyId,
      user: req.user,
    });
    res.status(200).send({ data: item });
  } catch (e) {
    console.error('[TaskController.update]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.remove = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const id = req.params.id;
    await taskService.remove({ id, companyId, user: req.user });
    res.status(204).send();
  } catch (e) {
    console.error('[TaskController.remove]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.restore = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const id = req.params.id;
    const item = await taskService.restore({ id, companyId, user: req.user });
    if (!item) return res.status(404).send({ error: 'Task not found' });
    res.status(200).send({ data: item });
  } catch (e) {
    console.error('[TaskController.restore]', e);
    res.status(400).send({ error: e.message });
  }
};