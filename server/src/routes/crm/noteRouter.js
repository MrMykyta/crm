const noteRouter = require('express').Router();
const NoteController = require('../../controllers/crm/Note.controller');

noteRouter.get('/', NoteController.list);
noteRouter.post('/', NoteController.create);
noteRouter.put('/:id', NoteController.update);
noteRouter.delete('/:id', NoteController.remove);

module.exports = noteRouter;
