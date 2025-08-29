const path = require('path');
const fs = require('fs');
const AttachmentService = require('../../services/system/attachmentService');

module.exports.list = async (req, res) => {
  const companyId = req.user.companyId;
  try {
    const data = await AttachmentService.list(companyId, req.query);
    res.json(data);
  } catch (e) {
    console.error('[Attachment:list]', e);
    res.status(400).json({ error: 'Failed to list attachments' });
  }
};

module.exports.upload = async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { ownerType, ownerId } = req.body;
    const meta = {
      ownerType,
      ownerId,
      filename: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.path.replace(`${process.cwd()}${path.sep}uploads${path.sep}`, '').replace(/\\/g,'/')
    };
    const created = await AttachmentService.create(companyId, userId, meta);
    res.status(201).json(created);
  } catch (e) {
    console.error('[Attachment:upload]', e);
    res.status(400).json({ error: 'Failed to upload' });
  }
};

module.exports.download = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;
  try {
    const att = await AttachmentService.getForDownload(companyId, id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    const absPath = path.join(process.cwd(), 'uploads', att.storagePath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', att.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
    fs.createReadStream(absPath).pipe(res);
  } catch (e) {
    console.error('[Attachment:download]', e);
    res.status(400).json({ error: 'Failed to download' });
  }
};

module.exports.remove = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;
  try {
    const ok = await AttachmentService.remove(companyId, id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Attachment:remove]', e);
    res.status(400).json({ error: 'Failed to delete attachment' });
  }
};
