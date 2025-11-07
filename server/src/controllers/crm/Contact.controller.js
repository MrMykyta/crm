'use strict';
const contactService = require('../../services/crm/contactService');

module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await contactService.list({
      companyId: req.params.companyId || req.companyId,
      query: req.query,
    });
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[ContactController.list]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.getOne = async (req, res) => {
  try {
    const data = await contactService.getOne({
      companyId: req.params.companyId || req.companyId,
      id: req.params.id,
      query: req.query,
    });
    res.status(200).send(data);
  } catch (e) {
    console.error('[ContactController.getOne]', e);
    res.status(404).send({ error: e.message });
  }
};

module.exports.create = async (req, res) => {
  try {
    const data = await contactService.create({
      companyId: req.params.companyId || req.companyId,
      user: req.user,
      payload: req.body,
    });
    res.status(201).send(data);
  } catch (e) {
    console.error('[ContactController.create]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.update = async (req, res) => {
  try {
    const data = await contactService.update({
      companyId: req.params.companyId || req.companyId,
      id: req.params.id,
      user: req.user,
      payload: req.body,
    });
    res.status(200).send(data);
  } catch (e) {
    console.error('[ContactController.update]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.remove = async (req, res) => {
  try {
    await contactService.remove({
      companyId: req.params.companyId || req.companyId,
      id: req.params.id,
    });
    res.status(204).send();
  } catch (e) {
    console.error('[ContactController.remove]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.restore = async (req, res) => {
  try {
    const data = await contactService.restore({
      companyId: req.params.companyId || req.companyId,
      id: req.params.id,
    });
    res.status(200).send(data);
  } catch (e) {
    console.error('[ContactController.restore]', e);
    res.status(400).send({ error: e.message });
  }
};