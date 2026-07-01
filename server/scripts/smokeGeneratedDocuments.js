'use strict';

const fs = require('fs/promises');
const path = require('path');
const {
  sequelize,
  Document,
  File,
  Offer,
  Invoice,
  CreditNote,
  User,
  UserCompany,
} = require('../src/models');
const { STORAGE_ROOT } = require('../src/config/files');
const generatedDocumentService = require('../src/services/documents/generatedDocument.service');
const { closeBrowser } = require('../src/services/documents/render/pdf.service');

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) {
    throw new Error(`Generated documents smoke failed: ${name}`);
  }
}

async function findQaUser(companyId) {
  const membership = await UserCompany.findOne({
    where: { companyId, status: 'active' },
    order: [['createdAt', 'ASC']],
  });
  if (!membership) {
    throw new Error(`No active user membership for company ${companyId}`);
  }

  const user = await User.findByPk(membership.userId);
  if (!user) {
    throw new Error(`User ${membership.userId} not found`);
  }

  const plain = user.get({ plain: true });
  return {
    ...plain,
    companyId,
    role: membership.role || 'owner',
    isOwner: true,
    permissions: ['offer:update', 'order:update', 'file:read'],
  };
}

async function findEntity(Model, label) {
  const row = await Model.findOne({ order: [['createdAt', 'DESC']] });
  if (!row) {
    throw new Error(`No ${label} row available for generated document smoke.`);
  }
  return row.get({ plain: true });
}

async function assertGenerated({ result, entityType, entityId }) {
  const documentId = result?.document?.id;
  const fileId = result?.file?.id;
  check(`${entityType} returns document id`, documentId, documentId || '');
  check(`${entityType} returns file id`, fileId, fileId || '');
  check(`${entityType} metadata entity`, result?.metadata?.entity === entityType, result?.metadata?.entity || '');
  check(`${entityType} metadata entityId`, String(result?.metadata?.entityId) === String(entityId));
  check(`${entityType} metadata fileId`, String(result?.metadata?.fileId) === String(fileId));

  const [document, file] = await Promise.all([
    Document.findByPk(documentId),
    File.findByPk(fileId),
  ]);

  check(`${entityType} document row exists`, Boolean(document));
  check(`${entityType} file row exists`, Boolean(file));
  check(`${entityType} document source entity`, document.sourceEntityType === entityType);
  check(`${entityType} document source id`, String(document.sourceEntityId) === String(entityId));
  check(`${entityType} document file id`, String(document.fileId) === String(fileId));
  check(`${entityType} document generatedAt`, Boolean(document.generatedAt));
  check(`${entityType} file owner is document`, file.ownerType === 'document');
  check(`${entityType} file owner id matches document`, String(file.ownerId) === String(documentId));
  check(`${entityType} file mime is pdf`, file.mime === 'application/pdf', file.mime);
  check(`${entityType} file has size`, Number(file.size) > 1000, `size=${file.size}`);

  const absPath = path.join(STORAGE_ROOT, file.storagePath);
  const bytes = await fs.readFile(absPath);
  check(`${entityType} PDF starts with %PDF`, bytes.subarray(0, 4).toString('utf8') === '%PDF');
}

async function main() {
  try {
    await sequelize.authenticate();

    const offer = await findEntity(Offer, 'offer');
    const invoice = await findEntity(Invoice, 'invoice');
    const creditNote = await findEntity(CreditNote, 'credit note');

    const offerUser = await findQaUser(offer.companyId);
    const invoiceUser = await findQaUser(invoice.companyId);
    const creditNoteUser = await findQaUser(creditNote.companyId);

    const offerResult = await generatedDocumentService.generateForEntity({
      entityType: 'offer',
      entityId: offer.id,
      user: offerUser,
      locale: 'pl',
    });
    await assertGenerated({ result: offerResult, entityType: 'offer', entityId: offer.id });

    const invoiceResult = await generatedDocumentService.generateForEntity({
      entityType: 'invoice',
      entityId: invoice.id,
      user: invoiceUser,
      locale: 'pl',
    });
    await assertGenerated({ result: invoiceResult, entityType: 'invoice', entityId: invoice.id });

    const creditNoteResult = await generatedDocumentService.generateForEntity({
      entityType: 'credit_note',
      entityId: creditNote.id,
      user: creditNoteUser,
      locale: 'pl',
    });
    await assertGenerated({ result: creditNoteResult, entityType: 'credit_note', entityId: creditNote.id });

    // eslint-disable-next-line no-console
    console.log('Generated documents smoke passed');
  } finally {
    await closeBrowser().catch(() => {});
    await sequelize.close().catch(() => {});
  }
}

main().catch(async (error) => {
  await closeBrowser().catch(() => {});
  await sequelize.close().catch(() => {});
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
