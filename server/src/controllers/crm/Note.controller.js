const NoteService = require('../../services/crm/noteService');

module.exports.list = async (req, res) => {
  const companyId = req.user.companyId;
  try {
    const data = await NoteService.list(companyId, req.query);
    res.json(data);
  } catch (e) {
    console.error('[Note:list]', e);
    res.status(400).json({ error: 'Failed to list notes' });
  }
};

module.exports.create = async (req, res) => {
  const companyId = req.user.companyId;
  const authorUserId = req.user.id;
  try {
    const note = await NoteService.create(companyId, authorUserId, req.body);
    res.status(201).json(note);
  } catch (e) {
    console.error('[Note:create]', e);
    res.status(400).json({ error: 'Failed to create note' });
  }
};

module.exports.update = async (req, res) => {
  const companyId = req.user.companyId;
  const authorUserId = req.user.id;
  const { id } = req.params;
  try {
    const updated = await NoteService.update(companyId, id, authorUserId, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    console.error('[Note:update]', e);
    res.status(400).json({ error: 'Failed to update note' });
  }
};

module.exports.remove = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;
  try {
    const ok = await NoteService.remove(companyId, id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Note:remove]', e);
    res.status(400).json({ error: 'Failed to delete note' });
  }
};
