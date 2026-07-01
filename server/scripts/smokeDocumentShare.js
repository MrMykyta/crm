'use strict';

const {
  CreditNote,
  Invoice,
  Offer,
  SharedDocument,
  SystemEvent,
  User,
  UserCompany,
  sequelize,
} = require('../src/models');
const sharedDocumentService = require('../src/services/documents/sharedDocument.service');
const { closeBrowser } = require('../src/services/documents/render/pdf.service');

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) throw new Error(`Document share smoke failed: ${name}`);
}

async function findQaUser(companyId) {
  const membership = await UserCompany.findOne({
    where: { companyId, status: 'active' },
    order: [['createdAt', 'ASC']],
  });
  if (!membership) throw new Error(`No active user membership for company ${companyId}`);
  const user = await User.findByPk(membership.userId);
  if (!user) throw new Error(`User ${membership.userId} not found`);
  return {
    ...user.get({ plain: true }),
    companyId,
    role: membership.role || 'owner',
    isOwner: true,
    permissions: ['offer:update', 'order:update', 'file:read'],
  };
}

async function findEntity(Model, label) {
  const row = await Model.findOne({ order: [['createdAt', 'DESC']] });
  if (!row) throw new Error(`No ${label} row available for document share smoke.`);
  return row.get({ plain: true });
}

function hasInternalKeys(value) {
  if (Array.isArray(value)) return value.some(hasInternalKeys);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase();
    if (
      normalized === 'id' ||
      normalized.endsWith('id') ||
      normalized.includes('internal') ||
      normalized.includes('owner') ||
      normalized.includes('cost') ||
      normalized.includes('margin')
    ) {
      return true;
    }
    return hasInternalKeys(child);
  });
}

async function assertShareLifecycle({ entityType, entityId, user }) {
  const share = await sharedDocumentService.createShare({
    entityType,
    entityId,
    user,
    locale: 'pl',
  });

  check(`${entityType} share id`, Boolean(share.id));
  check(`${entityType} token`, /^[0-9a-f-]{36}$/i.test(share.token || ''));
  check(`${entityType} public url`, String(share.url || '').includes(`/public/doc/${share.token}`));
  check(`${entityType} download url`, String(share.downloadUrl || '').includes(`/api/public-documents/${share.token}/download`));
  check(`${entityType} expires`, Boolean(share.expiresAt));

  const publicView = await sharedDocumentService.getPublicDocument({
    token: share.token,
    req: { ip: '127.0.0.1', headers: { 'user-agent': 'smoke-document-share' } },
  });
  check(`${entityType} public dto`, Boolean(publicView?.document?.type));
  check(`${entityType} no internal ids in public dto`, !hasInternalKeys(publicView.document));
  check(`${entityType} view count`, Number(publicView?.meta?.viewCount || 0) >= 1);

  const download = await sharedDocumentService.getPublicDownload({
    token: share.token,
    req: { ip: '127.0.0.1', headers: { 'user-agent': 'smoke-document-share' } },
  });
  check(`${entityType} download file`, Boolean(download?.file?.id));
  check(`${entityType} download path`, Boolean(download?.absPath));

  const event = await SystemEvent.findOne({
    where: {
      companyId: user.companyId,
      type: 'shared_document.downloaded',
      entityType,
      entityId,
    },
    order: [['createdAt', 'DESC']],
  });
  check(`${entityType} download event`, Boolean(event));
  check(`${entityType} event token`, event?.payload?.token === share.token);

  const revoked = await sharedDocumentService.revokeShare({ id: share.id, user });
  check(`${entityType} revoked`, Boolean(revoked.revokedAt));
  try {
    await sharedDocumentService.getPublicDocument({ token: share.token, req: { headers: {} } });
    check(`${entityType} revoked denied`, false);
  } catch (error) {
    check(`${entityType} revoked denied`, error?.code === 'SHARE_REVOKED' || error?.statusCode === 410);
  }

  return share;
}

async function assertExpiredShare({ entityType, entityId, user }) {
  const share = await sharedDocumentService.createShare({
    entityType,
    entityId,
    user,
    locale: 'pl',
  });
  await SharedDocument.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: share.id } });
  try {
    await sharedDocumentService.getPublicDocument({ token: share.token, req: { headers: {} } });
    check(`${entityType} expired denied`, false);
  } catch (error) {
    check(`${entityType} expired denied`, error?.code === 'SHARE_EXPIRED' || error?.statusCode === 410);
  }
}

async function main() {
  try {
    await sequelize.authenticate();

    const offer = await findEntity(Offer, 'offer');
    const invoice = await findEntity(Invoice, 'invoice');
    const creditNote = await findEntity(CreditNote, 'credit note');

    await assertShareLifecycle({
      entityType: 'offer',
      entityId: offer.id,
      user: await findQaUser(offer.companyId),
    });
    await assertShareLifecycle({
      entityType: 'invoice',
      entityId: invoice.id,
      user: await findQaUser(invoice.companyId),
    });
    await assertShareLifecycle({
      entityType: 'credit_note',
      entityId: creditNote.id,
      user: await findQaUser(creditNote.companyId),
    });
    await assertExpiredShare({
      entityType: 'invoice',
      entityId: invoice.id,
      user: await findQaUser(invoice.companyId),
    });

    // eslint-disable-next-line no-console
    console.log('Document share smoke passed');
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
