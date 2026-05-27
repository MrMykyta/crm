'use strict';

const express = require('express');
const DocumentController = require('../../controllers/crm/Document.controller');
const DocumentTemplateController = require('../../controllers/crm/DocumentTemplate.controller');
const { requireMember } = require('../../middleware/requireMember');

const documentRouter = express.Router();

documentRouter.get('/templates', requireMember, DocumentTemplateController.list);
documentRouter.post('/templates', requireMember, DocumentTemplateController.create);
documentRouter.get('/templates/:templateId', requireMember, DocumentTemplateController.getById);
documentRouter.delete('/templates/:templateId', requireMember, DocumentTemplateController.remove);
documentRouter.get('/templates/:templateId/draft', requireMember, DocumentTemplateController.getDraft);
documentRouter.put('/templates/:templateId/draft', requireMember, DocumentTemplateController.saveDraft);
documentRouter.post('/templates/:templateId/publish', requireMember, DocumentTemplateController.publish);
documentRouter.put('/templates/:templateId/set-default', requireMember, DocumentTemplateController.setAsDefault);

documentRouter.get('/', requireMember, DocumentController.list);
documentRouter.post('/', requireMember, DocumentController.create);
documentRouter.post('/:id/convert', requireMember, DocumentController.convert);
documentRouter.get('/:id/render-template', requireMember, DocumentController.getRenderTemplate);
documentRouter.get('/:id', requireMember, DocumentController.getById);
documentRouter.put('/:id', requireMember, DocumentController.update);

module.exports = documentRouter;
