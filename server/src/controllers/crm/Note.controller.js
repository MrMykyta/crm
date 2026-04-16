'use strict';

const noteService = require('../../services/crm/noteService');

// Формирует унифицированный HTTP-ответ с ошибкой.
function sendError(res, e, fallback = 'Request failed') {
  const status = Number(e?.status || e?.statusCode || 400);
  const httpStatus = status >= 400 && status <= 599 ? status : 400;
  return res.status(httpStatus).send({ error: e?.message || fallback });
}

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const query = req.validatedQuery || req.query;
    const { rows, count, page, limit } = await noteService.list({
      companyId,
      userId,
      query,
    });

    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[NoteController.list]', e);
    sendError(res, e, 'Failed to list notes');
  }
};

// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const item = await noteService.getById({
      id: req.params.id,
      companyId,
      userId,
    });

    if (!item) return res.status(404).send({ error: 'Note not found' });
    res.status(200).send({ data: item });
  } catch (e) {
    console.error('[NoteController.getById]', e);
    sendError(res, e, 'Failed to get note');
  }
};

// Возвращает доступные варианты владельца для сущности.
module.exports.ownerOptions = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const query = req.validatedQuery || req.query;
    const data = await noteService.ownerOptions({
      companyId,
      userId,
      query,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[NoteController.ownerOptions]', e);
    sendError(res, e, 'Failed to fetch note owner options');
  }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    const item = await noteService.create({
      companyId,
      userId,
      payload: req.body,
    });

    res.status(201).send({ data: item });
  } catch (e) {
    console.error('[NoteController.create]', e);
    sendError(res, e, 'Failed to create note');
  }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const item = await noteService.update({
      id: req.params.id,
      companyId,
      user: req.user,
      payload: req.body,
    });

    if (!item) return res.status(404).send({ error: 'Note not found' });
    res.status(200).send({ data: item });
  } catch (e) {
    console.error('[NoteController.update]', e);
    sendError(res, e, 'Failed to update note');
  }
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await noteService.remove({
      id: req.params.id,
      companyId,
      user: req.user,
    });

    if (!ok) return res.status(404).send({ error: 'Note not found' });
    res.status(204).send();
  } catch (e) {
    console.error('[NoteController.remove]', e);
    sendError(res, e, 'Failed to delete note');
  }
};

