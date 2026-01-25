const express = require('express');
const contactPointRouter = express.Router();
const { requireMember } = require('../../middleware/requireMember');

const contactPointController = require('../../controllers/crm/СontactPoint.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const contactPointSchema = require('../../schemas/contactPointSchema');

const authorize = require('../../middleware/authorize');

// список всех CP для владельца
contactPointRouter.get('/', requireMember, authorize('contact:read'), validateQuery(contactPointSchema.listQuery), contactPointController.list);

// создать CP
contactPointRouter.post('/', requireMember, authorize('contact:create'), validateBody(contactPointSchema.create), contactPointController.create);

// обновить CP
contactPointRouter.put('/:id', requireMember, authorize('contact:update'), validateBody(contactPointSchema.update), contactPointController.update);

// удалить CP
contactPointRouter.delete('/:id', requireMember, authorize('contact:delete'), contactPointController.remove);

module.exports = contactPointRouter;
