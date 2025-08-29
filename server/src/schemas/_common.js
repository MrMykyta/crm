const Joi = require('joi');

const uuid = Joi.string().uuid({ version: 'uuidv4' });
const dateISO = Joi.date().iso();

const paging = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  sort: Joi.string().max(200), // формат вида "createdAt:desc,status:asc"
});

module.exports = { Joi, uuid, dateISO, paging };
