const attachmentRouter = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AttachmentController = require('../../controllers/system/Attachment.controller');

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// disk storage per company
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const companyId = req.user?.companyId || 'no-company';
    const dir = path.join(UPLOAD_ROOT, companyId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${ts}-${safe}`);
  }
});
const upload = multer({ storage });

attachmentRouter.get('/', AttachmentController.list);
attachmentRouter.post('/upload', upload.single('file'), AttachmentController.upload);
attachmentRouter.get('/:id/download', AttachmentController.download);
attachmentRouter.delete('/:id', AttachmentController.remove);

module.exports = attachmentRouter;
