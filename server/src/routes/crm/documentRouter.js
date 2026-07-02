'use strict';

const express = require('express');
const DocumentController = require('../../controllers/crm/Document.controller');
const DocumentTemplateController = require('../../controllers/crm/DocumentTemplate.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');

const documentRouter = express.Router();

documentRouter.get('/templates', requireMember, authorize('document:template:read'), DocumentTemplateController.list);
documentRouter.post('/templates', requireMember, authorize('document:template:manage'), DocumentTemplateController.create);
documentRouter.post('/templates/:templateId/duplicate', requireMember, authorize('document:template:manage'), DocumentTemplateController.duplicate);
documentRouter.get('/templates/:templateId', requireMember, authorize('document:template:read'), DocumentTemplateController.getById);
documentRouter.delete('/templates/:templateId', requireMember, authorize('document:template:manage'), DocumentTemplateController.remove);
documentRouter.get('/templates/:templateId/draft', requireMember, authorize('document:template:read'), DocumentTemplateController.getDraft);
documentRouter.put('/templates/:templateId/draft', requireMember, authorize('document:template:manage'), DocumentTemplateController.saveDraft);
documentRouter.post('/templates/:templateId/publish', requireMember, authorize('document:template:manage'), DocumentTemplateController.publish);
documentRouter.put('/templates/:templateId/set-default', requireMember, authorize('document:template:manage'), DocumentTemplateController.setAsDefault);

documentRouter.get('/', requireMember, authorize('document:read'), DocumentController.list);
documentRouter.post('/', requireMember, authorize('document:create'), DocumentController.create);
documentRouter.post('/:id/convert', requireMember, authorize('document:update'), DocumentController.convert);
documentRouter.get('/:id/render-template', requireMember, authorize('document:read'), DocumentController.getRenderTemplate);
documentRouter.get('/:id', requireMember, authorize('document:read'), DocumentController.getById);
documentRouter.put('/:id', requireMember, authorize('document:update'), DocumentController.update);

module.exports = documentRouter;
