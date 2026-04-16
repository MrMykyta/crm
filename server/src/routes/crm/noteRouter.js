'use strict';

const express = require('express');
const noteRouter = express.Router();

const NoteController = require('../../controllers/crm/Note.controller');
const { requireMember } = require('../../middleware/requireMember');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const noteSchema = require('../../schemas/noteSchema');

noteRouter.get(
  '/',
  requireMember,
  validateQuery(noteSchema.listQuery),
  authorize('note:read'),
  NoteController.list
);

noteRouter.get(
  '/owners',
  requireMember,
  validateQuery(noteSchema.ownerLookupQuery),
  authorize('note:read'),
  NoteController.ownerOptions
);

noteRouter.get('/:id', requireMember, authorize('note:read'), NoteController.getById);

noteRouter.post(
  '/',
  requireMember,
  validateBody(noteSchema.create),
  authorize('note:create'),
  NoteController.create
);

noteRouter.put(
  '/:id',
  requireMember,
  validateBody(noteSchema.update),
  authorize('note:update'),
  NoteController.update
);

noteRouter.delete('/:id', requireMember, authorize('note:delete'), NoteController.remove);

module.exports = noteRouter;
