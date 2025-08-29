const path = require('path');
const fs = require('fs/promises');
const { Attachment } = require('../../models');
const { Op } = require('sequelize');

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

module.exports.list = (companyId, { ownerType, ownerId, limit = 50, offset = 0 } = {}) => {
  const where = { companyId };
  if (ownerType) where.ownerType = ownerType;
  if (ownerId) where.ownerId = ownerId;

  return Attachment.findAndCountAll({
    where, limit, offset,
    order: [['created_at', 'DESC']],
    include: [{ association: 'uploader', attributes: ['id','firstName','lastName','email'] }]
  });
};

module.exports.create = async (companyId, userId, meta) => {
  return Attachment.create({ ...meta, companyId, uploadedBy: userId });
};

module.exports.remove = async (companyId, id) => {
  const att = await Attachment.findOne({ where: { id, companyId } });
  if (!att) return null;

  try {
    await fs.unlink(path.join(UPLOAD_ROOT, att.storagePath));
  } catch (_) {}
  await att.destroy();
  return true;
};

module.exports.getForDownload = (companyId, id) => {
  return Attachment.findOne({ where: { id, companyId } });
};
