'use strict';

const contactService = require('../../services/crm/contactService');

// Формирует унифицированный HTTP-ответ с ошибкой.
function sendError(res, e, fallback = 'Request failed') {
  const status = Number(e?.status || e?.statusCode || 400);
  const httpStatus = status >= 400 && status <= 599 ? status : 400;
  return res.status(httpStatus).send({ error: e?.message || fallback });
}

// Определяет companyId для текущего запроса контроллера.
function getCompanyId(req) {
  return req.companyId || req.user?.companyId;
}

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const query = req.validatedQuery || req.query;
    const { rows, count, page, limit, totalPages } = await contactService.getContacts({
      companyId: getCompanyId(req),
      query,
    });

    res.status(200).send({
      data: rows,
      meta: { count, page, limit, totalPages },
    });
  } catch (e) {
    console.error('[ContactController.list]', e);
    sendError(res, e, 'Failed to list contacts');
  }
};

// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const data = await contactService.getContactById({
      companyId: getCompanyId(req),
      contactId: req.params.id,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ContactController.getById]', e);
    sendError(res, e, 'Failed to get contact');
  }
};

// Возвращает контакты, привязанные к выбранному контрагенту.
module.exports.getByCounterparty = async (req, res) => {
  try {
    const query = req.validatedQuery || req.query;
    const { rows, count, page, limit, totalPages } = await contactService.getContactsByCounterparty({
      companyId: getCompanyId(req),
      counterpartyId: req.params.counterpartyId,
      query,
    });

    res.status(200).send({
      data: rows,
      meta: { count, page, limit, totalPages },
    });
  } catch (e) {
    console.error('[ContactController.getByCounterparty]', e);
    sendError(res, e, 'Failed to list counterparty contacts');
  }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const data = await contactService.createContact({
      companyId: getCompanyId(req),
      user: req.user,
      payload: req.body,
    });
    res.status(201).send({ data });
  } catch (e) {
    console.error('[ContactController.create]', e);
    sendError(res, e, 'Failed to create contact');
  }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const data = await contactService.updateContact({
      companyId: getCompanyId(req),
      contactId: req.params.id,
      user: req.user,
      payload: req.body,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ContactController.update]', e);
    sendError(res, e, 'Failed to update contact');
  }
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    await contactService.deleteContact({
      companyId: getCompanyId(req),
      contactId: req.params.id,
    });
    res.status(204).send();
  } catch (e) {
    console.error('[ContactController.remove]', e);
    sendError(res, e, 'Failed to delete contact');
  }
};

// Назначает контакт основным для выбранного контрагента.
module.exports.setMain = async (req, res) => {
  try {
    const data = await contactService.setMainContact({
      companyId: getCompanyId(req),
      contactId: req.params.id,
      user: req.user,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ContactController.setMain]', e);
    sendError(res, e, 'Failed to set main contact');
  }
};

// Восстанавливает ранее удалённую сущность.
module.exports.restore = async (req, res) => {
  try {
    const data = await contactService.restoreContact({
      companyId: getCompanyId(req),
      contactId: req.params.id,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ContactController.restore]', e);
    sendError(res, e, 'Failed to restore contact');
  }
};

